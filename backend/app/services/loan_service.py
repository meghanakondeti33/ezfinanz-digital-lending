"""
Loan Application Service.

Encapsulates application number generation, draft creation/updating,
strict ownership enforcement, state machine validation, and submission logic.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import MIN_LOAN_AMOUNT, MAX_LOAN_AMOUNT
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.user import User
from app.schemas.loan import LoanApplicationCreate, LoanApplicationUpdate


def generate_application_number(db: Session) -> str:
    """
    Generate a unique, human-readable application number.
    Format: EZF-YYYY-XXXXXX (e.g. EZF-2026-000001)
    """
    current_year = datetime.now(timezone.utc).year
    prefix = f"EZF-{current_year}-"

    # Count existing applications for the current year
    count_stmt = select(func.count(LoanApplication.id)).where(
        LoanApplication.application_number.like(f"{prefix}%")
    )
    current_count = db.execute(count_stmt).scalar() or 0

    next_seq = current_count + 1
    app_num = f"{prefix}{next_seq:06d}"

    # Ensure uniqueness in case of race/deletion
    while db.execute(
        select(LoanApplication.id).where(LoanApplication.application_number == app_num)
    ).scalar_one_or_none():
        next_seq += 1
        app_num = f"{prefix}{next_seq:06d}"

    return app_num


def create_loan_application(
    db: Session,
    user: User,
    data: LoanApplicationCreate,
) -> LoanApplication:
    """
    Create a new loan application in DRAFT state belonging to the authenticated user.
    """
    app_number = generate_application_number(db)

    application = LoanApplication(
        application_number=app_number,
        user_id=user.id,
        status=ApplicationStatus.DRAFT,
        requested_amount=data.requested_amount,
        purpose=data.purpose,
        monthly_income=data.monthly_income,
        employment_type=data.employment_type,
        employer_name=data.employer_name,
        designation=data.designation,
        existing_debt=data.existing_debt,
        requested_tenure_months=data.requested_tenure_months,
    )

    db.add(application)
    db.commit()
    db.refresh(application)

    return application


def get_loan_application(
    db: Session,
    user: User,
    application_id: uuid.UUID,
) -> LoanApplication:
    """
    Retrieve a loan application ensuring strict ownership by the authenticated user.
    Returns 404 if not found or if the application belongs to another user.
    """
    stmt = select(LoanApplication).where(
        LoanApplication.id == application_id,
        LoanApplication.user_id == user.id,
    )
    application = db.execute(stmt).scalar_one_or_none()

    if not application:
        raise NotFoundError("Loan application not found.")

    return application


def list_loan_applications(
    db: Session,
    user: User,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[LoanApplication], int]:
    """
    List all loan applications belonging to the authenticated customer, sorted newest first.
    """
    # Count query
    count_stmt = select(func.count(LoanApplication.id)).where(
        LoanApplication.user_id == user.id
    )
    total = db.execute(count_stmt).scalar() or 0

    # Items query
    items_stmt = (
        select(LoanApplication)
        .where(LoanApplication.user_id == user.id)
        .order_by(LoanApplication.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    items = list(db.execute(items_stmt).scalars().all())

    return items, total


def update_loan_draft(
    db: Session,
    user: User,
    application_id: uuid.UUID,
    data: LoanApplicationUpdate,
) -> LoanApplication:
    """
    Update an existing loan application draft.
    Strictly forbids modifications if the application has already been submitted.
    """
    application = get_loan_application(db, user, application_id)

    if application.status != ApplicationStatus.DRAFT:
        raise ConflictError(
            f"Cannot modify application in '{application.status.value}' state. "
            "Only DRAFT applications may be updated."
        )

    # Update fields that were explicitly passed
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(application, field, value)

    db.add(application)
    db.commit()
    db.refresh(application)

    return application


def submit_loan_application(
    db: Session,
    user: User,
    application_id: uuid.UUID,
) -> LoanApplication:
    """
    Submit a loan application.
    Enforces completeness validation and transitions status from DRAFT to SUBMITTED.
    Idempotent: if already submitted, returns the submitted application without error.
    """
    application = get_loan_application(db, user, application_id)

    # Idempotency check: if already submitted, return cleanly
    if application.status == ApplicationStatus.SUBMITTED:
        return application

    # Only DRAFT can be submitted
    if application.status != ApplicationStatus.DRAFT:
        raise ConflictError(
            f"Application cannot be submitted from '{application.status.value}' state."
        )

    # Validate required fields for submission
    missing_fields = []
    if not application.requested_amount or application.requested_amount < MIN_LOAN_AMOUNT or application.requested_amount > MAX_LOAN_AMOUNT:
        missing_fields.append(
            f"requested_amount (must be between ₹{MIN_LOAN_AMOUNT:,.2f} and ₹{MAX_LOAN_AMOUNT:,.2f})"
        )
    if not application.purpose or not application.purpose.strip():
        missing_fields.append("purpose")
    if not application.monthly_income or application.monthly_income <= 0:
        missing_fields.append("monthly_income (must be greater than 0)")
    if not application.employment_type or not application.employment_type.strip():
        missing_fields.append("employment_type")
    if not application.requested_tenure_months or application.requested_tenure_months <= 0:
        missing_fields.append("requested_tenure_months (must be greater than 0)")

    if missing_fields:
        raise ValidationError(
            f"Cannot submit application. The following required fields are missing or invalid: {', '.join(missing_fields)}"
        )

    # Transition state to SUBMITTED
    application.status = ApplicationStatus.SUBMITTED
    application.submitted_at = datetime.now(timezone.utc)

    db.add(application)
    db.commit()
    db.refresh(application)

    return application
