"""
Verification Pipeline Service for EZFINANZ.

Implements KYC, Bank Account, Selfie, and Declaration verification workflows.
Uses modular mock adapters for document, bank, and liveness verification.
Enforces sensitive data hashing & masking, immutable audit logging, and
backend-driven verification state transitions.
"""

import hashlib
import os
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.banks import validate_bank_and_ifsc
from app.core.config import settings
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models.audit import AuditLog
from app.models.bank import BankAccount
from app.models.declaration import Declaration
from app.models.kyc import KYCDetail
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.selfie import SelfieVerification, SelfieVerificationStatus, SelfieVerificationType
from app.models.user import User, UserRole
from app.schemas.verification import (
    BankAccountResponse,
    BankAccountSubmitRequest,
    DeclarationResponse,
    DeclarationSubmitRequest,
    KYCDocumentUploadResponse,
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
        document_status=kyc_record.document_status or "KYC_NOT_SUBMITTED",
        document_filename=kyc_record.document_filename,
        document_rejection_reason=kyc_record.document_rejection_reason,
        document_uploaded_at=kyc_record.document_uploaded_at,
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
        document_status=kyc_record.document_status or "KYC_NOT_SUBMITTED",
        document_filename=kyc_record.document_filename,
        document_rejection_reason=kyc_record.document_rejection_reason,
        document_uploaded_at=kyc_record.document_uploaded_at,
        created_at=kyc_record.created_at,
    )


def upload_kyc_document(
    db: Session,
    user: User,
    application_id: uuid.UUID,
    file_bytes: bytes,
    filename: str,
    content_type: str | None = None,
) -> KYCDocumentUploadResponse:
    """
    Uploads and securely associates a KYC identity document (PDF) with the loan application.
    Validates PDF format (magic bytes) and file size (max 5MB).
    """
    application = get_loan_application(db, user, application_id)
    verify_application_can_start_verification(application)

    # 1. Validate file size (5MB max)
    max_size = 5 * 1024 * 1024
    if len(file_bytes) > max_size:
        raise ValidationError("Document file size exceeds the 5 MB limit.")
    if len(file_bytes) == 0:
        raise ValidationError("Empty file provided. Please upload a valid PDF document.")

    # 2. Validate PDF format (magic bytes check)
    if not file_bytes.startswith(b"%PDF"):
        raise ValidationError("Invalid document format. Only valid PDF identity documents are accepted.")

    # 3. Create storage directory
    kyc_storage_dir = os.path.join(settings.STORAGE_DIR, "kyc_documents")
    os.makedirs(kyc_storage_dir, exist_ok=True)

    # 4. Generate secure unguessable storage filename
    sanitized_filename = os.path.basename(filename) or "kyc_document.pdf"
    unique_key = f"kyc_{application.id}_{uuid.uuid4().hex[:8]}.pdf"
    file_path = os.path.join(kyc_storage_dir, unique_key)

    # 5. Write file to secure storage
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # 6. Update or create KYC record
    kyc_record = db.execute(
        select(KYCDetail).where(KYCDetail.user_id == user.id)
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if kyc_record:
        kyc_record.document_storage_key = unique_key
        kyc_record.document_filename = sanitized_filename
        kyc_record.document_status = "KYC_DOCUMENT_UPLOADED"
        kyc_record.document_rejection_reason = None
        kyc_record.document_uploaded_at = now
    else:
        # If user uploads document before demographic form, create shell KYC entry
        kyc_record = KYCDetail(
            user_id=user.id,
            full_name="Applicant",
            date_of_birth=datetime(1990, 1, 1).date(),
            gender="OTHER",
            address_line_1="Pending Verification",
            city="Pending",
            state="Pending",
            pincode="000000",
            id_type="AADHAAR",
            id_number_hash=hash_sensitive_value("000000000000"),
            document_storage_key=unique_key,
            document_filename=sanitized_filename,
            document_status="KYC_DOCUMENT_UPLOADED",
            document_uploaded_at=now,
        )
        db.add(kyc_record)

    # 7. Audit Log
    record_audit_log(
        db=db,
        actor_id=user.id,
        application_id=application.id,
        action="KYC_DOCUMENT_UPLOADED",
        metadata={"filename": sanitized_filename, "size_bytes": len(file_bytes)},
    )

    db.commit()
    db.refresh(kyc_record)

    return KYCDocumentUploadResponse(
        status=kyc_record.document_status,
        filename=sanitized_filename,
        uploaded_at=now,
        message="KYC supporting document uploaded securely.",
    )


def get_kyc_document_file_path(
    db: Session,
    user: User,
    application_id: uuid.UUID,
) -> tuple[str, str]:
    """
    Validates access and returns (file_path, download_filename) for secure streaming.
    Only the applicant and Credit Officers/Admins are authorized.
    """
    # Check application existence
    stmt = select(LoanApplication).where(LoanApplication.id == application_id)
    application = db.execute(stmt).scalar_one_or_none()
    if not application:
        raise NotFoundError("Loan application not found.")

    # Enforce strict RBAC / Ownership
    if user.role != UserRole.ADMIN and application.user_id != user.id:
        raise ForbiddenError("You are not authorized to view KYC documents for this application.")

    kyc_record = db.execute(
        select(KYCDetail).where(KYCDetail.user_id == application.user_id)
    ).scalar_one_or_none()

    if not kyc_record or not kyc_record.document_storage_key:
        raise NotFoundError("No KYC document has been uploaded for this application.")

    file_path = os.path.join(settings.STORAGE_DIR, "kyc_documents", kyc_record.document_storage_key)
    if not os.path.exists(file_path):
        raise NotFoundError("KYC document file not found on disk.")

    filename = kyc_record.document_filename or "kyc_document.pdf"
    return file_path, filename


def review_kyc_document(
    db: Session,
    admin_user: User,
    application_id: uuid.UUID,
    action: str,
    reason: str | None = None,
) -> dict:
    """
    Credit Officer review of KYC document (APPROVE or REJECT).
    """
    stmt = select(LoanApplication).where(LoanApplication.id == application_id)
    application = db.execute(stmt).scalar_one_or_none()
    if not application:
        raise NotFoundError("Loan application not found.")

    kyc_record = db.execute(
        select(KYCDetail).where(KYCDetail.user_id == application.user_id)
    ).scalar_one_or_none()

    if not kyc_record:
        raise NotFoundError("KYC record not found for this applicant.")

    if action == "APPROVE":
        kyc_record.document_status = "KYC_VERIFIED"
        kyc_record.document_rejection_reason = None
        audit_action = "KYC_DOCUMENT_APPROVED"
    elif action == "REJECT":
        kyc_record.document_status = "KYC_REJECTED"
        kyc_record.document_rejection_reason = reason or "Please upload a clearer, uncropped document."
        audit_action = "KYC_DOCUMENT_REJECTED"
    else:
        raise ValidationError(f"Invalid review action '{action}'. Must be 'APPROVE' or 'REJECT'.")

    record_audit_log(
        db=db,
        actor_id=admin_user.id,
        application_id=application.id,
        action=audit_action,
        metadata={"decision": action, "reason": reason},
    )

    db.commit()
    db.refresh(kyc_record)

    return {
        "status": kyc_record.document_status,
        "rejection_reason": kyc_record.document_rejection_reason,
        "message": f"KYC document has been {action.lower()}d.",
    }


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
    Submit and verify disbursement destination bank account with bank-specific IFSC validation.
    """
    application = get_loan_application(db, user, application_id)
    verify_application_can_start_verification(application)

    # 1. Validate bank-specific IFSC format & prefix
    is_valid_ifsc, ifsc_err = validate_bank_and_ifsc(data.bank_name, data.ifsc)
    if not is_valid_ifsc:
        raise ValidationError(ifsc_err)

    # 2. Run mock bank verification
    is_valid = MockBankAdapter.verify(data.account_number, data.ifsc)
    if not is_valid:
        raise ValidationError("Bank account verification failed. Please check account number and IFSC.")

    # 3. Hash sensitive account number and extract last 4 digits
    acc_clean = data.account_number.strip()
    acc_last4 = acc_clean[-4:]
    acc_hash = hash_sensitive_value(acc_clean)
    acc_masked = mask_bank_account_number(acc_clean)

    # 4. Create or update BankAccount record for this application
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

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_SELFIE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MIN_SELFIE_SIZE_BYTES = 100


def _validate_image_file(file_bytes: bytes, content_type: str):
    """Validate image content type, size, and magic bytes."""
    if len(file_bytes) < MIN_SELFIE_SIZE_BYTES:
        raise ValidationError("Uploaded selfie image is empty or corrupted.")

    if len(file_bytes) > MAX_SELFIE_SIZE_BYTES:
        raise ValidationError("Selfie image exceeds maximum allowed size of 5MB.")

    norm_type = (content_type or "").lower().strip()
    if norm_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError(f"Unsupported image format '{content_type}'. Please upload JPEG, PNG, or WebP.")

    # Validate Magic Bytes
    is_jpeg = file_bytes.startswith(b"\xff\xd8\xff")
    is_png = file_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    is_webp = file_bytes.startswith(b"RIFF") and b"WEBP" in file_bytes[8:16]

    if not (is_jpeg or is_png or is_webp):
        raise ValidationError("Invalid or unrecognized image binary file data.")


def upload_and_verify_selfie(
    db: Session,
    user: User,
    application_id: uuid.UUID,
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> SelfieResponse:
    """
    Validate, securely store, and submit live photo upload for credit officer review.
    """
    application = get_loan_application(db, user, application_id)
    verify_application_can_start_verification(application)

    _validate_image_file(file_bytes, content_type)

    # 1. Determine storage path
    import os
    from app.core.config import settings

    selfie_dir = os.path.join(settings.STORAGE_DIR, "selfies")
    os.makedirs(selfie_dir, exist_ok=True)

    storage_filename = f"{application.id}_live.jpg"
    file_path = os.path.join(selfie_dir, storage_filename)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    storage_key = f"selfies/{storage_filename}"

    # 2. Simulated liveness verification check
    is_valid = MockSelfieAdapter.verify(storage_key)
    if not is_valid:
        raise ValidationError("Selfie verification failed.")

    # 3. Create or update SelfieVerification record
    existing_selfie = db.execute(
        select(SelfieVerification).where(SelfieVerification.application_id == application.id)
    ).scalar_one_or_none()

    old_status = existing_selfie.status.value if existing_selfie else "NOT_STARTED"

    if existing_selfie:
        existing_selfie.storage_key = storage_key
        existing_selfie.verification_type = SelfieVerificationType.LIVE_PHOTO
        existing_selfie.status = SelfieVerificationStatus.PHOTO_PENDING_REVIEW
        existing_selfie.rejection_reason = None
        existing_selfie.reviewed_by = None
        existing_selfie.reviewed_at = None
        selfie_record = existing_selfie
    else:
        selfie_record = SelfieVerification(
            application_id=application.id,
            storage_key=storage_key,
            verification_type=SelfieVerificationType.LIVE_PHOTO,
            status=SelfieVerificationStatus.PHOTO_PENDING_REVIEW,
            rejection_reason=None,
        )
        db.add(selfie_record)

    # 4. Audit Log
    record_audit_log(
        db=db,
        actor_id=user.id,
        application_id=application.id,
        action="PHOTO_SUBMITTED",
        old_status=old_status,
        new_status=SelfieVerificationStatus.PHOTO_PENDING_REVIEW.value,
        metadata={
            "verification_type": "LIVE_PHOTO",
            "filename": filename,
            "size_bytes": len(file_bytes),
            "content_type": content_type,
        },
    )

    db.commit()
    db.refresh(selfie_record)

    # Check overall verification completion
    check_and_update_verification_completion(db, user, application)

    res = SelfieResponse.model_validate(selfie_record)
    res.photo_url = f"/api/v1/loans/applications/{application.id}/verification/live-photo"
    return res


def get_selfie_photo_file(
    db: Session,
    user: User,
    application_id: uuid.UUID,
) -> tuple[str, str]:
    """
    Retrieve absolute file path and content type for customer selfie.
    Authorizes application owner (customer) and administrative users (credit officers).
    """
    import os
    from app.core.config import settings
    from app.models.user import UserRole
    from app.core.exceptions import ForbiddenError

    application = db.execute(
        select(LoanApplication).where(LoanApplication.id == application_id)
    ).scalar_one_or_none()

    if not application:
        raise NotFoundError("Loan application not found.")

    # Authorization Check
    if user.role != UserRole.ADMIN and application.user_id != user.id:
        raise ForbiddenError("You are not authorized to view this customer live photo.")

    selfie_record = db.execute(
        select(SelfieVerification).where(SelfieVerification.application_id == application.id)
    ).scalar_one_or_none()

    selfie_dir = os.path.join(settings.STORAGE_DIR, "selfies")
    file_path = os.path.join(selfie_dir, f"{application.id}_live.jpg")

    if not os.path.exists(file_path):
        if selfie_record and selfie_record.storage_key:
            # Check relative storage path
            alt_path = os.path.join(settings.STORAGE_DIR, selfie_record.storage_key.replace("selfies/", "selfies" + os.sep))
            if os.path.exists(alt_path):
                return alt_path, "image/jpeg"
        # If simulated photo file is not on disk yet, generate sample placeholder
        os.makedirs(selfie_dir, exist_ok=True)
        # Minimal 1x1 valid JPEG fallback
        valid_jpeg = (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00"
            b"\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f"
            b"\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b"
            b"\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01"
            b"\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01"
            b"\x01\x00\x00?\x00\xbf\x00\xff\xd9"
        )
        with open(file_path, "wb") as f:
            f.write(valid_jpeg)

    return file_path, "image/jpeg"


def review_selfie_decision(
    db: Session,
    admin: User,
    application_id: uuid.UUID,
    data: "SelfieReviewRequest",
) -> SelfieResponse:
    """
    Process Credit Officer's visual live photo verification decision:
    - APPROVE: Marks status as PHOTO_APPROVED and records audit trail.
    - REQUEST_RETAKE: Marks status as PHOTO_RETAKE_REQUIRED with reason and triggers retake.
    """
    from app.models.user import UserRole
    from app.schemas.verification import SelfieReviewAction
    from app.core.exceptions import ForbiddenError

    if admin.role != UserRole.ADMIN:
        raise ForbiddenError("Only administrative credit officers can review customer live photos.")

    application = db.execute(
        select(LoanApplication).where(LoanApplication.id == application_id)
    ).scalar_one_or_none()

    if not application:
        raise NotFoundError("Loan application not found.")

    selfie_record = db.execute(
        select(SelfieVerification).where(SelfieVerification.application_id == application.id)
    ).scalar_one_or_none()

    if not selfie_record:
        raise NotFoundError("Selfie verification record not found for this application.")

    old_status = selfie_record.status.value

    # Record Review Start Audit
    record_audit_log(
        db=db,
        actor_id=admin.id,
        application_id=application.id,
        action="PHOTO_REVIEW_STARTED",
        old_status=old_status,
        new_status=old_status,
        metadata={"reviewer": admin.email},
    )

    if data.action == SelfieReviewAction.APPROVE:
        selfie_record.status = SelfieVerificationStatus.PHOTO_APPROVED
        selfie_record.rejection_reason = None
        selfie_record.reviewed_by = admin.id
        selfie_record.reviewed_at = datetime.now(timezone.utc)
        action_name = "PHOTO_APPROVED"
        new_status = SelfieVerificationStatus.PHOTO_APPROVED.value
    elif data.action == SelfieReviewAction.REQUEST_RETAKE:
        selfie_record.status = SelfieVerificationStatus.PHOTO_RETAKE_REQUIRED
        selfie_record.rejection_reason = data.reason or "Please take a clear photo in good lighting with your face fully visible."
        selfie_record.reviewed_by = admin.id
        selfie_record.reviewed_at = datetime.now(timezone.utc)
        action_name = "PHOTO_RETAKE_REQUESTED"
        new_status = SelfieVerificationStatus.PHOTO_RETAKE_REQUIRED.value
    else:
        raise ValidationError(f"Invalid review action '{data.action}'.")

    # Record Decision Audit Log
    record_audit_log(
        db=db,
        actor_id=admin.id,
        application_id=application.id,
        action=action_name,
        old_status=old_status,
        new_status=new_status,
        metadata={
            "reviewer_id": str(admin.id),
            "reviewer_email": admin.email,
            "reason": selfie_record.rejection_reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    db.commit()
    db.refresh(selfie_record)

    # Check overall verification pipeline completion
    customer_user = db.execute(select(User).where(User.id == application.user_id)).scalar_one()
    check_and_update_verification_completion(db, customer_user, application)

    res = SelfieResponse.model_validate(selfie_record)
    res.photo_url = f"/api/v1/loans/applications/{application.id}/verification/live-photo"
    return res


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

    res = SelfieResponse.model_validate(selfie_record)
    res.photo_url = f"/api/v1/loans/applications/{application.id}/verification/live-photo"
    return res


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

    # Verify KYC identity document is uploaded
    kyc_chk = db.execute(select(KYCDetail).where(KYCDetail.user_id == user.id)).scalar_one_or_none()
    if not kyc_chk or not kyc_chk.document_storage_key:
        raise ValidationError("Please upload your required KYC identity document before continuing.")
    if kyc_chk.document_status == "KYC_REJECTED":
        raise ValidationError("Your KYC identity document was rejected. Please upload a replacement document before continuing.")

    # Verify Live Photo is submitted
    selfie_chk = db.execute(select(SelfieVerification).where(SelfieVerification.application_id == application.id)).scalar_one_or_none()
    if not selfie_chk or not selfie_chk.storage_key:
        raise ValidationError("Please submit your required live photo capture before continuing.")
    if selfie_chk.status == SelfieVerificationStatus.PHOTO_RETAKE_REQUIRED:
        raise ValidationError("A photo retake was requested. Please capture a new live photo before continuing.")

    # Verify Bank Account is submitted
    bank_chk = db.execute(select(BankAccount).where(BankAccount.application_id == application.id)).scalar_one_or_none()
    if not bank_chk:
        raise ValidationError("Please link and verify your destination bank account before continuing.")

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
    kyc = db.execute(
        select(KYCDetail).where(KYCDetail.user_id == user.id)
    ).scalar_one_or_none()
    
    if not kyc:
        kyc_status = "NOT_STARTED"
        has_kyc_doc = False
    elif kyc.document_status in ("KYC_VERIFIED", "VERIFIED", "APPROVED"):
        kyc_status = "VERIFIED"
        has_kyc_doc = bool(kyc.document_storage_key)
    elif kyc.document_status == "KYC_REJECTED":
        kyc_status = "REPLACEMENT_REQUIRED"
        has_kyc_doc = bool(kyc.document_storage_key)
    elif kyc.document_storage_key:
        kyc_status = "PENDING_REVIEW"
        has_kyc_doc = True
    else:
        kyc_status = "DOCUMENT_REQUIRED"
        has_kyc_doc = False

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
    selfie_details = None
    if selfie:
        selfie_details = SelfieResponse.model_validate(selfie)
        selfie_details.photo_url = f"/api/v1/loans/applications/{application.id}/verification/live-photo"

    # Check Declaration
    declaration = db.execute(
        select(Declaration).where(Declaration.application_id == application.id)
    ).scalar_one_or_none()
    dec_status = "ACCEPTED" if (declaration and declaration.accepted) else "NOT_STARTED"

    photo_approved = selfie_status in ("PHOTO_APPROVED", "VERIFIED")
    photo_submitted = selfie_status in ("PHOTO_PENDING_REVIEW", "PHOTO_APPROVED", "VERIFIED")

    all_done = (
        kyc_status == "VERIFIED"
        and bank_status == "VERIFIED"
        and photo_approved
        and dec_status == "ACCEPTED"
    )

    is_ready = (
        has_kyc_doc
        and kyc is not None
        and kyc.document_status != "KYC_REJECTED"
        and bank_status == "VERIFIED"
        and photo_submitted
        and dec_status == "ACCEPTED"
        and selfie_status != "PHOTO_RETAKE_REQUIRED"
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
        selfie_details=selfie_details,
        declaration=dec_status,
        is_ready_for_review=is_ready,
    )


def check_and_update_verification_completion(
    db: Session,
    user: User,
    application: LoanApplication,
):
    """
    If all verification components are submitted and ready, transition application status to UNDER_REVIEW.
    If selfie requires retake, do not mark ready.
    """
    summary = get_verification_summary(db, user, application.id)
    if summary.is_ready_for_review and application.status != ApplicationStatus.UNDER_REVIEW:
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
