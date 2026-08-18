"""
Verification Pipeline Service for EZFINANZ.

Implements KYC, Bank Account, Selfie, and Declaration verification workflows.
Uses modular mock adapters for document, bank, and liveness verification.
Enforces sensitive data hashing & masking, immutable audit logging, and
backend-driven verification state transitions.
"""

import hashlib
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.audit import AuditLog
from app.models.bank import BankAccount
from app.models.declaration import Declaration
from app.models.kyc import KYCDetail
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.selfie import SelfieVerification, SelfieVerificationStatus, SelfieVerificationType
from app.models.user import User
from app.schemas.verification import (
    BankAccountResponse,
    BankAccountSubmitRequest,
    DeclarationResponse,
    DeclarationSubmitRequest,
    KYCResponse,
    KYCSubmitRequest,
    SelfieResponse,
    SelfieSubmitRequest,
    VerificationSummaryResponse,
)
from app.services.loan_service import get_loan_application


# ==============================================================================
# Security & Masking Helpers
# ==============================================================================

def hash_sensitive_value(value: str) -> str:
    """Create a secure SHA-256 hash representation of sensitive identity numbers."""
    return hashlib.sha256(value.strip().encode("utf-8")).hexdigest()


def mask_id_number(raw_id: str) -> str:
    """Mask government ID number preserving only the last 4 characters."""
    clean = raw_id.strip()
    if len(clean) <= 4:
        return "****"
    last4 = clean[-4:]
    return f"XXXX-XXXX-{last4}"


def mask_bank_account_number(raw_acc: str) -> str:
    """Mask bank account number preserving only the last 4 characters."""
    clean = raw_acc.strip()
    if len(clean) <= 4:
        return "****"
    last4 = clean[-4:]
    return f"XXXXXX{last4}"


# ==============================================================================
# Mock Verification Adapters
# ==============================================================================

class MockKYCAdapter:
    """Simulated Government KYC / Document Verification Adapter."""
    @staticmethod
    def verify(id_type: str, id_number: str) -> bool:
        # Validates non-empty input
        return bool(id_number and len(id_number.strip()) >= 4)


class MockBankAdapter:
    """Simulated Banking / Penny-Drop Account Verification Adapter."""
    @staticmethod
    def verify(account_number: str, ifsc: str) -> bool:
        # Validates IFSC format (11 chars) and account number (min 8 digits)
        clean_ifsc = ifsc.strip().upper()
        clean_acc = account_number.strip()
        return len(clean_ifsc) == 11 and len(clean_acc) >= 8


class MockSelfieAdapter:
    """Simulated Facial Liveness & Biometric Verification Adapter."""
    @staticmethod
    def verify(storage_key: str) -> bool:
        return bool(storage_key and len(storage_key.strip()) > 0)


# ==============================================================================
# Audit Logging Helper
# ==============================================================================

def record_audit_log(
    db: Session,
    actor_id: uuid.UUID,
    application_id: uuid.UUID,
    action: str,
    old_status: str = None,
    new_status: str = None,
    metadata: dict = None,
) -> AuditLog:
    """
    Persist an immutable audit log entry.
    Strictly excludes sensitive plaintext credentials.
    """
    log_entry = AuditLog(
        actor_id=actor_id,
        application_id=application_id,
        action=action,
        old_status=old_status,
        new_status=new_status,
        metadata_=metadata or {},
    )
    db.add(log_entry)
    db.flush()
    return log_entry


# ==============================================================================
# Application State Verification
# ==============================================================================

def verify_application_can_start_verification(application: LoanApplication):
    """
    Ensure the loan application is in an acceptable state to perform verification.
    Allowed states: OFFER_SELECTED, UNDER_REVIEW.
    """
    allowed_states = (ApplicationStatus.OFFER_SELECTED, ApplicationStatus.UNDER_REVIEW)
    if application.status not in allowed_states:
        raise ConflictError(
            f"Verification cannot be performed on application in '{application.status.value}' state. "
            "A loan offer must be selected first."
        )


# ==============================================================================
# 1. KYC Verification
# ==============================================================================

def submit_kyc(
    db: Session,
    user: User,
    application_id: uuid.UUID,
    data: KYCSubmitRequest,
) -> KYCResponse:
    """
    Submit and deterministically verify customer KYC information.
    """
    application = get_loan_application(db, user, application_id)
    verify_application_can_start_verification(application)

    # 1. Run mock KYC adapter
    is_valid = MockKYCAdapter.verify(data.id_type.value, data.id_number)
    if not is_valid:
        raise ValidationError("KYC document verification failed. Invalid ID parameters.")

    # 2. Hash sensitive ID and prepare masking
    id_hash = hash_sensitive_value(data.id_number)
    id_masked = mask_id_number(data.id_number)

    # 3. Create or update KYC record for user
    existing_kyc = db.execute(
        select(KYCDetail).where(KYCDetail.user_id == user.id)
    ).scalar_one_or_none()

    if existing_kyc:
        existing_kyc.full_name = data.full_name
        existing_kyc.date_of_birth = data.date_of_birth
        existing_kyc.gender = data.gender
        existing_kyc.address_line_1 = data.address_line_1
        existing_kyc.address_line_2 = data.address_line_2
        existing_kyc.city = data.city
        existing_kyc.state = data.state
        existing_kyc.pincode = data.pincode
        existing_kyc.id_type = data.id_type
        existing_kyc.id_number_hash = id_hash
        existing_kyc.document_storage_key = data.document_storage_key
        kyc_record = existing_kyc
    else:
        kyc_record = KYCDetail(
            user_id=user.id,
            full_name=data.full_name,
            date_of_birth=data.date_of_birth,
            gender=data.gender,
            address_line_1=data.address_line_1,
            address_line_2=data.address_line_2,
            city=data.city,
            state=data.state,
            pincode=data.pincode,
            id_type=data.id_type,
            id_number_hash=id_hash,
            document_storage_key=data.document_storage_key,
        )
        db.add(kyc_record)

    # 4. Audit Log
    record_audit_log(
        db=db,
        actor_id=user.id,
        application_id=application.id,
        action="KYC_VERIFIED",
        metadata={"id_type": data.id_type.value, "masked_id": id_masked},
    )

    db.commit()
    db.refresh(kyc_record)

    # Check overall verification completion
    check_and_update_verification_completion(db, user, application)

    return KYCResponse(
        id=kyc_record.id,
        user_id=kyc_record.user_id,
        full_name=kyc_record.full_name,
        date_of_birth=kyc_record.date_of_birth,
        gender=kyc_record.gender,
        address_line_1=kyc_record.address_line_1,
        address_line_2=kyc_record.address_line_2,
        city=kyc_record.city,
        state=kyc_record.state,
        pincode=kyc_record.pincode,
        id_type=kyc_record.id_type,
        id_number_masked=id_masked,
        status="VERIFIED",
        created_at=kyc_record.created_at,
    )


def get_kyc(
    db: Session,
    user: User,
    application_id: uuid.UUID,
) -> KYCResponse:
    """
    Retrieve KYC details for the customer with sensitive ID masked.
    """
    application = get_loan_application(db, user, application_id)

    kyc_record = db.execute(
        select(KYCDetail).where(KYCDetail.user_id == user.id)
    ).scalar_one_or_none()

    if not kyc_record:
        raise NotFoundError("KYC details not found for this user.")

    return KYCResponse(
        id=kyc_record.id,
        user_id=kyc_record.user_id,
        full_name=kyc_record.full_name,
        date_of_birth=kyc_record.date_of_birth,
        gender=kyc_record.gender,
        address_line_1=kyc_record.address_line_1,
        address_line_2=kyc_record.address_line_2,
        city=kyc_record.city,
        state=kyc_record.state,
        pincode=kyc_record.pincode,
        id_type=kyc_record.id_type,
        id_number_masked="XXXX-XXXX-****",
        status="VERIFIED",
        created_at=kyc_record.created_at,
    )


# ==============================================================================
# 2. Bank Account Verification
# ==============================================================================

def submit_bank_account(
    db: Session,
    user: User,
    application_id: uuid.UUID,
    data: BankAccountSubmitRequest,
) -> BankAccountResponse:
    """
    Submit and verify disbursement destination bank account.
    """
    application = get_loan_application(db, user, application_id)
    verify_application_can_start_verification(application)

    # 1. Run mock bank verification
    is_valid = MockBankAdapter.verify(data.account_number, data.ifsc)
    if not is_valid:
        raise ValidationError("Bank account verification failed. Please check account number and IFSC.")

    # 2. Hash sensitive account number and extract last 4 digits
    acc_clean = data.account_number.strip()
    acc_last4 = acc_clean[-4:]
    acc_hash = hash_sensitive_value(acc_clean)
    acc_masked = mask_bank_account_number(acc_clean)

    # 3. Create or update BankAccount record for this application
    existing_bank = db.execute(
        select(BankAccount).where(BankAccount.application_id == application.id)
    ).scalar_one_or_none()

    if existing_bank:
        existing_bank.account_holder_name = data.account_holder_name
        existing_bank.account_number_hash = acc_hash
        existing_bank.account_number_last4 = acc_last4
        existing_bank.ifsc = data.ifsc.strip().upper()
        existing_bank.bank_name = data.bank_name
        bank_record = existing_bank
    else:
        bank_record = BankAccount(
            application_id=application.id,
            account_holder_name=data.account_holder_name,
            account_number_hash=acc_hash,
            account_number_last4=acc_last4,
            ifsc=data.ifsc.strip().upper(),
            bank_name=data.bank_name,
        )
        db.add(bank_record)

    # 4. Audit Log
    record_audit_log(
        db=db,
        actor_id=user.id,
        application_id=application.id,
        action="BANK_ACCOUNT_VERIFIED",
        metadata={"bank_name": data.bank_name, "last4": acc_last4, "ifsc": data.ifsc.upper()},
    )

    db.commit()
    db.refresh(bank_record)

    # Check overall verification completion
    check_and_update_verification_completion(db, user, application)

    return BankAccountResponse(
        id=bank_record.id,
        application_id=bank_record.application_id,
        account_holder_name=bank_record.account_holder_name,
        account_number_masked=acc_masked,
        account_number_last4=bank_record.account_number_last4,
        ifsc=bank_record.ifsc,
        bank_name=bank_record.bank_name,
        status="VERIFIED",
        created_at=bank_record.created_at,
    )


def get_bank_account(
    db: Session,
    user: User,
    application_id: uuid.UUID,
) -> BankAccountResponse:
    """
    Retrieve bank account details with masked account number.
    """
    application = get_loan_application(db, user, application_id)

    bank_record = db.execute(
        select(BankAccount).where(BankAccount.application_id == application.id)
    ).scalar_one_or_none()

    if not bank_record:
        raise NotFoundError("Bank account not found for this application.")

    return BankAccountResponse(
        id=bank_record.id,
        application_id=bank_record.application_id,
        account_holder_name=bank_record.account_holder_name,
        account_number_masked=f"XXXXXX{bank_record.account_number_last4}",
        account_number_last4=bank_record.account_number_last4,
        ifsc=bank_record.ifsc,
        bank_name=bank_record.bank_name,
        status="VERIFIED",
        created_at=bank_record.created_at,
    )


# ==============================================================================
# 3. Selfie Verification
# ==============================================================================

def submit_selfie(
    db: Session,
    user: User,
    application_id: uuid.UUID,
    data: SelfieSubmitRequest,
) -> SelfieResponse:
    """
    Submit and verify selfie live photo reference.
    """
    application = get_loan_application(db, user, application_id)
    verify_application_can_start_verification(application)

    storage_key = data.storage_key or f"selfies/{application.id}_live.jpg"

    # 1. Run mock selfie verification
    is_valid = MockSelfieAdapter.verify(storage_key)
    if not is_valid:
        raise ValidationError("Selfie verification failed.")

    # 2. Create or update SelfieVerification record
    existing_selfie = db.execute(
        select(SelfieVerification).where(SelfieVerification.application_id == application.id)
    ).scalar_one_or_none()

    if existing_selfie:
        existing_selfie.storage_key = storage_key
        existing_selfie.verification_type = data.verification_type
        existing_selfie.status = SelfieVerificationStatus.VERIFIED
        selfie_record = existing_selfie
    else:
        selfie_record = SelfieVerification(
            application_id=application.id,
            storage_key=storage_key,
            verification_type=data.verification_type,
            status=SelfieVerificationStatus.VERIFIED,
        )
        db.add(selfie_record)

    # 3. Audit Log
    record_audit_log(
        db=db,
        actor_id=user.id,
        application_id=application.id,
        action="SELFIE_VERIFIED",
        metadata={"verification_type": data.verification_type.value},
    )

    db.commit()
    db.refresh(selfie_record)

    # Check overall verification completion
    check_and_update_verification_completion(db, user, application)

    return SelfieResponse.model_validate(selfie_record)


def get_selfie(
    db: Session,
    user: User,
    application_id: uuid.UUID,
) -> SelfieResponse:
    """
    Retrieve selfie verification status.
    """
    application = get_loan_application(db, user, application_id)

    selfie_record = db.execute(
        select(SelfieVerification).where(SelfieVerification.application_id == application.id)
    ).scalar_one_or_none()

    if not selfie_record:
        raise NotFoundError("Selfie verification record not found.")

    return SelfieResponse.model_validate(selfie_record)


# ==============================================================================
# 4. Declaration Acceptance
# ==============================================================================

def submit_declaration(
    db: Session,
    user: User,
    application_id: uuid.UUID,
    data: DeclarationSubmitRequest,
    ip_address: str = "127.0.0.1",
) -> DeclarationResponse:
    """
    Accept legal loan application declaration and check overall pipeline completion.
    """
    application = get_loan_application(db, user, application_id)
    verify_application_can_start_verification(application)

    if not data.accepted:
        raise ValidationError("Declaration terms must be explicitly accepted.")

    # 1. Create or update Declaration record
    existing_dec = db.execute(
        select(Declaration).where(Declaration.application_id == application.id)
    ).scalar_one_or_none()

    if existing_dec:
        existing_dec.accepted = True
        existing_dec.declaration_version = data.declaration_version
        existing_dec.accepted_at = datetime.now(timezone.utc)
        existing_dec.ip_address = ip_address
        dec_record = existing_dec
    else:
        dec_record = Declaration(
            application_id=application.id,
            accepted=True,
            declaration_version=data.declaration_version,
            accepted_at=datetime.now(timezone.utc),
            ip_address=ip_address,
        )
        db.add(dec_record)

    # 2. Audit Log
    record_audit_log(
        db=db,
        actor_id=user.id,
        application_id=application.id,
        action="DECLARATION_ACCEPTED",
        metadata={"version": data.declaration_version, "ip": ip_address},
    )

    db.commit()
    db.refresh(dec_record)

    # Check overall verification completion
    check_and_update_verification_completion(db, user, application)

    return DeclarationResponse.model_validate(dec_record)


def get_declaration(
    db: Session,
    user: User,
    application_id: uuid.UUID,
) -> DeclarationResponse:
    """
    Retrieve declaration acceptance status.
    """
    application = get_loan_application(db, user, application_id)

    dec_record = db.execute(
        select(Declaration).where(Declaration.application_id == application.id)
    ).scalar_one_or_none()

    if not dec_record:
        raise NotFoundError("Declaration not found for this application.")

    return DeclarationResponse.model_validate(dec_record)


# ==============================================================================
# 5. Verification Summary & Completion Orchestrator
# ==============================================================================

def get_verification_summary(
    db: Session,
    user: User,
    application_id: uuid.UUID,
) -> VerificationSummaryResponse:
    """
    Calculate consolidated verification summary across all 4 requirements.
    """
    application = get_loan_application(db, user, application_id)

    # Check KYC
    kyc_exists = db.execute(
        select(KYCDetail.id).where(KYCDetail.user_id == user.id)
    ).scalar_one_or_none()
    kyc_status = "VERIFIED" if kyc_exists else "NOT_STARTED"

    # Check Bank Account
    bank_exists = db.execute(
        select(BankAccount.id).where(BankAccount.application_id == application.id)
    ).scalar_one_or_none()
    bank_status = "VERIFIED" if bank_exists else "NOT_STARTED"

    # Check Selfie
    selfie = db.execute(
        select(SelfieVerification).where(SelfieVerification.application_id == application.id)
    ).scalar_one_or_none()
    selfie_status = selfie.status.value if selfie else "NOT_STARTED"

    # Check Declaration
    declaration = db.execute(
        select(Declaration).where(Declaration.application_id == application.id)
    ).scalar_one_or_none()
    dec_status = "ACCEPTED" if (declaration and declaration.accepted) else "NOT_STARTED"

    all_done = (
        kyc_status == "VERIFIED"
        and bank_status == "VERIFIED"
        and selfie_status == "VERIFIED"
        and dec_status == "ACCEPTED"
    )

    any_started = any(
        s not in ("NOT_STARTED",) for s in (kyc_status, bank_status, selfie_status, dec_status)
    )

    if all_done:
        overall_status = "COMPLETED"
    elif any_started:
        overall_status = "IN_PROGRESS"
    else:
        overall_status = "NOT_STARTED"

    return VerificationSummaryResponse(
        application_id=application.id,
        status=overall_status,
        kyc=kyc_status,
        bank_account=bank_status,
        selfie=selfie_status,
        declaration=dec_status,
        is_ready_for_review=all_done,
    )


def check_and_update_verification_completion(
    db: Session,
    user: User,
    application: LoanApplication,
):
    """
    If all 4 verification steps are complete, transition application status to UNDER_REVIEW.
    """
    summary = get_verification_summary(db, user, application.id)
    if summary.status == "COMPLETED" and application.status != ApplicationStatus.UNDER_REVIEW:
        old_status = application.status.value
        application.status = ApplicationStatus.UNDER_REVIEW
        db.add(application)

        record_audit_log(
            db=db,
            actor_id=user.id,
            application_id=application.id,
            action="VERIFICATION_COMPLETED",
            old_status=old_status,
            new_status=ApplicationStatus.UNDER_REVIEW.value,
            metadata={"completion_timestamp": datetime.now(timezone.utc).isoformat()},
        )
        db.commit()
        db.refresh(application)
