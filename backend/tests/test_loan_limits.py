"""
Test Suite for Loan Limits (₹10,000 to ₹10,00,000) and Multi-Tier Affordability Evaluation.
"""

import uuid
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.models.loan import ApplicationStatus
from app.models.user import User, UserRole


@pytest.fixture
def customer_user(db_session: Session) -> User:
    """Create a verified test customer."""
    user = User(
        email=f"customer_limits_{uuid.uuid4().hex[:6]}@ezfinanz.com",
        phone=f"98{uuid.uuid4().hex[:8]}",
        password_hash=hash_password("Password@123"),
        role=UserRole.CUSTOMER,
        is_active=True,
        email_verified=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def customer_headers(customer_user: User) -> dict[str, str]:
    """Authorization header with valid customer JWT."""
    token = create_access_token(user_id=customer_user.id, role=customer_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize(
    "valid_amount",
    [
        10000.00,    # ₹10,000
        50000.00,    # ₹50,000
        50001.00,    # ₹50,001
        100000.00,   # ₹1,00,000
        500000.00,   # ₹5,00,000
        1000000.00,  # ₹10,00,000 (System Maximum)
    ],
)
def test_valid_loan_amounts_accepted_by_api(
    client: TestClient,
    customer_headers: dict[str, str],
    valid_amount: float,
):
    """Test that all valid loan amounts between ₹10,000 and ₹10,00,000 are accepted."""
    res = client.post(
        "/api/v1/loans/applications",
        json={"requested_amount": valid_amount, "purpose": "Personal Expense"},
        headers=customer_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert Decimal(str(data["requested_amount"])) == Decimal(str(valid_amount))


@pytest.mark.parametrize(
    "invalid_amount",
    [
        9999.00,      # Below ₹10,000
        0.00,         # Zero
        -5000.00,     # Negative
        1000001.00,   # Above ₹10,00,000
        5000000.00,   # Above ₹10,00,000
    ],
)
def test_invalid_loan_amounts_rejected_by_api(
    client: TestClient,
    customer_headers: dict[str, str],
    invalid_amount: float,
):
    """Test that amounts < ₹10,000 or > ₹10,00,000 are rejected by FastAPI validation with 422."""
    res = client.post(
        "/api/v1/loans/applications",
        json={"requested_amount": invalid_amount, "purpose": "Personal Expense"},
        headers=customer_headers,
    )
    assert res.status_code == 422


def test_customer_affordability_evaluation_500k_loan(
    client: TestClient,
    customer_headers: dict[str, str],
):
    """
    Test customer with:
    Income = ₹75,000
    Existing EMI = ₹10,000
    Requested amount = ₹5,00,000
    Tenure = 24 months

    Must NOT be rejected for exceeding ₹50,000.
    Must be approved through eligibility engine with generated offers.
    """
    # 1. Create and populate application
    create_res = client.post(
        "/api/v1/loans/applications",
        json={
            "requested_amount": 500000.00,
            "purpose": "Home Renovation",
            "monthly_income": 75000.00,
            "employment_type": "SALARIED",
            "employer_name": "Tech Corp Pvt Ltd",
            "designation": "Senior Engineer",
            "existing_debt": 10000.00,
            "requested_tenure_months": 24,
        },
        headers=customer_headers,
    )
    assert create_res.status_code == 201
    app_data = create_res.json()
    app_id = app_data["id"]

    # 2. Submit application
    submit_res = client.post(
        f"/api/v1/loans/applications/{app_id}/submit",
        headers=customer_headers,
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "SUBMITTED"

    # 3. Run Eligibility Engine
    elig_res = client.post(
        f"/api/v1/loans/applications/{app_id}/eligibility",
        headers=customer_headers,
    )
    assert elig_res.status_code == 200
    elig_data = elig_res.json()
    assert elig_data["status"] == "ELIGIBLE"
    assert float(elig_data["score"]) > 60

    # 4. Verify Offers Generated for ₹5,00,000
    offers_res = client.get(
        f"/api/v1/loans/applications/{app_id}/offers",
        headers=customer_headers,
    )
    assert offers_res.status_code == 200
    offers_data = offers_res.json()
    assert len(offers_data["offers"]) >= 1
    assert Decimal(str(offers_data["offers"][0]["principal"])) == Decimal("500000.00")
