"""
Phase 3 Core Loan Application Workflow Test Suite.
"""

import uuid
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.user import User, UserRole


@pytest.fixture
def customer_user(db_session: Session) -> User:
    """Create a verified test customer."""
    user = User(
        email=f"customer_{uuid.uuid4().hex[:6]}@ezfinanz.com",
        phone=f"98{uuid.uuid4().hex[:8]}",
        password_hash=hash_password("Password@123"),
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def other_customer_user(db_session: Session) -> User:
    """Create a second verified test customer for isolation tests."""
    user = User(
        email=f"other_{uuid.uuid4().hex[:6]}@ezfinanz.com",
        phone=f"97{uuid.uuid4().hex[:8]}",
        password_hash=hash_password("Password@123"),
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def customer_headers(customer_user: User) -> dict[str, str]:
    """Authorization header with valid customer JWT."""
    token = create_access_token(user_id=customer_user.id, role=customer_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_customer_headers(other_customer_user: User) -> dict[str, str]:
    """Authorization header with other customer JWT."""
    token = create_access_token(user_id=other_customer_user.id, role=other_customer_user.role.value)
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. Loan Application Creation Tests
# ==============================================================================

def test_customer_can_create_empty_draft(client: TestClient, customer_headers: dict[str, str]):
    """Verify customer can create a blank draft application."""
    response = client.post("/api/v1/loans/applications", json={}, headers=customer_headers)
    assert response.status_code == 201
    data = response.json()

    assert data["status"] == "DRAFT"
    assert data["application_number"].startswith("EZF-")
    assert "id" in data
    assert data["submitted_at"] is None


def test_customer_can_create_draft_with_initial_data(client: TestClient, customer_headers: dict[str, str]):
    """Verify customer can create a draft pre-populated with loan parameters."""
    payload = {
        "requested_amount": 500000.00,
        "purpose": "Home renovation",
        "monthly_income": 60000.00,
        "employment_type": "SALARIED",
        "employer_name": "Example Tech",
        "existing_debt": 10000.00,
        "requested_tenure_months": 36,
    }
    response = client.post("/api/v1/loans/applications", json=payload, headers=customer_headers)
    assert response.status_code == 201
    data = response.json()

    assert data["status"] == "DRAFT"
    assert Decimal(str(data["requested_amount"])) == Decimal("500000.00")
    assert data["purpose"] == "Home renovation"
    assert Decimal(str(data["monthly_income"])) == Decimal("60000.00")
    assert data["employment_type"] == "SALARIED"
    assert data["requested_tenure_months"] == 36


# ==============================================================================
# 2. Update Draft Tests
# ==============================================================================

def test_customer_can_update_draft(client: TestClient, customer_headers: dict[str, str]):
    """Verify customer can modify an existing DRAFT application."""
    # 1. Create blank draft
    create_res = client.post("/api/v1/loans/applications", json={}, headers=customer_headers)
    app_id = create_res.json()["id"]

    # 2. Update draft
    update_payload = {
        "requested_amount": 350000.00,
        "purpose": "Medical expenses",
        "monthly_income": 75000.00,
        "employment_type": "SALARIED",
        "employer_name": "HealthCorp",
        "requested_tenure_months": 24,
    }
    update_res = client.patch(f"/api/v1/loans/applications/{app_id}", json=update_payload, headers=customer_headers)
    assert update_res.status_code == 200
    updated_data = update_res.json()

    assert Decimal(str(updated_data["requested_amount"])) == Decimal("350000.00")
    assert updated_data["purpose"] == "Medical expenses"
    assert updated_data["employer_name"] == "HealthCorp"
    assert updated_data["status"] == "DRAFT"


def test_customer_can_update_submitted_application(client: TestClient, customer_headers: dict[str, str]):
    """Verify modifying an editable SUBMITTED application updates values."""
    # 1. Create and submit application
    payload = {
        "requested_amount": 200000.00,
        "purpose": "Education",
        "monthly_income": 50000.00,
        "employment_type": "SALARIED",
        "requested_tenure_months": 12,
    }
    create_res = client.post("/api/v1/loans/applications", json=payload, headers=customer_headers)
    app_id = create_res.json()["id"]

    submit_res = client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=customer_headers)
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "SUBMITTED"

    # 2. Update editable application
    patch_res = client.patch(
        f"/api/v1/loans/applications/{app_id}",
        json={"requested_amount": 300000.00},
        headers=customer_headers,
    )
    assert patch_res.status_code == 200
    assert Decimal(str(patch_res.json()["requested_amount"])) == Decimal("300000.00")


def test_customer_cannot_update_under_review_application(
    client: TestClient, customer_headers: dict[str, str], db_session: Session
):
    """Verify modifying an application in UNDER_REVIEW state returns 409 Conflict."""
    payload = {
        "requested_amount": 200000.00,
        "purpose": "Education",
        "monthly_income": 50000.00,
        "employment_type": "SALARIED",
        "requested_tenure_months": 12,
    }
    create_res = client.post("/api/v1/loans/applications", json=payload, headers=customer_headers)
    app_id = uuid.UUID(create_res.json()["id"])

    # Move application to UNDER_REVIEW
    app = db_session.get(LoanApplication, app_id)
    app.status = ApplicationStatus.UNDER_REVIEW
    db_session.commit()

    patch_res = client.patch(
        f"/api/v1/loans/applications/{app_id}",
        json={"requested_amount": 500000.00},
        headers=customer_headers,
    )
    assert patch_res.status_code == 409
    assert "Cannot modify" in patch_res.json()["error"]["message"]


def test_customer_can_delete_draft_application(
    client: TestClient, customer_headers: dict[str, str]
):
    """Verify customer can delete an editable draft application."""
    create_res = client.post(
        "/api/v1/loans/applications",
        json={"requested_amount": 100000.00},
        headers=customer_headers,
    )
    app_id = create_res.json()["id"]

    del_res = client.delete(f"/api/v1/loans/applications/{app_id}", headers=customer_headers)
    assert del_res.status_code == 200
    assert del_res.json()["message"] == "Loan application deleted successfully."

    # Verify 404 after deletion
    get_res = client.get(f"/api/v1/loans/applications/{app_id}", headers=customer_headers)
    assert get_res.status_code == 404


def test_customer_cannot_delete_under_review_application(
    client: TestClient, customer_headers: dict[str, str], db_session: Session
):
    """Verify customer cannot delete an application in UNDER_REVIEW state."""
    create_res = client.post(
        "/api/v1/loans/applications",
        json={"requested_amount": 100000.00},
        headers=customer_headers,
    )
    app_id = uuid.UUID(create_res.json()["id"])

    app = db_session.get(LoanApplication, app_id)
    app.status = ApplicationStatus.UNDER_REVIEW
    db_session.commit()

    del_res = client.delete(f"/api/v1/loans/applications/{app_id}", headers=customer_headers)
    assert del_res.status_code == 409
    assert "Cannot delete" in del_res.json()["error"]["message"]


# ==============================================================================
# 3. Ownership & Authorization Security Tests
# ==============================================================================

def test_customer_cannot_view_another_customer_application(
    client: TestClient,
    customer_headers: dict[str, str],
    other_customer_headers: dict[str, str],
):
    """Verify Customer B cannot access Customer A's application (returns safe 404)."""
    # Customer A creates application
    create_res = client.post("/api/v1/loans/applications", json={"purpose": "Private"}, headers=customer_headers)
    app_id = create_res.json()["id"]

    # Customer B tries to GET application
    get_res = client.get(f"/api/v1/loans/applications/{app_id}", headers=other_customer_headers)
    assert get_res.status_code == 404


def test_customer_cannot_update_another_customer_application(
    client: TestClient,
    customer_headers: dict[str, str],
    other_customer_headers: dict[str, str],
):
    """Verify Customer B cannot update Customer A's application (returns safe 404)."""
    # Customer A creates application
    create_res = client.post("/api/v1/loans/applications", json={"purpose": "Private"}, headers=customer_headers)
    app_id = create_res.json()["id"]

    # Customer B tries to PATCH application
    patch_res = client.patch(
        f"/api/v1/loans/applications/{app_id}",
        json={"purpose": "Hacked"},
        headers=other_customer_headers,
    )
    assert patch_res.status_code == 404


def test_unauthenticated_request_rejected(client: TestClient):
    """Verify unauthenticated requests cannot access loan APIs."""
    res = client.get("/api/v1/loans/applications")
    assert res.status_code == 401


# ==============================================================================
# 4. List Applications Tests
# ==============================================================================

def test_customer_lists_only_own_applications(
    client: TestClient,
    customer_headers: dict[str, str],
    other_customer_headers: dict[str, str],
):
    """Verify listing applications only returns those belonging to the authenticated customer."""
    # Customer A creates 2 applications
    client.post("/api/v1/loans/applications", json={"purpose": "App 1"}, headers=customer_headers)
    client.post("/api/v1/loans/applications", json={"purpose": "App 2"}, headers=customer_headers)

    # Customer B creates 1 application
    client.post("/api/v1/loans/applications", json={"purpose": "Other App"}, headers=other_customer_headers)

    # Customer A lists applications
    list_res = client.get("/api/v1/loans/applications", headers=customer_headers)
    assert list_res.status_code == 200
    data = list_res.json()

    assert data["total"] == 2
    assert len(data["items"]) == 2
    purposes = [item["purpose"] for item in data["items"]]
    assert "App 1" in purposes
    assert "App 2" in purposes
    assert "Other App" not in purposes


# ==============================================================================
# 5. Submission & Validation Tests
# ==============================================================================

def test_incomplete_draft_submission_rejected(client: TestClient, customer_headers: dict[str, str]):
    """Verify submitting a draft missing required fields fails validation with 422."""
    # Create empty draft
    create_res = client.post("/api/v1/loans/applications", json={}, headers=customer_headers)
    app_id = create_res.json()["id"]

    # Submit incomplete draft
    submit_res = client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=customer_headers)
    assert submit_res.status_code == 422
    assert "missing or invalid" in submit_res.json()["error"]["message"]


def test_valid_draft_submission_succeeds(client: TestClient, customer_headers: dict[str, str]):
    """Verify submitting a complete draft transitions to SUBMITTED and records submitted_at timestamp."""
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
    data = submit_res.json()

    assert data["status"] == "SUBMITTED"
    assert data["submitted_at"] is not None


def test_submission_is_idempotent(client: TestClient, customer_headers: dict[str, str]):
    """Verify submitting an already submitted application returns 200 without error."""
    payload = {
        "requested_amount": 100000.00,
        "purpose": "Travel",
        "monthly_income": 40000.00,
        "employment_type": "SALARIED",
        "requested_tenure_months": 12,
    }
    create_res = client.post("/api/v1/loans/applications", json=payload, headers=customer_headers)
    app_id = create_res.json()["id"]

    # First submit
    res1 = client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=customer_headers)
    assert res1.status_code == 200

    # Second submit (idempotent)
    res2 = client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=customer_headers)
    assert res2.status_code == 200
    assert res2.json()["status"] == "SUBMITTED"
