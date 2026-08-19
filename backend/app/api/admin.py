"""
Admin Underwriting & Application Review API Endpoints.

All endpoints strictly require ADMIN role authorization.
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminApplicationDetailResponse,
    AdminApplicationQueueResponse,
    AdminDashboardStatsResponse,
    AdminDecisionRequest,
    AdminDecisionResponse,
)
from app.schemas.verification import (
    KYCDocumentReviewRequest,
    SelfieResponse,
    SelfieReviewRequest,
)
from app.services.admin_service import (
    get_admin_application_detail,
    get_admin_application_queue,
    get_admin_dashboard_stats,
    process_admin_underwriting_decision,
)
from app.services.verification_service import review_kyc_document, review_selfie_decision

from app.schemas.disbursement import (
    DisbursementConfirmRequest,
    DisbursementDetailResponse,
    DisbursementInitiateRequest,
    DisbursementResponse,
)
from app.services.disbursement_service import (
    confirm_disbursement,
    get_disbursement_details,
    initiate_disbursement,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/dashboard/stats",
    response_model=AdminDashboardStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get aggregated dashboard statistics",
)
def get_dashboard_statistics(
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AdminDashboardStatsResponse:
    """
    Retrieve application counts by review status for dashboard KPI cards.
    """
    return get_admin_dashboard_stats(db)


@router.get(
    "/applications",
    response_model=AdminApplicationQueueResponse,
    status_code=status.HTTP_200_OK,
    summary="Get application underwriting queue",
)
def list_application_queue(
    status: Optional[str] = Query(None, description="Filter by ApplicationStatus (e.g. UNDER_REVIEW, APPROVED, REJECTED, ALL)"),
    search: Optional[str] = Query(None, description="Search by application number, customer email, or phone"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AdminApplicationQueueResponse:
    """
    List loan applications for admin review queue with filtering, search, and pagination.
    """
    return get_admin_application_queue(db, status_filter=status, search=search, skip=skip, limit=limit)


@router.get(
    "/applications/{application_id}",
    response_model=AdminApplicationDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get detailed application review data",
)
def get_application_review_detail(
    application_id: uuid.UUID,
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AdminApplicationDetailResponse:
    """
    Retrieve full composite details for underwriter assessment.
    """
    return get_admin_application_detail(db, application_id)


@router.post(
    "/applications/{application_id}/decision",
    response_model=AdminDecisionResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit underwriting decision (Approve or Reject)",
)
def submit_underwriting_decision(
    application_id: uuid.UUID,
    payload: AdminDecisionRequest,
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AdminDecisionResponse:
    """
    Approve or Reject a loan application currently in UNDER_REVIEW state.
    """
    return process_admin_underwriting_decision(db, current_admin, application_id, payload)


@router.post(
    "/applications/{application_id}/disbursement/initiate",
    response_model=DisbursementResponse,
    status_code=status.HTTP_200_OK,
    summary="Initiate loan disbursement for approved application",
)
def admin_initiate_disbursement(
    application_id: uuid.UUID,
    payload: DisbursementInitiateRequest = DisbursementInitiateRequest(),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> DisbursementResponse:
    """
    Initiate mock payout and transition status: APPROVED -> DISBURSEMENT_PROCESSING.
    """
    return initiate_disbursement(db, current_admin, application_id, payload.remarks)


@router.post(
    "/applications/{application_id}/disbursement/confirm",
    response_model=DisbursementResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm and complete loan disbursement",
)
def admin_confirm_disbursement(
    application_id: uuid.UUID,
    payload: DisbursementConfirmRequest = DisbursementConfirmRequest(),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> DisbursementResponse:
    """
    Confirm mock payout completion and transition status: DISBURSEMENT_PROCESSING -> DISBURSED.
    """
    return confirm_disbursement(db, current_admin, application_id, payload.remarks)


@router.get(
    "/applications/{application_id}/disbursement",
    response_model=DisbursementDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get complete disbursement and loan terms detail for admin",
)
def admin_get_disbursement_details(
    application_id: uuid.UUID,
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> DisbursementDetailResponse:
    """
    View complete post-approval financial details, schedule, and disbursement logs.
    """
    return get_disbursement_details(db, application_id, current_admin)


@router.post(
    "/applications/{application_id}/selfie/review",
    response_model=SelfieResponse,
    status_code=status.HTTP_200_OK,
    summary="Review customer live photo (Approve or Request Retake)",
)
def admin_review_selfie(
    application_id: uuid.UUID,
    payload: SelfieReviewRequest,
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> SelfieResponse:
    """
    Perform underwriter visual review on customer's live photo.
    """
    return review_selfie_decision(db, current_admin, application_id, payload)


@router.post(
    "/applications/{application_id}/kyc/review",
    status_code=status.HTTP_200_OK,
    summary="Review customer KYC document (Approve or Reject)",
)
def admin_review_kyc_document(
    application_id: uuid.UUID,
    payload: KYCDocumentReviewRequest,
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    """
    Perform underwriter review on customer's uploaded KYC supporting document.
    """
    return review_kyc_document(db, current_admin, application_id, payload.action.value, payload.reason)

