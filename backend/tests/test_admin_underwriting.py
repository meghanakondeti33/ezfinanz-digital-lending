"""
Unit and integration tests for Admin Underwriting & Application Review (Phase 6).
Validates admin RBAC protection (403 for customers), queue retrieval, full composite review detail,
strict state-machine transitions (UNDER_REVIEW -> APPROVED / REJECTED), rejection reasons enforcement,
and immutable audit log dispatching.
"""

import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.models.audit import AuditLog
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.review import AdminReview, ReviewDecision
from app.models.user import User, UserRole


def create_test_customer_and_admin(db_session: Session) -> tuple[dict, dict, str, User, User]:
    """Helper to create a customer and admin with direct access tokens."""
    # 1. Create customer
    cust_email = f"customer_{uuid.uuid4().hex[:6]}@ezfinanz.com"
    customer = User(
        email=cust_email,
        phone=f"9{uuid.uuid4().int % 1000000000:09d}",
        password_hash=hash_password("CustomerPassword@123"),
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(customer)
    db_session.flush()

    cust_token = create_access_token(user_id=customer.id, role=customer.role.value)
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    # 2. Create admin
    admin_email = f"admin_{uuid.uuid4().hex[:6]}@ezfinanz.com"
    admin = User(
        email=admin_email,
        phone=f"8{uuid.uuid4().int % 1000000000:09d}",
        password_hash=hash_password("AdminPassword@123"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    db_session.flush()

    admin_token = create_access_token(user_id=admin.id, role=admin.role.value)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    return cust_headers, admin_headers, cust_email, customer, admin


def setup_application_ready_for_review(client: TestClient, cust_headers: dict) -> str:
    """Creates a loan application, submits, checks eligibility, selects offer, and completes verification -> UNDER_REVIEW."""
    # 1. Create and submit
    app_res = client.post(
        "/api/v1/loans/applications",
        json={
            "requested_amount": 500000.00,
            "purpose": "Home renovation",
            "monthly_income": 80000.00,
            "employment_type": "SALARIED",
            "employer_name": "Acme Corp",
            "existing_debt": 10000.00,
            "requested_tenure_months": 36,
        },
        headers=cust_headers,
    )
    app_id = app_res.json()["id"]
    client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=cust_headers)

    # 2. Eligibility & Offer Selection
    client.post(f"/api/v1/loans/applications/{app_id}/eligibility", headers=cust_headers)
    offers = client.get(f"/api/v1/loans/applications/{app_id}/offers", headers=cust_headers).json()["offers"]
    client.post(f"/api/v1/loans/applications/{app_id}/offers/{offers[0]['id']}/select", headers=cust_headers)

    # 3. 4-Step Verification
    client.post(
        f"/api/v1/loans/applications/{app_id}/kyc",
        json={
            "full_name": "Aakash Kumar",
            "date_of_birth": "1991-04-12",
            "gender": "MALE",
            "address_line_1": "Road No 10, Banjara Hills",
            "city": "Hyderabad",
            "state": "Telangana",
            "pincode": "500034",
            "id_type": "PAN",
            "id_number": "ABCDE1234F",
        },
        headers=cust_headers,
    )
    client.post(
        f"/api/v1/loans/applications/{app_id}/bank-account",
        json={
            "account_holder_name": "Aakash Kumar",
            "account_number": "12345678901234",
            "ifsc": "HDFC0001234",
            "bank_name": "HDFC Bank",
        },
        headers=cust_headers,
    )
    client.post(
        f"/api/v1/loans/applications/{app_id}/selfie",
        json={"storage_key": "selfies/live_photo_aakash.jpg"},
        headers=cust_headers,
    )
    client.post(
        f"/api/v1/loans/applications/{app_id}/declaration",
        json={"accepted": True, "declaration_version": "v1.0"},
        headers=cust_headers,
    )

    # Verify state is now UNDER_REVIEW
    app_check = client.get(f"/api/v1/loans/applications/{app_id}", headers=cust_headers)
    assert app_check.json()["status"] == "UNDER_REVIEW"

    return app_id


def test_admin_authentication_and_authorization(client: TestClient, db_session: Session):
    _, admin_headers, _, _, _ = create_test_customer_and_admin(db_session)

    res = client.get("/api/v1/admin/dashboard/stats", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_applications" in data
    assert "under_review_count" in data
    assert "approved_count" in data
    assert "rejected_count" in data


def test_customer_cannot_access_admin_endpoints(client: TestClient, db_session: Session):
    cust_headers, _, _, _, _ = create_test_customer_and_admin(db_session)

    # Customer accessing stats -> 403
    stats_res = client.get("/api/v1/admin/dashboard/stats", headers=cust_headers)
    assert stats_res.status_code == 403

    # Customer accessing queue -> 403
    queue_res = client.get("/api/v1/admin/applications", headers=cust_headers)
    assert queue_res.status_code == 403

    # Customer accessing decision -> 403
    fake_id = str(uuid.uuid4())
    decision_res = client.post(
        f"/api/v1/admin/applications/{fake_id}/decision",
        json={"decision": "APPROVED"},
        headers=cust_headers,
    )
    assert decision_res.status_code == 403


def test_unauthenticated_request_to_admin_rejected(client: TestClient):
    res = client.get("/api/v1/admin/dashboard/stats")
    assert res.status_code == 401


def test_admin_application_queue_and_filtering(client: TestClient, db_session: Session):
    cust_headers, admin_headers, cust_email, _, _ = create_test_customer_and_admin(db_session)
    app_id = setup_application_ready_for_review(client, cust_headers)

    # Get queue
    queue_res = client.get("/api/v1/admin/applications", headers=admin_headers)
    assert queue_res.status_code == 200
    data = queue_res.json()
    assert data["total"] >= 1
    found = next((item for item in data["applications"] if item["id"] == app_id), None)
    assert found is not None
    assert found["status"] == "UNDER_REVIEW"
    assert found["customer_email"] == cust_email
    assert found["customer_name"] == "Aakash Kumar"
    assert found["verification_status"] == "COMPLETED"

    # Filter by UNDER_REVIEW
    filter_res = client.get("/api/v1/admin/applications?status=UNDER_REVIEW", headers=admin_headers)
    assert filter_res.status_code == 200
    assert any(item["id"] == app_id for item in filter_res.json()["applications"])

    # Filter by APPROVED (should not contain this app yet)
    filter_appr = client.get("/api/v1/admin/applications?status=APPROVED", headers=admin_headers)
    assert filter_appr.status_code == 200
    assert not any(item["id"] == app_id for item in filter_appr.json()["applications"])


def test_admin_application_detail_composite_data(client: TestClient, db_session: Session):
    cust_headers, admin_headers, cust_email, _, _ = create_test_customer_and_admin(db_session)
    app_id = setup_application_ready_for_review(client, cust_headers)

    detail_res = client.get(f"/api/v1/admin/applications/{app_id}", headers=admin_headers)
    assert detail_res.status_code == 200
    data = detail_res.json()

    assert data["id"] == app_id
    assert data["status"] == "UNDER_REVIEW"

    # Customer profile
    assert data["customer"]["email"] == cust_email
    assert data["customer"]["full_name"] == "Aakash Kumar"

    # Loan details
    assert Decimal(str(data["loan_details"]["requested_amount"])) == Decimal("500000.00")
    assert data["loan_details"]["purpose"] == "Home renovation"

    # Eligibility
    assert data["eligibility"]["status"] == "ELIGIBLE"
    assert len(data["eligibility"]["reasons"]) > 0

    # Selected offer
    assert Decimal(str(data["selected_offer"]["principal"])) == Decimal("500000.00")
    assert Decimal(str(data["selected_offer"]["emi"])) > Decimal("0")

    # Verification
    assert data["verification"]["status"] == "COMPLETED"
    assert data["verification"]["kyc"]["status"] == "VERIFIED"
    assert data["verification"]["bank_account"]["status"] == "VERIFIED"
    assert data["verification"]["selfie"]["status"] == "VERIFIED"
    assert data["verification"]["declaration"]["accepted"] is True

    # Audit logs
    assert len(data["audit_logs"]) >= 5


def test_valid_approval_state_transition(client: TestClient, db_session: Session):
    cust_headers, admin_headers, _, _, _ = create_test_customer_and_admin(db_session)
    app_id = setup_application_ready_for_review(client, cust_headers)

    # Approve
    dec_res = client.post(
        f"/api/v1/admin/applications/{app_id}/decision",
        json={"decision": "APPROVED", "remarks": "Excellent creditworthiness and complete KYC verified."},
        headers=admin_headers,
    )
    assert dec_res.status_code == 200
    dec_data = dec_res.json()
    assert dec_data["status"] == "APPROVED"
    assert dec_data["decision"] == "APPROVED"
    assert "Excellent creditworthiness" in dec_data["remarks"]

    # Verify customer view reflects APPROVED
    cust_app = client.get(f"/api/v1/loans/applications/{app_id}", headers=cust_headers).json()
    assert cust_app["status"] == "APPROVED"

    # Verify AdminReview record in database
    review_db = db_session.execute(
        select(AdminReview).where(AdminReview.application_id == uuid.UUID(app_id))
    ).scalar_one_or_none()
    assert review_db is not None
    assert review_db.decision == ReviewDecision.APPROVED


def test_valid_rejection_state_transition(client: TestClient, db_session: Session):
    cust_headers, admin_headers, _, _, _ = create_test_customer_and_admin(db_session)
    app_id = setup_application_ready_for_review(client, cust_headers)

    # Reject with required reason
    dec_res = client.post(
        f"/api/v1/admin/applications/{app_id}/decision",
        json={
            "decision": "REJECTED",
            "rejection_reason": "Risk policy violation",
            "remarks": "Debt obligations too high for requested exposure.",
        },
        headers=admin_headers,
    )
    assert dec_res.status_code == 200
    dec_data = dec_res.json()
    assert dec_data["status"] == "REJECTED"
    assert dec_data["decision"] == "REJECTED"
    assert "[Risk policy violation]" in dec_data["remarks"]

    # Verify customer view reflects REJECTED
    cust_app = client.get(f"/api/v1/loans/applications/{app_id}", headers=cust_headers).json()
    assert cust_app["status"] == "REJECTED"


def test_rejection_requires_reason(client: TestClient, db_session: Session):
    cust_headers, admin_headers, _, _, _ = create_test_customer_and_admin(db_session)
    app_id = setup_application_ready_for_review(client, cust_headers)

    # Reject WITHOUT rejection_reason
    dec_res = client.post(
        f"/api/v1/admin/applications/{app_id}/decision",
        json={"decision": "REJECTED", "remarks": "No reason provided"},
        headers=admin_headers,
    )
    assert dec_res.status_code == 422
    assert "rejection reason category is required" in dec_res.json()["error"]["message"]


def test_invalid_state_transition_rejected(client: TestClient, db_session: Session):
    cust_headers, admin_headers, _, _, _ = create_test_customer_and_admin(db_session)

    # Create draft application (NOT in UNDER_REVIEW)
    draft_res = client.post(
        "/api/v1/loans/applications",
        json={"requested_amount": 100000.00, "purpose": "Travel"},
        headers=cust_headers,
    )
    draft_id = draft_res.json()["id"]

    # Attempt to approve draft -> 409 Conflict
    appr_res = client.post(
        f"/api/v1/admin/applications/{draft_id}/decision",
        json={"decision": "APPROVED", "remarks": "Premature approval"},
        headers=admin_headers,
    )
    assert appr_res.status_code == 409
    assert "Only applications in 'UNDER_REVIEW'" in appr_res.json()["error"]["message"]


def test_audit_event_creation_on_admin_decisions(client: TestClient, db_session: Session):
    cust_headers, admin_headers, _, _, _ = create_test_customer_and_admin(db_session)
    app_id = setup_application_ready_for_review(client, cust_headers)

    # Approve
    client.post(
        f"/api/v1/admin/applications/{app_id}/decision",
        json={"decision": "APPROVED", "remarks": "Approved by senior underwriter."},
        headers=admin_headers,
    )

    # Check audit log
    logs = list(
        db_session.execute(
            select(AuditLog).where(
                AuditLog.application_id == uuid.UUID(app_id),
                AuditLog.action == "APPLICATION_APPROVED",
            )
        ).scalars().all()
    )
    assert len(logs) == 1
    log = logs[0]
    assert log.old_status == "UNDER_REVIEW"
    assert log.new_status == "APPROVED"
    assert log.metadata_["decision"] == "APPROVED"
    assert "password" not in str(log.metadata_).lower()
