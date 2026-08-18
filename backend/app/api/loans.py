"""
Loan Application API Endpoints.

Provides authenticated customer endpoints to create, list, view, update,
submit personal loan applications, run eligibility assessments, and select loan offers.
"""

import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.eligibility import EligibilityCheckResponse
from app.schemas.loan import (
    LoanApplicationCreate,
    LoanApplicationListResponse,
    LoanApplicationResponse,
    LoanApplicationUpdate,
)
from app.schemas.offer import LoanOfferListResponse, LoanOfferResponse
from app.services.eligibility_service import run_and_persist_eligibility
from app.services.loan_service import (
    create_loan_application,
    get_loan_application,
    list_loan_applications,
    submit_loan_application,
    update_loan_draft,
)
from app.services.offer_service import get_application_offers, select_application_offer

router = APIRouter(prefix="/loans/applications", tags=["loans"])


@router.post(
    "",
    response_model=LoanApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new loan application draft",
)
def create_application(
    payload: LoanApplicationCreate = LoanApplicationCreate(),
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> LoanApplicationResponse:
    """
    Create a new loan application belonging to the authenticated customer.
    Starts in DRAFT state with a backend-generated application number.
    """
    application = create_loan_application(db, current_user, payload)
    return LoanApplicationResponse.model_validate(application)


@router.get(
    "",
    response_model=LoanApplicationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List loan applications for current customer",
)
def list_applications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> LoanApplicationListResponse:
    """
    Retrieve all loan applications belonging to the authenticated customer, sorted newest first.
    """
    items, total = list_loan_applications(db, current_user, skip=skip, limit=limit)
    return LoanApplicationListResponse(
        items=[LoanApplicationResponse.model_validate(app) for app in items],
        total=total,
    )


@router.get(
    "/{application_id}",
    response_model=LoanApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get loan application details by ID",
)
def get_application_by_id(
    application_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> LoanApplicationResponse:
    """
    Retrieve details of a specific loan application.
    Enforces ownership: returns 404 if not found or if owned by another customer.
    """
    application = get_loan_application(db, current_user, application_id)
    return LoanApplicationResponse.model_validate(application)


@router.patch(
    "/{application_id}",
    response_model=LoanApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an existing loan application draft",
)
def update_draft(
    application_id: uuid.UUID,
    payload: LoanApplicationUpdate,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> LoanApplicationResponse:
    """
    Update financial or employment details on a DRAFT loan application.
    Returns 409 Conflict if the application has already been submitted.
    """
    application = update_loan_draft(db, current_user, application_id, payload)
    return LoanApplicationResponse.model_validate(application)


@router.post(
    "/{application_id}/submit",
    response_model=LoanApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit loan application for review",
)
def submit_application(
    application_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> LoanApplicationResponse:
    """
    Submit a loan application.
    Validates required fields and transitions status from DRAFT to SUBMITTED.
    """
    application = submit_loan_application(db, current_user, application_id)
    return LoanApplicationResponse.model_validate(application)


# ==============================================================================
# Phase 4: Eligibility & Loan Offers
# ==============================================================================

@router.post(
    "/{application_id}/eligibility",
    response_model=EligibilityCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Run deterministic eligibility assessment",
)
def check_eligibility(
    application_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> EligibilityCheckResponse:
    """
    Evaluate eligibility for a SUBMITTED loan application using deterministic rules.
    Generates explainable decision rationale and, if eligible, multi-tier loan offers.
    """
    check = run_and_persist_eligibility(db, current_user, application_id)
    return EligibilityCheckResponse.model_validate(check)


@router.get(
    "/{application_id}/offers",
    response_model=LoanOfferListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get loan offers for application",
)
def list_offers(
    application_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> LoanOfferListResponse:
    """
    Retrieve generated loan offers with complete financial and repayment schedules.
    """
    offers = get_application_offers(db, current_user, application_id)
    return LoanOfferListResponse(
        application_id=application_id,
        offers=[LoanOfferResponse.model_validate(o) for o in offers],
    )


@router.post(
    "/{application_id}/offers/{offer_id}/select",
    response_model=LoanOfferResponse,
    status_code=status.HTTP_200_OK,
    summary="Select a specific loan offer",
)
def select_offer(
    application_id: uuid.UUID,
    offer_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> LoanOfferResponse:
    """
    Select an offer for the application.
    Marks chosen offer as SELECTED, other offers as EXPIRED, and transitions status to OFFER_SELECTED.
    """
    selected = select_application_offer(db, current_user, application_id, offer_id)
    return LoanOfferResponse.model_validate(selected)
