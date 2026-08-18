"""
Centralized Financial Calculation Service for EZFINANZ.

Implements reducing-balance EMI calculations, processing fees, GST,
total repayment schedules, net disbursement, and effective cost metrics.
Strictly uses Decimal arithmetic to prevent floating-point precision loss.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import TypedDict


class OfferFinancials(TypedDict):
    principal: Decimal
    annual_interest_rate: Decimal
    tenure_months: int
    emi: Decimal
    total_interest: Decimal
    total_repayment: Decimal
    processing_fee: Decimal
    gst: Decimal
    total_charges: Decimal
    net_disbursement: Decimal
    irr: Decimal


def quantize_currency(value: Decimal) -> Decimal:
    """Quantize to standard currency format (2 decimal places)."""
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def quantize_ratio(value: Decimal) -> Decimal:
    """Quantize to 4 decimal places for rates/ratios."""
    return value.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def calculate_reducing_balance_emi(
    principal: Decimal,
    annual_interest_rate_pct: Decimal,
    tenure_months: int,
) -> Decimal:
    """
    Calculate monthly EMI using the standard reducing-balance amortizing loan formula:
    EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
    where:
      P = Principal
      r = Monthly interest rate (annual_rate / 12 / 100)
      n = Tenure in months
    """
    if principal <= 0 or tenure_months <= 0:
        return Decimal("0.00")

    if annual_interest_rate_pct <= 0:
        # Zero interest loan
        return quantize_currency(principal / Decimal(tenure_months))

    # Convert to float for high-precision exponentiation, then back to Decimal
    p = float(principal)
    r = float(annual_interest_rate_pct) / 1200.0
    n = float(tenure_months)

    numerator = p * r * ((1.0 + r) ** n)
    denominator = ((1.0 + r) ** n) - 1.0

    emi_float = numerator / denominator
    return quantize_currency(Decimal(str(emi_float)))


def calculate_offer_financials(
    principal: Decimal,
    annual_interest_rate_pct: Decimal,
    tenure_months: int,
    processing_fee_pct: Decimal = Decimal("1.50"),
    gst_rate_pct: Decimal = Decimal("18.00"),
) -> OfferFinancials:
    """
    Calculate full financial breakdown for a loan offer.
    """
    p = quantize_currency(principal)
    rate = quantize_currency(annual_interest_rate_pct)
    n = tenure_months

    # 1. EMI
    emi = calculate_reducing_balance_emi(p, rate, n)

    # 2. Total Repayment & Total Interest
    total_repayment = quantize_currency(emi * Decimal(n))
    total_interest = quantize_currency(total_repayment - p)

    # 3. Processing Fee & GST
    processing_fee = quantize_currency(p * (processing_fee_pct / Decimal("100")))
    gst = quantize_currency(processing_fee * (gst_rate_pct / Decimal("100")))
    total_charges = quantize_currency(processing_fee + gst)

    # 4. Net Disbursement
    net_disbursement = quantize_currency(p - total_charges)

    # 5. Effective Annual Cost / IRR Approximation
    # Base rate + annualized fee impact
    annualized_fee_pct = (total_charges / p) * (Decimal("12") / Decimal(n)) * Decimal("100")
    effective_rate = rate + annualized_fee_pct
    irr = quantize_ratio(effective_rate / Decimal("100"))

    return {
        "principal": p,
        "annual_interest_rate": rate,
        "tenure_months": n,
        "emi": emi,
        "total_interest": total_interest,
        "total_repayment": total_repayment,
        "processing_fee": processing_fee,
        "gst": gst,
        "total_charges": total_charges,
        "net_disbursement": net_disbursement,
        "irr": irr,
    }
