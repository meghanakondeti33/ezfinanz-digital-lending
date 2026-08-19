"""
Unit & Integration Tests for Phase 7: Loan Disbursement & Lending Lifecycle.
"""

from decimal import Decimal
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.models.audit import AuditLog
from app.models.bank import BankAccount
from app.models.declaration import Declaration
from app.models.disbursement import Disbursement, DisbursementStatus
from app.models.kyc import IDType, KYCDetail
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.loan_term import LoanTerm
from app.models.offer import LoanOffer, OfferStatus
from app.models.review import AdminReview, ReviewDecision
from app.models.selfie import SelfieVerification, SelfieVerificationStatus, SelfieVerificationType
from app.models.user import User, UserRole
from app.models.verification import VerificationStatus, VerificationType


def create_mock_user(db: Session, email: str, phone: str, role: UserRole = UserRole.CUSTOMER) -> User:
    user = User(
        email=email,
        phone=phone,
        password_hash=hash_password("SecurePass@123"),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def setup_verified_approved_application(db: Session, customer: User, admin: User) -> LoanApplication:
    """Helper to set up an application with complete verification, selected offer, and admin approval."""
    # 1. Application
    app = LoanApplication(
        application_number=f"EZF-TEST-{uuid.uuid4().hex[:6].upper()}",
        user_id=customer.id,
        status=ApplicationStatus.APPROVED,
        requested_amount=Decimal("150000.00"),
        purpose="Home renovation",
        monthly_income=Decimal("85000.00"),
        employment_type="SALARIED",
        existing_debt=Decimal("0.00"),
        requested_tenure_months=24,
    )
    db.add(app)
    db.flush()

    # 2. Selected Offer & Term
    offer = LoanOffer(
        application_id=app.id,
        principal=Decimal("150000.00"),
        interest_rate=Decimal("12.50"),
        processing_fee=Decimal("3000.00"),
        gst=Decimal("540.00"),
        other_charges=Decimal("0.00"),
        status=OfferStatus.SELECTED,
    )
    db.add(offer)
    db.flush()

    term = LoanTerm(
        offer_id=offer.id,
        tenure_months=24,
        emi=Decimal("7098.00"),
        total_interest=Decimal("20352.00"),
        total_repayment=Decimal("170352.00"),
        total_charges=Decimal("3540.00"),
        net_disbursement=Decimal("146460.00"),
        irr=Decimal("14.2000"),
    )
    db.add(term)
    db.flush()

    # 3. Verified Bank Account
    bank = BankAccount(
        application_id=app.id,
        account_holder_name="Priya Sharma",
        account_number_hash=hash_password("123456789012"),
        account_number_last4="9012",
        ifsc="HDFC0001234",
        bank_name="HDFC Bank",
    )
    db.add(bank)

    # 4. Admin Approval Review
    review = AdminReview(
        application_id=app.id,
        admin_id=admin.id,
        decision=ReviewDecision.APPROVED,
        remarks="Underwriting requirements satisfied.",
    )
    db.add(review)
    db.flush()

    return app


def test_approved_application_can_be_disbursed_full_lifecycle(client: TestClient, db_session: Session):
    """1. Test that an APPROVED application can be initiated and confirmed through full lifecycle."""
    customer = create_mock_user(db_session, "disb_cust1@ezfinanz.com", "9112244001")
    admin = create_mock_user(db_session, "disb_admin1@ezfinanz.com", "9112244002", role=UserRole.ADMIN)
    app = setup_verified_approved_application(db_session, customer, admin)

    admin_token = create_access_token(admin.id, admin.role.value)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Step 1: Initiate Disbursement
    init_res = client.post(
        f"/api/v1/admin/applications/{app.id}/disbursement/initiate",
        headers=admin_headers,
        json={"remarks": "Initiating electronic fund transfer"},
    )
    assert init_res.status_code == 200
    init_data = init_res.json()
    assert init_data["application_status"] == "DISBURSEMENT_PROCESSING"
    assert init_data["status"] == "INITIATED"
    assert Decimal(str(init_data["approved_amount"])) == Decimal("150000.00")
    assert Decimal(str(init_data["net_disbursement_amount"])) == Decimal("146460.00")
    assert init_data["disbursement_reference"].startswith("EZF-DIS-")

    # Step 2: Confirm Disbursement
    confirm_res = client.post(
        f"/api/v1/admin/applications/{app.id}/disbursement/confirm",
        headers=admin_headers,
        json={"remarks": "Bank settlement received successfully"},
    )
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["application_status"] == "DISBURSED"
    assert confirm_data["status"] == "SUCCESS"
    assert confirm_data["completed_at"] is not None


def test_non_approved_application_cannot_be_disbursed(client: TestClient, db_session: Session):
    """2. Test that an application not in APPROVED status (e.g. UNDER_REVIEW or DRAFT) cannot be disbursed."""
    customer = create_mock_user(db_session, "disb_cust2@ezfinanz.com", "9112244003")
    admin = create_mock_user(db_session, "disb_admin2@ezfinanz.com", "9112244004", role=UserRole.ADMIN)

    app = LoanApplication(
        application_number=f"EZF-TEST-{uuid.uuid4().hex[:6].upper()}",
        user_id=customer.id,
        status=ApplicationStatus.UNDER_REVIEW,
        requested_amount=Decimal("100000.00"),
    )
    db_session.add(app)
    db_session.flush()

    admin_token = create_access_token(admin.id, admin.role.value)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.post(
        f"/api/v1/admin/applications/{app.id}/disbursement/initiate",
        headers=admin_headers,
        json={},
    )
    assert res.status_code == 409
    assert "Only 'APPROVED' applications can be disbursed" in res.json()["error"]["message"]


def test_customer_cannot_initiate_disbursement(client: TestClient, db_session: Session):
    """3. Test that customer receives 403 when trying to access admin disbursement initiate endpoint."""
    customer = create_mock_user(db_session, "disb_cust3@ezfinanz.com", "9112244005")
    admin = create_mock_user(db_session, "disb_admin3@ezfinanz.com", "9112244006", role=UserRole.ADMIN)
    app = setup_verified_approved_application(db_session, customer, admin)

    cust_token = create_access_token(customer.id, customer.role.value)
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    res = client.post(
        f"/api/v1/admin/applications/{app.id}/disbursement/initiate",
        headers=cust_headers,
        json={},
    )
    assert res.status_code == 403


def test_customer_can_view_only_own_disbursement(client: TestClient, db_session: Session):
    """4. Test that customer can view their own disbursement details, but another customer receives 403."""
    cust_owner = create_mock_user(db_session, "disb_owner@ezfinanz.com", "9112244007")
    cust_intruder = create_mock_user(db_session, "disb_intruder@ezfinanz.com", "9112244008")
    admin = create_mock_user(db_session, "disb_admin4@ezfinanz.com", "9112244009", role=UserRole.ADMIN)
    app = setup_verified_approved_application(db_session, cust_owner, admin)

    owner_token = create_access_token(cust_owner.id, cust_owner.role.value)
    intruder_token = create_access_token(cust_intruder.id, cust_intruder.role.value)

    # Owner can access
    owner_res = client.get(
        f"/api/v1/loans/applications/{app.id}/disbursement",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert owner_res.status_code == 200
    owner_data = owner_res.json()
    assert owner_data["application_status"] == "APPROVED"
    assert Decimal(str(owner_data["approved_amount"])) == Decimal("150000.00")
    assert Decimal(str(owner_data["emi"])) == Decimal("7098.00")
    assert owner_data["destination_bank_name"] == "HDFC Bank"

    # Intruder receives 403
    intruder_res = client.get(
        f"/api/v1/loans/applications/{app.id}/disbursement",
        headers={"Authorization": f"Bearer {intruder_token}"},
    )
    assert intruder_res.status_code == 403


def test_duplicate_disbursement_cannot_be_created(client: TestClient, db_session: Session):
    """6. Test that attempting to initiate disbursement twice on the same application raises 409 Conflict."""
    customer = create_mock_user(db_session, "disb_cust6@ezfinanz.com", "9112244010")
    admin = create_mock_user(db_session, "disb_admin6@ezfinanz.com", "9112244011", role=UserRole.ADMIN)
    app = setup_verified_approved_application(db_session, customer, admin)

    admin_token = create_access_token(admin.id, admin.role.value)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # First initiation succeeds
    res1 = client.post(
        f"/api/v1/admin/applications/{app.id}/disbursement/initiate",
        headers=admin_headers,
        json={},
    )
    assert res1.status_code == 200

    # Second initiation rejected
    res2 = client.post(
        f"/api/v1/admin/applications/{app.id}/disbursement/initiate",
        headers=admin_headers,
        json={},
    )
    assert res2.status_code == 409


def test_invalid_status_transitions_rejected(client: TestClient, db_session: Session):
    """7. Test that calling confirm before initiate raises 409 Conflict."""
    customer = create_mock_user(db_session, "disb_cust7@ezfinanz.com", "9112244012")
    admin = create_mock_user(db_session, "disb_admin7@ezfinanz.com", "9112244013", role=UserRole.ADMIN)
    app = setup_verified_approved_application(db_session, customer, admin)

    admin_token = create_access_token(admin.id, admin.role.value)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Calling confirm while still in APPROVED state (before initiate)
    confirm_res = client.post(
        f"/api/v1/admin/applications/{app.id}/disbursement/confirm",
        headers=admin_headers,
        json={},
    )
    assert confirm_res.status_code == 409
    assert "Application must be in 'DISBURSEMENT_PROCESSING'" in confirm_res.json()["error"]["message"]


def test_audit_logs_created_for_disbursement_events(client: TestClient, db_session: Session):
    """8. Test that DISBURSEMENT_INITIATED and DISBURSEMENT_COMPLETED audit events are recorded."""
    customer = create_mock_user(db_session, "disb_cust8@ezfinanz.com", "9112244014")
    admin = create_mock_user(db_session, "disb_admin8@ezfinanz.com", "9112244015", role=UserRole.ADMIN)
    app = setup_verified_approved_application(db_session, customer, admin)

    admin_token = create_access_token(admin.id, admin.role.value)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Initiate
    client.post(f"/api/v1/admin/applications/{app.id}/disbursement/initiate", headers=admin_headers, json={})
    # Confirm
    client.post(f"/api/v1/admin/applications/{app.id}/disbursement/confirm", headers=admin_headers, json={})

    # Check audit logs in DB
    logs = db_session.execute(
        select(AuditLog)
        .where(AuditLog.application_id == app.id)
        .order_by(AuditLog.created_at.asc())
    ).scalars().all()

    actions = [log.action for log in logs]
    assert "DISBURSEMENT_INITIATED" in actions
    assert "DISBURSEMENT_COMPLETED" in actions


def test_disbursement_persists_in_database(client: TestClient, db_session: Session):
    """9. Test that disbursement record and reference persist accurately in the database."""
    customer = create_mock_user(db_session, "disb_cust9@ezfinanz.com", "9112244016")
    admin = create_mock_user(db_session, "disb_admin9@ezfinanz.com", "9112244017", role=UserRole.ADMIN)
    app = setup_verified_approved_application(db_session, customer, admin)

    admin_token = create_access_token(admin.id, admin.role.value)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    client.post(f"/api/v1/admin/applications/{app.id}/disbursement/initiate", headers=admin_headers, json={})
    client.post(f"/api/v1/admin/applications/{app.id}/disbursement/confirm", headers=admin_headers, json={})

    saved_disb = db_session.execute(
        select(Disbursement).where(Disbursement.application_id == app.id)
    ).scalar_one()

    assert saved_disb.status == DisbursementStatus.SUCCESS
    assert saved_disb.amount == Decimal("150000.00")
    assert saved_disb.net_amount == Decimal("146460.00")
    assert saved_disb.transaction_reference.startswith("EZF-DIS-")
    assert saved_disb.completed_at is not None
