"""
Phase 4 Eligibility Engine & Loan Offers Test Suite.
"""

import uuid
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.user import User, UserRole
from app.services.financial_service import calculate_offer_financials, calculate_reducing_balance_emi


@pytest.fixture
def customer_user(db_session: Session) -> User:
    """Create a verified test customer."""
    user = User(
        email=f"eligible_cust_{uuid.uuid4().hex[:6]}@ezfinanz.com",
        phone=f"96{uuid.uuid4().hex[:8]}",
        password_hash=hash_password("Password@123"),
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def other_customer_user(db_session: Session) -> User:
    """Create a second test customer for isolation testing."""
    user = User(
        email=f"other_cust_{uuid.uuid4().hex[:6]}@ezfinanz.com",
        phone=f"95{uuid.uuid4().hex[:8]}",
        password_hash=hash_password("Password@123"),
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def customer_headers(customer_user: User) -> dict[str, str]:
    token = create_access_token(user_id=customer_user.id, role=customer_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_customer_headers(other_customer_user: User) -> dict[str, str]:
    token = create_access_token(user_id=other_customer_user.id, role=other_customer_user.role.value)
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. Financial Calculation Unit Tests
# ==============================================================================

def test_reducing_balance_emi_mathematical_precision():
    """
    Verify reducing-balance EMI calculation matches exact financial mathematics.
    P = 500,000, rate = 12.5% p.a., n = 36 months -> EMI = 16,726.81
    """
    p = Decimal("500000.00")
    rate = Decimal("12.50")
    n = 36

    emi = calculate_reducing_balance_emi(p, rate, n)
    assert emi == Decimal("16726.81")

    fin = calculate_offer_financials(p, rate, n, processing_fee_pct=Decimal("1.50"))
    assert fin["emi"] == Decimal("16726.81")
    assert fin["total_repayment"] == Decimal("602165.16")
    assert fin["total_interest"] == Decimal("102165.16")
    assert fin["processing_fee"] == Decimal("7500.00")
    assert fin["gst"] == Decimal("1350.00")
    assert fin["total_charges"] == Decimal("8850.00")
    assert fin["net_disbursement"] == Decimal("491150.00")


# ==============================================================================
# 2. Eligibility Assessment & Explainable Decision Tests
# ==============================================================================

def test_submitted_application_can_be_evaluated(client: TestClient, customer_headers: dict[str, str]):
    """Verify evaluating a submitted application succeeds and returns ELIGIBLE with score and reasons."""
    # 1. Create and submit eligible application
    payload = {
        "requested_amount": 500000.00,
        "purpose": "Home renovation",
        "monthly_income": 60000.00,
        "employment_type": "SALARIED",
        "employer_name": "Example Technologies",
        "existing_debt": 10000.00,
        "requested_tenure_months": 36,
    }
    create_res = client.post("/api/v1/loans/applications", json=payload, headers=customer_headers)
    app_id = create_res.json()["id"]

    submit_res = client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=customer_headers)
    assert submit_res.status_code == 200

    # 2. Run eligibility check
    el_res = client.post(f"/api/v1/loans/applications/{app_id}/eligibility", headers=customer_headers)
    assert el_res.status_code == 200
    data = el_res.json()

    assert data["status"] == "ELIGIBLE"
    assert Decimal(str(data["score"])) > Decimal("50.00")
    assert Decimal(str(data["dti_ratio"])) == Decimal("0.1667")  # 10000 / 60000 = 0.1667
    assert len(data["reasons"]) > 0
    assert any("Monthly income" in r for r in data["reasons"])
    assert any("Debt-to-income" in r for r in data["reasons"])


def test_draft_application_cannot_be_evaluated(client: TestClient, customer_headers: dict[str, str]):
    """Verify eligibility check on a DRAFT application returns 409 Conflict."""
    create_res = client.post("/api/v1/loans/applications", json={"requested_amount": 100000.00}, headers=customer_headers)
    app_id = create_res.json()["id"]

    el_res = client.post(f"/api/v1/loans/applications/{app_id}/eligibility", headers=customer_headers)
    assert el_res.status_code == 409
    assert "DRAFT" in el_res.json()["error"]["message"]


def test_customer_cannot_evaluate_another_customer_application(
    client: TestClient,
    customer_headers: dict[str, str],
    other_customer_headers: dict[str, str],
):
    """Verify Customer B cannot trigger eligibility on Customer A's application (returns safe 404)."""
    payload = {
        "requested_amount": 300000.00,
        "purpose": "Medical",
        "monthly_income": 50000.00,
        "employment_type": "SALARIED",
        "requested_tenure_months": 24,
    }
    create_res = client.post("/api/v1/loans/applications", json=payload, headers=customer_headers)
    app_id = create_res.json()["id"]
    client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=customer_headers)

    el_res = client.post(f"/api/v1/loans/applications/{app_id}/eligibility", headers=other_customer_headers)
    assert el_res.status_code == 404


def test_ineligible_application_evaluated_correctly(client: TestClient, customer_headers: dict[str, str]):
    """Verify applications with high DTI or low income are evaluated as INELIGIBLE with explainable failure reasons."""
    # High DTI application: income = 30000, existing debt = 20000 (DTI = 66.7% > 50%)
    payload = {
        "requested_amount": 200000.00,
        "purpose": "Travel",
        "monthly_income": 30000.00,
        "employment_type": "SALARIED",
        "existing_debt": 20000.00,
        "requested_tenure_months": 24,
    }
    create_res = client.post("/api/v1/loans/applications", json=payload, headers=customer_headers)
    app_id = create_res.json()["id"]
    client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=customer_headers)

    el_res = client.post(f"/api/v1/loans/applications/{app_id}/eligibility", headers=customer_headers)
    assert el_res.status_code == 200
    data = el_res.json()

    assert data["status"] == "INELIGIBLE"
    assert any("exceeds the maximum permitted threshold" in r for r in data["reasons"])

    # Ineligible application receives 0 offers
    offers_res = client.get(f"/api/v1/loans/applications/{app_id}/offers", headers=customer_headers)
    assert offers_res.status_code == 200
    assert len(offers_res.json()["offers"]) == 0


# ==============================================================================
# 3. Loan Offer Generation & Selection Tests
# ==============================================================================

def test_eligible_application_generates_three_offers(client: TestClient, customer_headers: dict[str, str]):
    """Verify eligible application automatically generates 3 loan packages with complete repayment schedules."""
    payload = {
        "requested_amount": 400000.00,
        "purpose": "Home renovation",
        "monthly_income": 80000.00,
        "employment_type": "SALARIED",
        "existing_debt": 5000.00,
        "requested_tenure_months": 36,
    }
    create_res = client.post("/api/v1/loans/applications", json=payload, headers=customer_headers)
    app_id = create_res.json()["id"]
    client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=customer_headers)
    client.post(f"/api/v1/loans/applications/{app_id}/eligibility", headers=customer_headers)

    # Fetch offers
    offers_res = client.get(f"/api/v1/loans/applications/{app_id}/offers", headers=customer_headers)
    assert offers_res.status_code == 200
    offers = offers_res.json()["offers"]

    assert len(offers) == 3
    for offer in offers:
        assert Decimal(str(offer["principal"])) == Decimal("400000.00")
        assert len(offer["terms"]) == 1
        term = offer["terms"][0]
        assert Decimal(str(term["emi"])) > 0
        assert Decimal(str(term["total_repayment"])) > Decimal(str(offer["principal"]))
        assert Decimal(str(term["net_disbursement"])) < Decimal(str(offer["principal"]))


def test_customer_can_select_an_offer(client: TestClient, customer_headers: dict[str, str]):
    """Verify customer can select one offer, marking it SELECTED and transitioning status to OFFER_SELECTED."""
    payload = {
        "requested_amount": 500000.00,
        "purpose": "Business expansion",
        "monthly_income": 90000.00,
        "employment_type": "BUSINESS",
        "existing_debt": 10000.00,
        "requested_tenure_months": 36,
    }
    create_res = client.post("/api/v1/loans/applications", json=payload, headers=customer_headers)
    app_id = create_res.json()["id"]
    client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=customer_headers)
    client.post(f"/api/v1/loans/applications/{app_id}/eligibility", headers=customer_headers)

    # Get offers
    offers = client.get(f"/api/v1/loans/applications/{app_id}/offers", headers=customer_headers).json()["offers"]
    chosen_offer_id = offers[0]["id"]

    # Select offer
    sel_res = client.post(
        f"/api/v1/loans/applications/{app_id}/offers/{chosen_offer_id}/select",
        headers=customer_headers,
    )
    assert sel_res.status_code == 200
    assert sel_res.json()["status"] == "SELECTED"

    # Verify application status transitioned to OFFER_SELECTED
    app_res = client.get(f"/api/v1/loans/applications/{app_id}", headers=customer_headers)
    assert app_res.json()["status"] == "OFFER_SELECTED"


def test_customer_cannot_select_another_customer_offer(
    client: TestClient,
    customer_headers: dict[str, str],
    other_customer_headers: dict[str, str],
):
    """Verify Customer B cannot select Customer A's offer (returns safe 404)."""
    payload = {
        "requested_amount": 500000.00,
        "purpose": "Education",
        "monthly_income": 70000.00,
        "employment_type": "SALARIED",
        "requested_tenure_months": 24,
    }
    create_res = client.post("/api/v1/loans/applications", json=payload, headers=customer_headers)
    app_id = create_res.json()["id"]
    client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=customer_headers)
    client.post(f"/api/v1/loans/applications/{app_id}/eligibility", headers=customer_headers)

    offers = client.get(f"/api/v1/loans/applications/{app_id}/offers", headers=customer_headers).json()["offers"]
    offer_id = offers[0]["id"]

    sel_res = client.post(
        f"/api/v1/loans/applications/{app_id}/offers/{offer_id}/select",
        headers=other_customer_headers,
    )
    assert sel_res.status_code == 404
