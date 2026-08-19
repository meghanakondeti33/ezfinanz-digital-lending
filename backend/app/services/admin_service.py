"""
Admin Underwriting & Application Review Service for EZFINANZ.

Provides queue querying, full composite application review inspection,
strict state-machine-governed approval/rejection decisions, and audit logging.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.review import AdminReview, ReviewDecision
from app.models.audit import AuditLog
from app.models.bank import BankAccount
from app.models.declaration import Declaration
from app.models.eligibility import EligibilityCheck
from app.models.kyc import KYCDetail
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.offer import LoanOffer, OfferStatus
from app.models.selfie import SelfieVerification
from app.models.user import User
from app.schemas.admin import (
    AdminApplicationDetailResponse,
    AdminApplicationQueueItem,
    AdminApplicationQueueResponse,
    AdminCustomerProfile,
    AdminDashboardStatsResponse,
    AdminDecisionRequest,
    AdminDecisionResponse,
    AdminEligibilityDetails,
    AdminLoanDetails,
    AdminReviewAuditLogItem,
    AdminReviewItem,
    AdminSelectedOfferDetails,
    AdminVerificationDetails,
)
from app.schemas.verification import (
    BankAccountResponse,
    DeclarationResponse,
    KYCResponse,
    SelfieResponse,
)
from app.services.verification_service import get_verification_summary, record_audit_log


def get_admin_dashboard_stats(db: Session) -> AdminDashboardStatsResponse:
    """
    Get aggregated counts for admin dashboard tiles.
    """
    total = db.execute(select(func.count(LoanApplication.id))).scalar_one() or 0
    under_review = db.execute(
        select(func.count(LoanApplication.id)).where(LoanApplication.status == ApplicationStatus.UNDER_REVIEW)
    ).scalar_one() or 0
    approved = db.execute(
        select(func.count(LoanApplication.id)).where(LoanApplication.status == ApplicationStatus.APPROVED)
    ).scalar_one() or 0
    rejected = db.execute(
        select(func.count(LoanApplication.id)).where(LoanApplication.status == ApplicationStatus.REJECTED)
    ).scalar_one() or 0
    other = total - (under_review + approved + rejected)

    return AdminDashboardStatsResponse(
        total_applications=total,
        under_review_count=under_review,
        approved_count=approved,
        rejected_count=rejected,
        other_count=other,
    )


def get_admin_application_queue(
    db: Session,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> AdminApplicationQueueResponse:
    """
    Retrieve application queue with customer info, selected offers, and verification summary.
    """
    query = (
        select(LoanApplication)
        .join(User, LoanApplication.user_id == User.id)
        .options(
            joinedload(LoanApplication.user),
            joinedload(LoanApplication.eligibility_checks),
            joinedload(LoanApplication.offers).joinedload(LoanOffer.terms),
        )
    )

    if status_filter and status_filter.upper() != "ALL":
        try:
            status_enum = ApplicationStatus(status_filter.upper())
            query = query.where(LoanApplication.status == status_enum)
        except ValueError:
            pass

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                LoanApplication.application_number.ilike(term),
                User.email.ilike(term),
                User.phone.ilike(term),
            )
        )

    # Count total matching query
    count_query = select(func.count()).select_from(query.subquery())
    total = db.execute(count_query).scalar_one() or 0

    # Paginate and order by newest first
    query = query.order_by(LoanApplication.updated_at.desc()).offset(skip).limit(limit)
    applications = list(db.execute(query).unique().scalars().all())

    items: list[AdminApplicationQueueItem] = []
    for app in applications:
        # Customer full name from KYC if exists
        kyc = db.execute(
            select(KYCDetail).where(KYCDetail.user_id == app.user_id)
        ).scalar_one_or_none()
        customer_name = kyc.full_name if kyc else None

        # Eligibility check
        eligibility = app.eligibility_checks[-1] if app.eligibility_checks else None
        el_status = eligibility.status.value if eligibility else None
        el_score = Decimal(str(eligibility.score)) if (eligibility and eligibility.score) else None

        # Selected offer
        selected_offer = next((o for o in app.offers if o.status == OfferStatus.SELECTED), None)
        selected_term = selected_offer.terms[0] if (selected_offer and selected_offer.terms) else None

        # Verification status
        verif_summary = get_verification_summary(db, app.user, app.id)

        items.append(
            AdminApplicationQueueItem(
                id=app.id,
                application_number=app.application_number,
                customer_name=customer_name,
                customer_email=app.user.email,
                customer_phone=app.user.phone,
                requested_amount=Decimal(str(app.requested_amount)) if app.requested_amount else None,
                purpose=app.purpose,
                status=app.status.value,
                eligibility_status=el_status,
                eligibility_score=el_score,
                selected_offer_amount=Decimal(str(selected_offer.principal)) if selected_offer else None,
                selected_offer_rate=Decimal(str(selected_offer.interest_rate)) if selected_offer else None,
                selected_offer_emi=Decimal(str(selected_term.emi)) if selected_term else None,
                verification_status=verif_summary.status,
                created_at=app.created_at,
                updated_at=app.updated_at,
            )
        )

    return AdminApplicationQueueResponse(total=total, applications=items)


def get_admin_application_detail(
    db: Session,
    application_id: uuid.UUID,
) -> AdminApplicationDetailResponse:
    """
    Retrieve full composite details for underwriter review.
    """
    query = (
        select(LoanApplication)
        .where(LoanApplication.id == application_id)
        .options(
            joinedload(LoanApplication.user),
            joinedload(LoanApplication.eligibility_checks),
            joinedload(LoanApplication.offers).joinedload(LoanOffer.terms),
            joinedload(LoanApplication.bank_accounts),
            joinedload(LoanApplication.declarations),
            joinedload(LoanApplication.selfie_verifications),
            joinedload(LoanApplication.admin_reviews).joinedload(AdminReview.admin),
            joinedload(LoanApplication.audit_logs).joinedload(AuditLog.actor),
        )
    )
    app = db.execute(query).unique().scalar_one_or_none()
    if not app:
        raise NotFoundError(f"Loan application with ID {application_id} not found.")

    # 1. Customer profile & KYC
    kyc = db.execute(
        select(KYCDetail).where(KYCDetail.user_id == app.user_id)
    ).scalar_one_or_none()

    customer_profile = AdminCustomerProfile(
        user_id=app.user.id,
        email=app.user.email,
        phone=app.user.phone,
        full_name=kyc.full_name if kyc else None,
    )

    # 2. Loan details
    loan_details = AdminLoanDetails(
        requested_amount=Decimal(str(app.requested_amount)) if app.requested_amount else None,
        purpose=app.purpose,
        monthly_income=Decimal(str(app.monthly_income)) if app.monthly_income else None,
        employment_type=app.employment_type,
        employer_name=app.employer_name,
        existing_debt=Decimal(str(app.existing_debt)) if app.existing_debt else None,
        requested_tenure_months=app.requested_tenure_months,
    )

    # 3. Eligibility details
    latest_el = app.eligibility_checks[-1] if app.eligibility_checks else None
    eligibility_details = None
    if latest_el:
        eligibility_details = AdminEligibilityDetails(
            status=latest_el.status.value,
            score=Decimal(str(latest_el.score)) if latest_el.score else None,
            dti_ratio=Decimal(str(latest_el.dti_ratio)) if latest_el.dti_ratio else None,
            reasons=latest_el.reasons or [],
            calculated_at=latest_el.calculated_at,
        )

    # 4. Selected offer
    selected_offer = next((o for o in app.offers if o.status == OfferStatus.SELECTED), None)
    selected_term = selected_offer.terms[0] if (selected_offer and selected_offer.terms) else None
    selected_offer_details = None
    if selected_offer and selected_term:
        selected_offer_details = AdminSelectedOfferDetails(
            principal=Decimal(str(selected_offer.principal)),
            interest_rate=Decimal(str(selected_offer.interest_rate)),
            tenure_months=selected_term.tenure_months,
            emi=Decimal(str(selected_term.emi)),
            processing_fee=Decimal(str(selected_offer.processing_fee)),
            gst=Decimal(str(selected_offer.gst)),
            total_charges=Decimal(str(selected_term.total_charges)),
            net_disbursement=Decimal(str(selected_term.net_disbursement)),
            total_interest=Decimal(str(selected_term.total_interest)),
            total_repayment=Decimal(str(selected_term.total_repayment)),
        )

    # 5. Verification details
    verif_summary = get_verification_summary(db, app.user, app.id)
    bank = app.bank_accounts[0] if app.bank_accounts else None
    selfie = app.selfie_verifications[0] if app.selfie_verifications else None
    dec = app.declarations[0] if app.declarations else None

    kyc_resp = None
    if kyc:
        kyc_resp = KYCResponse(
            id=kyc.id,
            user_id=kyc.user_id,
            full_name=kyc.full_name,
            date_of_birth=kyc.date_of_birth,
            gender=kyc.gender,
            address_line_1=kyc.address_line_1,
            address_line_2=kyc.address_line_2,
            city=kyc.city,
            state=kyc.state,
            pincode=kyc.pincode,
            id_type=kyc.id_type,
            id_number_masked="XXXX-XXXX-****",
            status="VERIFIED",
            created_at=kyc.created_at,
        )

    bank_resp = None
    if bank:
        bank_resp = BankAccountResponse(
            id=bank.id,
            application_id=bank.application_id,
            account_holder_name=bank.account_holder_name,
            account_number_masked=f"XXXXXX{bank.account_number_last4}",
            account_number_last4=bank.account_number_last4,
            ifsc=bank.ifsc,
            bank_name=bank.bank_name,
            status="VERIFIED",
            created_at=bank.created_at,
        )

    selfie_resp = None
    if selfie:
        selfie_resp = SelfieResponse.model_validate(selfie)

    dec_resp = None
    if dec:
        dec_resp = DeclarationResponse.model_validate(dec)

    verification_details = AdminVerificationDetails(
        status=verif_summary.status,
        kyc=kyc_resp,
        bank_account=bank_resp,
        selfie=selfie_resp,
        declaration=dec_resp,
    )

    # 6. Audit logs history
    audit_logs = [
        AdminReviewAuditLogItem(
            id=log.id,
            action=log.action,
            actor_email=log.actor.email if log.actor else "System",
            old_status=log.old_status,
            new_status=log.new_status,
            metadata=log.metadata_,
            created_at=log.created_at,
        )
        for log in sorted(app.audit_logs, key=lambda x: x.created_at, reverse=True)
    ]

    # 7. Past admin reviews
    admin_reviews = [
        AdminReviewItem(
            id=rev.id,
            admin_email=rev.admin.email if rev.admin else "Unknown Admin",
            decision=rev.decision.value,
            remarks=rev.remarks,
            created_at=rev.created_at,
        )
        for rev in sorted(app.admin_reviews, key=lambda x: x.created_at, reverse=True)
    ]

    return AdminApplicationDetailResponse(
        id=app.id,
        application_number=app.application_number,
        status=app.status.value,
        created_at=app.created_at,
        updated_at=app.updated_at,
        submitted_at=app.submitted_at,
        customer=customer_profile,
        loan_details=loan_details,
        eligibility=eligibility_details,
        selected_offer=selected_offer_details,
        verification=verification_details,
        audit_logs=audit_logs,
        admin_reviews=admin_reviews,
    )


def process_admin_underwriting_decision(
    db: Session,
    admin_user: User,
    application_id: uuid.UUID,
    data: AdminDecisionRequest,
) -> AdminDecisionResponse:
    """
    Process APPROVE or REJECT underwriting decision on an application in UNDER_REVIEW state.
    """
    app = db.execute(
        select(LoanApplication).where(LoanApplication.id == application_id)
    ).scalar_one_or_none()
    if not app:
        raise NotFoundError(f"Loan application with ID {application_id} not found.")

    # 1. State machine enforcement: Only applications in UNDER_REVIEW can be decided
    if app.status != ApplicationStatus.UNDER_REVIEW:
        raise ConflictError(
            f"Cannot review application in '{app.status.value}' state. "
            "Only applications in 'UNDER_REVIEW' can be approved or rejected."
        )

    # 2. Rejection validation: Reason category is mandatory for rejection
    if data.decision == ReviewDecision.REJECTED:
        if not data.rejection_reason or not data.rejection_reason.strip():
            raise ValidationError("A rejection reason category is required when rejecting an application.")

    old_status = app.status.value
    new_status = (
        ApplicationStatus.APPROVED
        if data.decision == ReviewDecision.APPROVED
        else ApplicationStatus.REJECTED
    )

    combined_remarks = data.remarks or ""
    if data.rejection_reason:
        combined_remarks = f"[{data.rejection_reason}] {combined_remarks}".strip()

    # 3. Create AdminReview record
    review_record = AdminReview(
        application_id=app.id,
        admin_id=admin_user.id,
        decision=data.decision,
        remarks=combined_remarks,
    )
    db.add(review_record)

    # 4. Update application status
    app.status = new_status
    db.add(app)

    # 5. Dispatch structured audit log
    action = (
        "APPLICATION_APPROVED"
        if data.decision == ReviewDecision.APPROVED
        else "APPLICATION_REJECTED"
    )
    record_audit_log(
        db=db,
        actor_id=admin_user.id,
        application_id=app.id,
        action=action,
        old_status=old_status,
        new_status=new_status.value,
        metadata={
            "decision": data.decision.value,
            "rejection_reason": data.rejection_reason,
            "remarks": data.remarks,
            "reviewed_by_admin": admin_user.email,
        },
    )

    db.commit()
    db.refresh(app)
    db.refresh(review_record)

    return AdminDecisionResponse(
        application_id=app.id,
        application_number=app.application_number,
        status=app.status.value,
        decision=review_record.decision.value,
        remarks=review_record.remarks,
        reviewed_at=review_record.created_at,
        reviewed_by=admin_user.email,
    )
