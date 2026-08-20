"""
Deterministic Eligibility Engine & Loan Offer Generation for EZFINANZ.

Evaluates loan applications using explainable, configurable rules.
Calculates DTI (Debt-to-Income) ratio, creditworthiness score, and structured rationale.
Generates multi-tier loan offers for eligible applicants.
"""

import uuid
from decimal import Decimal
from typing import Tuple
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.models.eligibility import EligibilityCheck, EligibilityStatus
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.offer import LoanOffer, OfferStatus
from app.models.loan_term import LoanTerm
from app.core.config import MIN_LOAN_AMOUNT, MAX_LOAN_AMOUNT
from app.models.user import User
from app.services.financial_service import calculate_offer_financials, quantize_currency, quantize_ratio
from app.services.loan_service import get_loan_application

# ==============================================================================
# Configurable Underwriting Rules
# ==============================================================================
MIN_MONTHLY_INCOME = Decimal("15000.00")
MAX_DTI_RATIO = Decimal("0.50")  # 50% max DTI
MAX_LOAN_TO_INCOME_MULTIPLIER = Decimal("30.0")  # Max loan amount <= 30x monthly income
MIN_TENURE_MONTHS = 6
MAX_TENURE_MONTHS = 60


def evaluate_application_eligibility(
    application: LoanApplication,
) -> Tuple[EligibilityStatus, Decimal, Decimal, list[str]]:
    """
    Deterministic rule-based eligibility evaluation.
    Returns: (status, score, dti_ratio, explainable_reasons)
    """
    income = quantize_currency(Decimal(str(application.monthly_income or "0")))
    debt = quantize_currency(Decimal(str(application.existing_debt or "0")))
    requested_amount = quantize_currency(Decimal(str(application.requested_amount or "0")))
    tenure = application.requested_tenure_months or 36

    # 1. Calculate DTI
    if income > 0:
        dti_raw = debt / income
    else:
        dti_raw = Decimal("1.0")
    dti = quantize_ratio(dti_raw)

    # 2. Evaluate Underwriting Rules
    failures = []
    positive_reasons = []

    # Rule A: Minimum Income
    if income < MIN_MONTHLY_INCOME:
        failures.append(
            f"Monthly income (₹{income:,.2f}) is below the minimum required threshold of ₹{MIN_MONTHLY_INCOME:,.2f}."
        )
    else:
        positive_reasons.append(
            f"Monthly income (₹{income:,.2f}) meets the minimum threshold requirement (₹{MIN_MONTHLY_INCOME:,.2f})."
        )

    # Rule B: Debt-To-Income (DTI) Ratio
    if dti > MAX_DTI_RATIO:
        failures.append(
            f"Debt-to-income ratio ({dti * 100:.1f}%) exceeds the maximum permitted threshold of {MAX_DTI_RATIO * 100:.0f}%."
        )
    else:
        positive_reasons.append(
            f"Debt-to-income ratio ({dti * 100:.1f}%) is within the acceptable safety limit (≤ {MAX_DTI_RATIO * 100:.0f}%)."
        )

    # Rule C: Loan Amount Bounds & Affordability
    if requested_amount < MIN_LOAN_AMOUNT or requested_amount > MAX_LOAN_AMOUNT:
        failures.append(
            f"Requested loan amount (₹{requested_amount:,.2f}) is outside permitted lending limits (₹{MIN_LOAN_AMOUNT:,.2f} to ₹{MAX_LOAN_AMOUNT:,.2f})."
        )
    elif requested_amount > (income * MAX_LOAN_TO_INCOME_MULTIPLIER):
        failures.append(
            f"Requested loan amount (₹{requested_amount:,.2f}) exceeds maximum borrowing capacity relative to monthly income."
        )
    else:
        positive_reasons.append(
            f"Requested loan amount (₹{requested_amount:,.2f}) is within approved affordability limits."
        )

    # Rule D: Tenure Bounds
    if tenure < MIN_TENURE_MONTHS or tenure > MAX_TENURE_MONTHS:
        failures.append(
            f"Requested tenure ({tenure} months) is outside standard limits ({MIN_TENURE_MONTHS} to {MAX_TENURE_MONTHS} months)."
        )
    else:
        positive_reasons.append(
            f"Requested tenure ({tenure} months) satisfies standard lending guidelines."
        )

    # 3. Calculate Credit Score Signal (0-100)
    score_val = 50

    if income >= Decimal("60000.00"):
        score_val += 20
    elif income >= Decimal("40000.00"):
        score_val += 15
    elif income >= MIN_MONTHLY_INCOME:
        score_val += 10
    else:
        score_val -= 20

    if dti <= Decimal("0.20"):
        score_val += 25
    elif dti <= Decimal("0.35"):
        score_val += 15
    elif dti <= MAX_DTI_RATIO:
        score_val += 5
    else:
        score_val -= 30

    if (application.employment_type or "").upper() == "SALARIED":
        score_val += 5

    # Clamp score between 10 and 99
    score_val = max(10, min(99, score_val))
    score = quantize_currency(Decimal(str(score_val)))

    # 4. Final Decision
    if failures:
        status = EligibilityStatus.INELIGIBLE
        reasons = failures
    else:
        status = EligibilityStatus.ELIGIBLE
        reasons = positive_reasons

    return status, score, dti, reasons


def generate_loan_offers_for_application(
    db: Session,
    application: LoanApplication,
) -> list[LoanOffer]:
    """
    Generate 3 distinct loan packages for an eligible application:
    1. Standard / Recommended (Base rate, requested tenure, standard fee)
    2. Low EMI / Flexible (Extended tenure, +1% rate, standard fee)
    3. Fast Payoff / Low Interest (Accelerated tenure, -1% rate, reduced fee)
    """
    # If offers already exist for this application, return existing
    existing_offers = list(
        db.execute(
            select(LoanOffer).where(LoanOffer.application_id == application.id)
        ).scalars().all()
    )
    if existing_offers:
        return existing_offers

    principal = quantize_currency(Decimal(str(application.requested_amount)))
    base_tenure = application.requested_tenure_months or 36

    packages = [
        {
            "name": "Standard Plan",
            "rate": Decimal("12.50"),
            "tenure": base_tenure,
            "fee_pct": Decimal("1.50"),
        },
        {
            "name": "Low Monthly EMI",
            "rate": Decimal("13.50"),
            "tenure": min(base_tenure + 12, 60),
            "fee_pct": Decimal("1.75"),
        },
        {
            "name": "Fast Payoff (Low Total Interest)",
            "rate": Decimal("11.50"),
            "tenure": max(base_tenure - 12, 12),
            "fee_pct": Decimal("1.25"),
        },
    ]

    created_offers = []

    for pkg in packages:
        fin = calculate_offer_financials(
            principal=principal,
            annual_interest_rate_pct=pkg["rate"],
            tenure_months=pkg["tenure"],
            processing_fee_pct=pkg["fee_pct"],
        )

        offer = LoanOffer(
            application_id=application.id,
            principal=fin["principal"],
            interest_rate=fin["annual_interest_rate"],
            processing_fee=fin["processing_fee"],
            gst=fin["gst"],
            other_charges=Decimal("0.00"),
            status=OfferStatus.GENERATED,
        )
        db.add(offer)
        db.flush()

        term = LoanTerm(
            offer_id=offer.id,
            tenure_months=fin["tenure_months"],
            emi=fin["emi"],
            total_interest=fin["total_interest"],
            total_repayment=fin["total_repayment"],
            total_charges=fin["total_charges"],
            net_disbursement=fin["net_disbursement"],
            irr=fin["irr"],
        )
        db.add(term)
        created_offers.append(offer)

    db.commit()

    for o in created_offers:
        db.refresh(o)

    return created_offers


def run_and_persist_eligibility(
    db: Session,
    user: User,
    application_id: uuid.UUID,
) -> EligibilityCheck:
    """
    Run eligibility assessment for a submitted loan application and persist result.
    If ELIGIBLE, automatically generates multi-tier loan offers.
    """
    application = get_loan_application(db, user, application_id)

    # Cannot evaluate DRAFT applications
    if application.status == ApplicationStatus.DRAFT:
        raise ConflictError(
            "Eligibility check cannot be performed on DRAFT applications. Please submit the application first."
        )

    # Evaluate rules
    decision, score, dti, reasons = evaluate_application_eligibility(application)

    # Persist check record
    check = EligibilityCheck(
        application_id=application.id,
        score=score,
        dti_ratio=dti,
        status=decision,
        reasons=reasons,
    )
    db.add(check)

    # Update application status if currently SUBMITTED
    if application.status == ApplicationStatus.SUBMITTED:
        application.status = ApplicationStatus.ELIGIBILITY_CHECKED

    db.commit()
    db.refresh(check)

    # If eligible, generate offers
    if decision == EligibilityStatus.ELIGIBLE:
        generate_loan_offers_for_application(db, application)

    return check
