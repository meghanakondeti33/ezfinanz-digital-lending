"""
Unit and integration tests for Customer Verification Pipeline (Phase 5).
Validates KYC, Bank Account, Selfie, and Declaration verification workflows,
data masking, state transitions to UNDER_REVIEW, cross-customer isolation,
and audit trail generation.
"""

import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.models.audit import AuditLog
from app.models.bank import BankAccount
from app.models.declaration import Declaration
from app.models.kyc import KYCDetail
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.selfie import SelfieVerification
from app.models.user import User, UserRole


def create_test_customer(client: TestClient, email: str, phone: str) -> tuple[str, dict]:
    """Helper to register and login a test customer, returning user_id and auth headers."""
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "phone": phone, "password": "SecurePassword@123"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePassword@123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    user_id = me_res.json()["id"]
    return user_id, headers


def create_and_accept_loan_application(client: TestClient, headers: dict) -> str:
    """Helper to create a loan application, submit it, run eligibility, and select an offer."""
    # 1. Create draft
    create_res = client.post(
        "/api/v1/loans/applications",
        json={
            "requested_amount": 300000.00,
            "purpose": "Home improvement",
            "monthly_income": 75000.00,
            "employment_type": "SALARIED",
            "employer_name": "Tech Corp",
            "existing_debt": 15000.00,
            "requested_tenure_months": 36,
        },
        headers=headers,
    )
    app_id = create_res.json()["id"]

    # 2. Submit
    client.post(f"/api/v1/loans/applications/{app_id}/submit", headers=headers)

    # 3. Check Eligibility
    client.post(f"/api/v1/loans/applications/{app_id}/eligibility", headers=headers)

    # 4. Fetch Offers and Select
    offers_res = client.get(f"/api/v1/loans/applications/{app_id}/offers", headers=headers)
    offer_id = offers_res.json()["offers"][0]["id"]
    client.post(f"/api/v1/loans/applications/{app_id}/offers/{offer_id}/select", headers=headers)

    return app_id


def test_accepted_application_can_start_verification():
    client = TestClient(app)
    user_id, headers = create_test_customer(client, "verif_start@ezfinanz.com", "9112233441")
    app_id = create_and_accept_loan_application(client, headers)

    # Check initial verification summary
    summary_res = client.get(f"/api/v1/loans/applications/{app_id}/verification", headers=headers)
    assert summary_res.status_code == 200
    data = summary_res.json()
    assert data["status"] == "NOT_STARTED"
    assert data["kyc"] == "NOT_STARTED"
    assert data["bank_account"] == "NOT_STARTED"
    assert data["selfie"] == "NOT_STARTED"
    assert data["declaration"] == "NOT_STARTED"
    assert data["is_ready_for_review"] is False


def test_non_accepted_application_cannot_start_verification():
    client = TestClient(app)
    _, headers = create_test_customer(client, "verif_draft@ezfinanz.com", "9112233442")

    # Create draft but DO NOT submit or select offer
    create_res = client.post(
        "/api/v1/loans/applications",
        json={"requested_amount": 200000.00, "purpose": "Travel"},
        headers=headers,
    )
    app_id = create_res.json()["id"]

    # Attempt KYC on DRAFT
    kyc_res = client.post(
        f"/api/v1/loans/applications/{app_id}/kyc",
        json={
            "full_name": "Test User",
            "date_of_birth": "1990-01-01",
            "gender": "MALE",
            "address_line_1": "123 Main St",
            "city": "Hyderabad",
            "state": "Telangana",
            "pincode": "500001",
            "id_type": "PAN",
            "id_number": "ABCDE1234F",
        },
        headers=headers,
    )
    assert kyc_res.status_code == 409
    assert "Verification cannot be performed" in kyc_res.json()["error"]["message"]


def test_customer_can_submit_and_verify_kyc(db_session: Session):
    client = TestClient(app)
    user_id, headers = create_test_customer(client, "kyc_test@ezfinanz.com", "9112233443")
    app_id = create_and_accept_loan_application(client, headers)

    kyc_payload = {
        "full_name": "Rahul Sharma",
        "date_of_birth": "1992-05-15",
        "gender": "MALE",
        "address_line_1": "Flat 402, Greenfield Apartments",
        "address_line_2": "HiTech City",
        "city": "Hyderabad",
        "state": "Telangana",
        "pincode": "500081",
        "id_type": "AADHAAR",
        "id_number": "123456789012",
        "document_storage_key": "kyc/aadhaar_rahul.pdf",
    }

    kyc_res = client.post(
        f"/api/v1/loans/applications/{app_id}/kyc",
        json=kyc_payload,
        headers=headers,
    )
    assert kyc_res.status_code == 200
    data = kyc_res.json()
    assert data["full_name"] == "Rahul Sharma"
    assert data["status"] == "VERIFIED"
    assert data["id_number_masked"] == "XXXX-XXXX-9012"
    assert "123456789012" not in str(data)

    # Verify database persistence & hashing
    kyc_db = db_session.execute(
        select(KYCDetail).where(KYCDetail.user_id == uuid.UUID(user_id))
    ).scalar_one_or_none()
    assert kyc_db is not None
    assert kyc_db.full_name == "Rahul Sharma"
    assert kyc_db.id_number_hash != "123456789012"
    assert len(kyc_db.id_number_hash) == 64  # SHA-256 length


def test_sensitive_kyc_data_not_exposed():
    client = TestClient(app)
    _, headers = create_test_customer(client, "kyc_mask@ezfinanz.com", "9112233444")
    app_id = create_and_accept_loan_application(client, headers)

    client.post(
        f"/api/v1/loans/applications/{app_id}/kyc",
        json={
            "full_name": "Pooja Verma",
            "date_of_birth": "1995-11-20",
            "gender": "FEMALE",
            "address_line_1": "Plot 12, Baner",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411045",
            "id_type": "PAN",
            "id_number": "ABCDE5678K",
        },
        headers=headers,
    )

    get_res = client.get(f"/api/v1/loans/applications/{app_id}/kyc", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert "ABCDE5678K" not in str(data)
    assert "XXXX" in data["id_number_masked"]


def test_customer_can_submit_and_verify_bank_account(db_session: Session):
    client = TestClient(app)
    user_id, headers = create_test_customer(client, "bank_test@ezfinanz.com", "9112233445")
    app_id = create_and_accept_loan_application(client, headers)

    bank_payload = {
        "account_holder_name": "Pooja Verma",
        "account_number": "12345678901234",
        "ifsc": "HDFC0001234",
        "bank_name": "HDFC Bank",
    }

    bank_res = client.post(
        f"/api/v1/loans/applications/{app_id}/bank-account",
        json=bank_payload,
        headers=headers,
    )
    assert bank_res.status_code == 200
    data = bank_res.json()
    assert data["account_holder_name"] == "Pooja Verma"
    assert data["bank_name"] == "HDFC Bank"
    assert data["ifsc"] == "HDFC0001234"
    assert data["account_number_last4"] == "1234"
    assert data["account_number_masked"] == "XXXXXX1234"
    assert "12345678901234" not in str(data)

    # Verify database persistence & hashing
    bank_db = db_session.execute(
        select(BankAccount).where(BankAccount.application_id == uuid.UUID(app_id))
    ).scalar_one_or_none()
    assert bank_db is not None
    assert bank_db.account_number_last4 == "1234"
    assert bank_db.account_number_hash != "12345678901234"
    assert len(bank_db.account_number_hash) == 64


def test_customer_can_submit_and_verify_selfie(db_session: Session):
    client = TestClient(app)
    _, headers = create_test_customer(client, "selfie_test@ezfinanz.com", "9112233446")
    app_id = create_and_accept_loan_application(client, headers)

    selfie_res = client.post(
        f"/api/v1/loans/applications/{app_id}/selfie",
        json={"storage_key": "selfies/live_photo_user446.jpg", "verification_type": "LIVE_PHOTO"},
        headers=headers,
    )
    assert selfie_res.status_code == 200
    data = selfie_res.json()
    assert data["status"] == "VERIFIED"
    assert data["verification_type"] == "LIVE_PHOTO"

    # Verify database persistence
    selfie_db = db_session.execute(
        select(SelfieVerification).where(SelfieVerification.application_id == uuid.UUID(app_id))
    ).scalar_one_or_none()
    assert selfie_db is not None
    assert selfie_db.status.value == "VERIFIED"


def test_customer_can_accept_declaration_with_backend_timestamp(db_session: Session):
    client = TestClient(app)
    _, headers = create_test_customer(client, "dec_test@ezfinanz.com", "9112233447")
    app_id = create_and_accept_loan_application(client, headers)

    dec_res = client.post(
        f"/api/v1/loans/applications/{app_id}/declaration",
        json={"accepted": True, "declaration_version": "v1.0"},
        headers=headers,
    )
    assert dec_res.status_code == 200
    data = dec_res.json()
    assert data["accepted"] is True
    assert data["declaration_version"] == "v1.0"
    assert "accepted_at" in data

    # Verify database persistence
    dec_db = db_session.execute(
        select(Declaration).where(Declaration.application_id == uuid.UUID(app_id))
    ).scalar_one_or_none()
    assert dec_db is not None
    assert dec_db.accepted is True
    assert dec_db.accepted_at is not None


def test_verification_completes_when_all_steps_verified(db_session: Session):
    """
    Test complete 4-step pipeline progression:
    KYC -> Bank -> Selfie -> Declaration -> Verification COMPLETED & Loan UNDER_REVIEW
    """
    client = TestClient(app)
    _, headers = create_test_customer(client, "full_verif@ezfinanz.com", "9112233448")
    app_id = create_and_accept_loan_application(client, headers)

    # 1. Complete KYC
    client.post(
        f"/api/v1/loans/applications/{app_id}/kyc",
        json={
            "full_name": "Deepak Reddy",
            "date_of_birth": "1988-03-22",
            "gender": "MALE",
            "address_line_1": "Banjara Hills",
            "city": "Hyderabad",
            "state": "Telangana",
            "pincode": "500034",
            "id_type": "PAN",
            "id_number": "DPRKY1234A",
        },
        headers=headers,
    )

    summary1 = client.get(f"/api/v1/loans/applications/{app_id}/verification", headers=headers).json()
    assert summary1["status"] == "IN_PROGRESS"
    assert summary1["kyc"] == "VERIFIED"
    assert summary1["is_ready_for_review"] is False

    # 2. Complete Bank
    client.post(
        f"/api/v1/loans/applications/{app_id}/bank-account",
        json={
            "account_holder_name": "Deepak Reddy",
            "account_number": "987654321098",
            "ifsc": "ICIC0005678",
            "bank_name": "ICICI Bank",
        },
        headers=headers,
    )

    summary2 = client.get(f"/api/v1/loans/applications/{app_id}/verification", headers=headers).json()
    assert summary2["status"] == "IN_PROGRESS"
    assert summary2["bank_account"] == "VERIFIED"

    # 3. Complete Selfie
    client.post(
        f"/api/v1/loans/applications/{app_id}/selfie",
        json={"storage_key": "selfies/live_photo_deepak.jpg"},
        headers=headers,
    )

    summary3 = client.get(f"/api/v1/loans/applications/{app_id}/verification", headers=headers).json()
    assert summary3["status"] == "IN_PROGRESS"
    assert summary3["selfie"] == "VERIFIED"

    # 4. Complete Declaration
    client.post(
        f"/api/v1/loans/applications/{app_id}/declaration",
        json={"accepted": True, "declaration_version": "v1.0"},
        headers=headers,
    )

    # 5. Check Final Verification Summary
    summary4 = client.get(f"/api/v1/loans/applications/{app_id}/verification", headers=headers).json()
    assert summary4["status"] == "COMPLETED"
    assert summary4["kyc"] == "VERIFIED"
    assert summary4["bank_account"] == "VERIFIED"
    assert summary4["selfie"] == "VERIFIED"
    assert summary4["declaration"] == "ACCEPTED"
    assert summary4["is_ready_for_review"] is True

    # 6. Check Application State is transitioned to UNDER_REVIEW
    app_res = client.get(f"/api/v1/loans/applications/{app_id}", headers=headers)
    assert app_res.json()["status"] == "UNDER_REVIEW"


def test_customer_cannot_access_another_customer_verification():
    client = TestClient(app)
    _, headers_a = create_test_customer(client, "owner_a@ezfinanz.com", "9112233449")
    _, headers_b = create_test_customer(client, "intruder_b@ezfinanz.com", "9112233450")

    app_id_a = create_and_accept_loan_application(client, headers_a)

    # Customer B attempts to get KYC for Customer A's application
    get_res = client.get(f"/api/v1/loans/applications/{app_id_a}/kyc", headers=headers_b)
    assert get_res.status_code == 404

    # Customer B attempts to submit bank account for Customer A's application
    bank_res = client.post(
        f"/api/v1/loans/applications/{app_id_a}/bank-account",
        json={
            "account_holder_name": "Intruder B",
            "account_number": "111122223333",
            "ifsc": "SBIN0001234",
            "bank_name": "SBI",
        },
        headers=headers_b,
    )
    assert bank_res.status_code == 404


def test_audit_logs_created_for_verification_events(db_session: Session):
    client = TestClient(app)
    user_id, headers = create_test_customer(client, "audit_verif@ezfinanz.com", "9112233451")
    app_id = create_and_accept_loan_application(client, headers)

    # Submit KYC, Bank, Selfie, Declaration
    client.post(
        f"/api/v1/loans/applications/{app_id}/kyc",
        json={
            "full_name": "Audit User",
            "date_of_birth": "1994-01-01",
            "gender": "OTHER",
            "address_line_1": "MG Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
            "id_type": "PASSPORT",
            "id_number": "Z1234567",
        },
        headers=headers,
    )
    client.post(
        f"/api/v1/loans/applications/{app_id}/bank-account",
        json={
            "account_holder_name": "Audit User",
            "account_number": "444455556666",
            "ifsc": "SBIN0009999",
            "bank_name": "State Bank of India",
        },
        headers=headers,
    )
    client.post(
        f"/api/v1/loans/applications/{app_id}/selfie",
        json={"storage_key": "selfies/live_photo_audit.jpg"},
        headers=headers,
    )
    client.post(
        f"/api/v1/loans/applications/{app_id}/declaration",
        json={"accepted": True, "declaration_version": "v1.0"},
        headers=headers,
    )

    # Query audit logs from PostgreSQL
    logs = list(
        db_session.execute(
            select(AuditLog).where(AuditLog.application_id == uuid.UUID(app_id))
        ).scalars().all()
    )

    actions = [log.action for log in logs]
    assert "KYC_VERIFIED" in actions
    assert "BANK_ACCOUNT_VERIFIED" in actions
    assert "SELFIE_VERIFIED" in actions
    assert "DECLARATION_ACCEPTED" in actions
    assert "VERIFICATION_COMPLETED" in actions

    # Ensure no passwords or raw ID/account numbers in logs metadata
    for log in logs:
        metadata_str = str(log.metadata_)
        assert "password" not in metadata_str.lower()
        assert "444455556666" not in metadata_str
        assert "Z1234567" not in metadata_str
