"""
Disbursement Service.

Encapsulates deterministic mock disbursement lifecycle, unique reference generation,
state transition validation (APPROVED -> DISBURSEMENT_PROCESSING -> DISBURSED),
audit logging, and multi-entity composite responses.
"""

from datetime import datetime, timezone
from decimal import Decimal
import uuid
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models.bank import BankAccount
from app.models.disbursement import Disbursement, DisbursementStatus
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.offer import LoanOffer, OfferStatus
from app.models.review import AdminReview, ReviewDecision
from app.models.user import User, UserRole
from app.schemas.disbursement import DisbursementDetailResponse, DisbursementResponse
from app.services.verification_service import record_audit_log


def generate_disbursement_reference(db: Session) -> str:
    """
    Generate a unique, human-readable disbursement reference number.
    Format: EZF-DIS-YYYY-XXXXXX (e.g. EZF-DIS-2026-000001)
    """
    current_year = datetime.now(timezone.utc).year
    prefix = f"EZF-DIS-{current_year}-"

    count_stmt = select(func.count(Disbursement.id)).where(
        Disbursement.transaction_reference.like(f"{prefix}%")
    )
    current_count = db.execute(count_stmt).scalar() or 0

    next_seq = current_count + 1
    ref_num = f"{prefix}{next_seq:06d}"

    while db.execute(
        select(Disbursement.id).where(Disbursement.transaction_reference == ref_num)
    ).scalar_one_or_none():
        next_seq += 1
        ref_num = f"{prefix}{next_seq:06d}"

    return ref_num


def initiate_disbursement(
    db: Session,
    admin_user: User,
    application_id: uuid.UUID,
    remarks: str | None = None,
) -> DisbursementResponse:
    """
    Initiates loan disbursement for an APPROVED application.
    Transitions status: APPROVED -> DISBURSEMENT_PROCESSING.
    """
    stmt = select(LoanApplication).where(LoanApplication.id == application_id)
    app = db.execute(stmt).scalar_one_or_none()
    if not app:
        raise NotFoundError(f"Loan application with ID {application_id} not found.")

    # 1. State machine validation
    if app.status != ApplicationStatus.APPROVED:
        raise ConflictError(
            f"Cannot initiate disbursement for application in '{app.status.value}' state. "
            "Only 'APPROVED' applications can be disbursed."
        )

    # 2. Prevent duplicate active or successful disbursements
    existing_disbursement = db.execute(
        select(Disbursement).where(
            Disbursement.application_id == app.id,
            Disbursement.status.in_([DisbursementStatus.INITIATED, DisbursementStatus.SUCCESS]),
        )
    ).scalar_one_or_none()
    if existing_disbursement:
        raise ConflictError(
            f"A disbursement ({existing_disbursement.transaction_reference}) already exists for this application."
        )

    # 3. Retrieve Selected Offer & Terms for accurate financial accounting
    offer = db.execute(
        select(LoanOffer).where(
            LoanOffer.application_id == app.id,
            LoanOffer.status == OfferStatus.SELECTED,
        )
    ).scalar_one_or_none()

    approved_amount = offer.principal if offer else (app.requested_amount or Decimal("100000.00"))
    processing_fee = offer.processing_fee if offer else Decimal("0.00")
    gst = offer.gst if offer else Decimal("0.00")
    
    # Net amount calculation: Principal - Deductions
    selected_term = offer.terms[0] if (offer and offer.terms) else None
    net_amount = (
        selected_term.net_disbursement
        if selected_term and selected_term.net_disbursement
        else (approved_amount - processing_fee - gst)
    )

    # 4. Retrieve Destination Bank Account
    bank_account = db.execute(
        select(BankAccount).where(BankAccount.application_id == app.id)
    ).scalar_one_or_none()

    bank_summary = (
        f"{bank_account.bank_name} (A/C: *******{bank_account.account_number_last4}, IFSC: {bank_account.ifsc})"
        if bank_account
        else "Disbursement Bank Account"
    )

    # 5. Create Disbursement record
    disbursement_ref = generate_disbursement_reference(db)
    disbursement = Disbursement(
        application_id=app.id,
        amount=approved_amount,
        net_amount=net_amount,
        bank_account_id=bank_account.id if bank_account else None,
        destination_account_summary=bank_summary,
        status=DisbursementStatus.INITIATED,
        transaction_reference=disbursement_ref,
    )
    db.add(disbursement)

    # 6. Update Application Status
    old_status = app.status.value
    app.status = ApplicationStatus.DISBURSEMENT_PROCESSING
    db.add(app)

    # 7. Audit log event
    record_audit_log(
        db=db,
        actor_id=admin_user.id,
        application_id=app.id,
        action="DISBURSEMENT_INITIATED",
        old_status=old_status,
        new_status=app.status.value,
        metadata={
            "disbursement_reference": disbursement_ref,
            "approved_amount": str(approved_amount),
            "net_amount": str(net_amount),
            "destination_account": bank_summary,
            "remarks": remarks,
            "initiated_by": admin_user.email,
        },
    )

    db.commit()
    db.refresh(disbursement)
    db.refresh(app)

    return DisbursementResponse(
        disbursement_id=disbursement.id,
        application_id=app.id,
        application_number=app.application_number,
        approved_amount=disbursement.amount,
        net_disbursement_amount=disbursement.net_amount or disbursement.amount,
        disbursement_reference=disbursement.transaction_reference,
        destination_account_summary=disbursement.destination_account_summary,
        status=disbursement.status.value,
        application_status=app.status.value,
        initiated_at=disbursement.initiated_at,
        completed_at=disbursement.completed_at,
    )


def confirm_disbursement(
    db: Session,
    admin_user: User,
    application_id: uuid.UUID,
    remarks: str | None = None,
) -> DisbursementResponse:
    """
    Confirms and completes loan disbursement.
    Transitions status: DISBURSEMENT_PROCESSING -> DISBURSED.
    """
    stmt = select(LoanApplication).where(LoanApplication.id == application_id)
    app = db.execute(stmt).scalar_one_or_none()
    if not app:
        raise NotFoundError(f"Loan application with ID {application_id} not found.")

    # 1. State machine validation
    if app.status != ApplicationStatus.DISBURSEMENT_PROCESSING:
        raise ConflictError(
            f"Cannot confirm disbursement for application in '{app.status.value}' state. "
            "Application must be in 'DISBURSEMENT_PROCESSING' state."
        )

    # 2. Fetch active disbursement record
    disbursement = db.execute(
        select(Disbursement)
        .where(
            Disbursement.application_id == app.id,
            Disbursement.status == DisbursementStatus.INITIATED,
        )
        .order_by(desc(Disbursement.initiated_at))
    ).scalar_one_or_none()

    if not disbursement:
        raise NotFoundError(f"No active initiated disbursement found for application {application_id}.")

    # 3. Complete disbursement
    now = datetime.now(timezone.utc)
    disbursement.status = DisbursementStatus.SUCCESS
    disbursement.completed_at = now
    db.add(disbursement)

    # 4. Update Application Status to DISBURSED
    old_status = app.status.value
    app.status = ApplicationStatus.DISBURSED
    db.add(app)

    # 5. Audit log event
    record_audit_log(
        db=db,
        actor_id=admin_user.id,
        application_id=app.id,
        action="DISBURSEMENT_COMPLETED",
        old_status=old_status,
        new_status=app.status.value,
        metadata={
            "disbursement_reference": disbursement.transaction_reference,
            "net_amount": str(disbursement.net_amount or disbursement.amount),
            "completed_at": now.isoformat(),
            "remarks": remarks,
            "confirmed_by": admin_user.email,
        },
    )

    db.commit()
    db.refresh(disbursement)
    db.refresh(app)

    return DisbursementResponse(
        disbursement_id=disbursement.id,
        application_id=app.id,
        application_number=app.application_number,
        approved_amount=disbursement.amount,
        net_disbursement_amount=disbursement.net_amount or disbursement.amount,
        disbursement_reference=disbursement.transaction_reference,
        destination_account_summary=disbursement.destination_account_summary,
        status=disbursement.status.value,
        application_status=app.status.value,
        initiated_at=disbursement.initiated_at,
        completed_at=disbursement.completed_at,
    )


def get_disbursement_details(
    db: Session,
    application_id: uuid.UUID,
    current_user: User,
) -> DisbursementDetailResponse:
    """
    Retrieves composite disbursement and loan lifecycle terms for customer or admin.
    Strictly verifies ownership when called by a customer.
    """
    app = db.execute(
        select(LoanApplication).where(LoanApplication.id == application_id)
    ).scalar_one_or_none()
    if not app:
        raise NotFoundError(f"Loan application with ID {application_id} not found.")

    # Strict customer ownership check
    if current_user.role == UserRole.CUSTOMER and app.user_id != current_user.id:
        raise ForbiddenError("You do not have permission to view disbursement details for this application.")

    # State validation: application must be approved or beyond
    allowed_statuses = [
        ApplicationStatus.APPROVED,
        ApplicationStatus.DISBURSEMENT_PROCESSING,
        ApplicationStatus.DISBURSED,
    ]
    if app.status not in allowed_statuses:
        raise ConflictError(
            f"Disbursement details are only available once an application is approved. Current status: '{app.status.value}'."
        )

    # 1. Fetch Selected Offer & Term
    offer = db.execute(
        select(LoanOffer).where(
            LoanOffer.application_id == app.id,
            LoanOffer.status == OfferStatus.SELECTED,
        )
    ).scalar_one_or_none()

    term = offer.terms[0] if (offer and offer.terms) else None
    approved_amount = offer.principal if offer else (app.requested_amount or Decimal("0.00"))
    processing_fee = offer.processing_fee if offer else Decimal("0.00")
    gst = offer.gst if offer else Decimal("0.00")
    net_amount = (
        term.net_disbursement
        if term and term.net_disbursement
        else (approved_amount - processing_fee - gst)
    )

    # 2. Fetch Destination Bank Account
    bank_account = db.execute(
        select(BankAccount).where(BankAccount.application_id == app.id)
    ).scalar_one_or_none()

    # 3. Fetch Admin Review (Approval details)
    approval_review = db.execute(
        select(AdminReview)
        .where(
            AdminReview.application_id == app.id,
            AdminReview.decision == ReviewDecision.APPROVED,
        )
        .order_by(desc(AdminReview.created_at))
    ).scalar_one_or_none()

    # 4. Fetch Disbursement Record
    disbursement = db.execute(
        select(Disbursement)
        .where(Disbursement.application_id == app.id)
        .order_by(desc(Disbursement.initiated_at))
    ).scalar_one_or_none()

    return DisbursementDetailResponse(
        application_id=app.id,
        application_number=app.application_number,
        application_status=app.status.value,
        approved_amount=approved_amount,
        net_disbursement_amount=disbursement.net_amount if (disbursement and disbursement.net_amount) else net_amount,
        selected_offer_id=offer.id if offer else None,
        interest_rate=offer.interest_rate if offer else None,
        tenure_months=term.tenure_months if term else app.requested_tenure_months,
        emi=term.emi if term else None,
        processing_fee=processing_fee,
        gst=gst,
        total_interest=term.total_interest if term else None,
        total_repayment=term.total_repayment if term else None,
        approval_date=approval_review.created_at if approval_review else None,
        reviewed_by=approval_review.admin.email if (approval_review and approval_review.admin) else None,
        disbursement_id=disbursement.id if disbursement else None,
        disbursement_reference=disbursement.transaction_reference if disbursement else None,
        disbursement_status=disbursement.status.value if disbursement else None,
        destination_bank_name=bank_account.bank_name if bank_account else None,
        destination_account_last4=bank_account.account_number_last4 if bank_account else None,
        destination_ifsc=bank_account.ifsc if bank_account else None,
        account_holder_name=bank_account.account_holder_name if bank_account else None,
        initiated_at=disbursement.initiated_at if disbursement else None,
        completed_at=disbursement.completed_at if disbursement else None,
        failure_reason=disbursement.failure_reason if disbursement else None,
    )
