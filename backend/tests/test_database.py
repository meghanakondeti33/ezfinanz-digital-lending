"""
Database, model, and constraint tests for EZFINANZ Phase 1.
"""

import uuid
import datetime
from decimal import Decimal
import pytest
from sqlalchemy import text, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.verification import UserVerification, VerificationType, VerificationStatus
from app.models.kyc import KYCDetail, Gender, IDType
from app.models.loan import LoanApplication, ApplicationStatus
from app.models.eligibility import EligibilityCheck, EligibilityStatus
from app.models.offer import LoanOffer, OfferStatus
from app.models.loan_term import LoanTerm
from app.models.bank import BankAccount
from app.models.declaration import Declaration
from app.models.selfie import SelfieVerification, SelfieVerificationType, SelfieVerificationStatus
from app.models.review import AdminReview, ReviewDecision
from app.models.disbursement import Disbursement, DisbursementStatus
from app.models.audit import AuditLog


def test_health_endpoint_still_returns_200(client):
    """Verify Phase 0 health endpoint remains 100% functional."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_postgresql_connection_and_session(db_session: Session):
    """Verify PostgreSQL connection succeeds and returns server version."""
    result = db_session.execute(text("SELECT 1")).scalar()
    assert result == 1


def test_all_13_tables_exist(engine):
    """Verify all 13 required Phase 1 tables exist in the database."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    
    expected_tables = {
        "users",
        "user_verifications",
        "kyc_details",
        "loan_applications",
        "eligibility_checks",
        "loan_offers",
        "loan_terms",
        "bank_accounts",
        "declarations",
        "selfie_verifications",
        "admin_reviews",
        "disbursements",
        "audit_logs",
    }
    
    missing = expected_tables - existing_tables
    assert not missing, f"Missing tables in database: {missing}"


def test_unique_email_constraint(db_session: Session):
    """Verify duplicate email violates unique constraint."""
    user1 = User(
        email="test_unique@example.com",
        phone="9876543210",
        password_hash="hash_placeholder_1",
        role=UserRole.CUSTOMER,
    )
    db_session.add(user1)
    db_session.flush()

    user2 = User(
        email="test_unique@example.com",  # Duplicate email
        phone="9876543211",
        password_hash="hash_placeholder_2",
        role=UserRole.CUSTOMER,
    )
    db_session.add(user2)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_unique_phone_constraint(db_session: Session):
    """Verify duplicate phone violates unique constraint."""
    user1 = User(
        email="user_a@example.com",
        phone="9998887771",
        password_hash="hash_placeholder_1",
        role=UserRole.CUSTOMER,
    )
    db_session.add(user1)
    db_session.flush()

    user2 = User(
        email="user_b@example.com",
        phone="9998887771",  # Duplicate phone
        password_hash="hash_placeholder_2",
        role=UserRole.CUSTOMER,
    )
    db_session.add(user2)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_unique_application_number_constraint(db_session: Session):
    """Verify duplicate application_number violates unique constraint."""
    user = User(
        email="applicant@example.com",
        phone="9123456789",
        password_hash="hash_placeholder",
    )
    db_session.add(user)
    db_session.flush()

    app1 = LoanApplication(
        application_number="EZ-2026-0001",
        user_id=user.id,
        status=ApplicationStatus.DRAFT,
    )
    db_session.add(app1)
    db_session.flush()

    app2 = LoanApplication(
        application_number="EZ-2026-0001",  # Duplicate app number
        user_id=user.id,
        status=ApplicationStatus.DRAFT,
    )
    db_session.add(app2)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_financial_fields_numeric_and_decimal(db_session: Session):
    """Verify financial fields store exact Decimal precision without float inaccuracies."""
    user = User(
        email="financial_test@example.com",
        phone="9000000001",
        password_hash="hash",
    )
    db_session.add(user)
    db_session.flush()

    requested_amount = Decimal("250000.50")
    monthly_income = Decimal("75000.00")
    existing_debt = Decimal("12500.75")

    app = LoanApplication(
        application_number="EZ-FIN-001",
        user_id=user.id,
        requested_amount=requested_amount,
        monthly_income=monthly_income,
        existing_debt=existing_debt,
    )
    db_session.add(app)
    db_session.flush()

    db_session.refresh(app)
    assert isinstance(app.requested_amount, Decimal)
    assert app.requested_amount == requested_amount
    assert isinstance(app.monthly_income, Decimal)
    assert app.monthly_income == monthly_income
    assert isinstance(app.existing_debt, Decimal)
    assert app.existing_debt == existing_debt


def test_full_relationship_persistence(db_session: Session):
    """
    Verify full domain relationship tree can be persisted and traversed:
    User -> LoanApplication -> EligibilityCheck, LoanOffer -> LoanTerm, BankAccount,
    Declaration, SelfieVerification, AdminReview, Disbursement, AuditLog
    """
    # 1. User
    user = User(
        email="full_flow@example.com",
        phone="9111111111",
        password_hash="hashed_pw_xyz",
        role=UserRole.CUSTOMER,
    )
    admin = User(
        email="admin_flow@example.com",
        phone="9222222222",
        password_hash="hashed_pw_admin",
        role=UserRole.ADMIN,
    )
    db_session.add_all([user, admin])
    db_session.flush()

    # 2. Verification
    verification = UserVerification(
        user_id=user.id,
        verification_type=VerificationType.EMAIL,
        status=VerificationStatus.VERIFIED,
        verified_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db_session.add(verification)

    # 3. KYC
    kyc = KYCDetail(
        user_id=user.id,
        full_name="Rajesh Kumar",
        date_of_birth=datetime.date(1990, 5, 15),
        gender=Gender.MALE,
        address_line_1="123 MG Road",
        city="Bengaluru",
        state="Karnataka",
        pincode="560001",
        id_type=IDType.PAN,
        id_number_hash="sha256_hashed_pan_value",
    )
    db_session.add(kyc)

    # 4. Loan Application
    app = LoanApplication(
        application_number="EZ-2026-9999",
        user_id=user.id,
        status=ApplicationStatus.SUBMITTED,
        monthly_income=Decimal("80000.00"),
        requested_amount=Decimal("300000.00"),
        existing_debt=Decimal("10000.00"),
        credit_score=750,
        employer_name="Infosys",
        designation="Senior Engineer",
    )
    db_session.add(app)
    db_session.flush()

    # 5. Eligibility Check
    eligibility = EligibilityCheck(
        application_id=app.id,
        score=Decimal("85.50"),
        dti_ratio=Decimal("0.1250"),
        status=EligibilityStatus.ELIGIBLE,
        reasons={"rule_engine": "Passed all credit criteria"},
    )
    db_session.add(eligibility)

    # 6. Loan Offer + Terms
    offer = LoanOffer(
        application_id=app.id,
        principal=Decimal("300000.00"),
        interest_rate=Decimal("12.50"),
        processing_fee=Decimal("3000.00"),
        gst=Decimal("540.00"),
        status=OfferStatus.SELECTED,
    )
    db_session.add(offer)
    db_session.flush()

    term = LoanTerm(
        offer_id=offer.id,
        tenure_months=24,
        emi=Decimal("14192.50"),
        total_interest=Decimal("40620.00"),
        total_repayment=Decimal("340620.00"),
        total_charges=Decimal("3540.00"),
        net_disbursement=Decimal("296460.00"),
        irr=Decimal("13.2500"),
    )
    db_session.add(term)

    # 7. Bank Account
    bank = BankAccount(
        application_id=app.id,
        account_holder_name="Rajesh Kumar",
        account_number_hash="sha256_hashed_account_number",
        account_number_last4="4321",
        ifsc="HDFC0001234",
        bank_name="HDFC Bank",
    )
    db_session.add(bank)

    # 8. Declaration
    declaration = Declaration(
        application_id=app.id,
        accepted=True,
        declaration_version="v1.0",
        ip_address="127.0.0.1",
    )
    db_session.add(declaration)

    # 9. Selfie Verification
    selfie = SelfieVerification(
        application_id=app.id,
        storage_key="selfies/app_9999_selfie.jpg",
        verification_type=SelfieVerificationType.LIVE_PHOTO,
        status=SelfieVerificationStatus.VERIFIED,
        reviewed_by=admin.id,
    )
    db_session.add(selfie)

    # 10. Admin Review
    review = AdminReview(
        application_id=app.id,
        admin_id=admin.id,
        decision=ReviewDecision.APPROVED,
        remarks="All documents and credit score verified successfully.",
    )
    db_session.add(review)

    # 11. Disbursement
    disbursement = Disbursement(
        application_id=app.id,
        amount=Decimal("296460.00"),
        status=DisbursementStatus.SUCCESS,
        transaction_reference="TXN-2026-8888",
    )
    db_session.add(disbursement)

    # 12. Audit Log
    audit = AuditLog(
        actor_id=admin.id,
        application_id=app.id,
        action="APPLICATION_APPROVED",
        old_status=ApplicationStatus.UNDER_REVIEW.value,
        new_status=ApplicationStatus.APPROVED.value,
        metadata_={"reviewer": "admin@ezfinanz.com"},
    )
    db_session.add(audit)
    db_session.flush()

    # Verify traversal
    db_session.refresh(app)
    assert len(app.eligibility_checks) == 1
    assert len(app.offers) == 1
    assert len(app.offers[0].terms) == 1
    assert len(app.bank_accounts) == 1
    assert len(app.declarations) == 1
    assert len(app.selfie_verifications) == 1
    assert len(app.admin_reviews) == 1
    assert len(app.disbursements) == 1
    assert len(app.audit_logs) == 1
    assert app.offers[0].terms[0].emi == Decimal("14192.50")
