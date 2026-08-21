"""
Loan Offer Management & Selection Service.

Enforces ownership, state machine transitions, and exclusive offer selection.
"""

import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ConflictError, NotFoundError
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.offer import LoanOffer, OfferStatus
from app.models.user import User
from app.services.loan_service import get_loan_application


def get_application_offers(
    db: Session,
    user: User,
    application_id: uuid.UUID,
) -> list[LoanOffer]:
    """
    Retrieve all generated loan offers for an application.
    Enforces ownership by the authenticated customer.
    If application is ELIGIBILITY_CHECKED or OFFER_SELECTED but offers are missing, generates them.
    """
    application = get_loan_application(db, user, application_id)

    stmt = (
        select(LoanOffer)
        .where(LoanOffer.application_id == application.id)
        .options(selectinload(LoanOffer.terms))
        .order_by(LoanOffer.interest_rate.asc())
    )
    offers = list(db.execute(stmt).scalars().all())

    if not offers and application.status in (ApplicationStatus.ELIGIBILITY_CHECKED, ApplicationStatus.OFFER_SELECTED):
        from app.models.eligibility import EligibilityCheck, EligibilityStatus
        latest_check = (
            db.execute(
                select(EligibilityCheck)
                .where(EligibilityCheck.application_id == application.id)
                .order_by(EligibilityCheck.calculated_at.desc())
            ).scalars().first()
        )
        if latest_check and latest_check.status == EligibilityStatus.ELIGIBLE:
            from app.services.eligibility_service import generate_loan_offers_for_application
            generate_loan_offers_for_application(db, application)
            offers = list(db.execute(stmt).scalars().all())

    return offers


def select_application_offer(
    db: Session,
    user: User,
    application_id: uuid.UUID,
    offer_id: uuid.UUID,
) -> LoanOffer:
    """
    Select a specific loan offer for the application.
    Transitions application to OFFER_SELECTED and marks other offers as EXPIRED.
    """
    application = get_loan_application(db, user, application_id)

    # Must be in ELIGIBILITY_CHECKED or OFFER_SELECTED state
    if application.status not in (ApplicationStatus.ELIGIBILITY_CHECKED, ApplicationStatus.OFFER_SELECTED):
        raise ConflictError(
            f"Cannot select an offer for application in '{application.status.value}' state. "
            "Application must be evaluated for eligibility first."
        )

    # Fetch all offers for this application with terms
    stmt = (
        select(LoanOffer)
        .where(LoanOffer.application_id == application.id)
        .options(selectinload(LoanOffer.terms))
    )
    all_offers = list(db.execute(stmt).scalars().all())

    selected_offer = None
    for offer in all_offers:
        if offer.id == offer_id:
            selected_offer = offer
            offer.status = OfferStatus.SELECTED
        else:
            offer.status = OfferStatus.EXPIRED

    if not selected_offer:
        raise NotFoundError("Loan offer not found for this application.")

    # Transition application status
    application.status = ApplicationStatus.OFFER_SELECTED

    db.add(application)
    db.commit()
    db.refresh(selected_offer)

    return selected_offer
