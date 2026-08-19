"""
LoanApplication model.

The CENTRAL DOMAIN ENTITY of EZFINANZ.
Tracks the loan application through its entire lifecycle via status enum.
Financial fields use Numeric — never float.
State transition logic is NOT implemented here.
"""

import enum
import uuid

from sqlalchemy import String, Integer, Numeric, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ApplicationStatus(str, enum.Enum):
    """
    Complete state machine for the loan application lifecycle.
    Transitions will be enforced by the backend in a future phase.
    """
    DRAFT = "DRAFT"
    EMAIL_VERIFIED = "EMAIL_VERIFIED"
    PHONE_VERIFIED = "PHONE_VERIFIED"
    KYC_SUBMITTED = "KYC_SUBMITTED"
    KYC_VERIFIED = "KYC_VERIFIED"
    LOAN_DETAILS_SUBMITTED = "LOAN_DETAILS_SUBMITTED"
    ELIGIBILITY_CHECKED = "ELIGIBILITY_CHECKED"
    OFFER_SELECTED = "OFFER_SELECTED"
    BANK_ACCOUNT_ADDED = "BANK_ACCOUNT_ADDED"
    DECLARATION_SIGNED = "DECLARATION_SIGNED"
    SELFIE_UPLOADED = "SELFIE_UPLOADED"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    DISBURSEMENT_PROCESSING = "DISBURSEMENT_PROCESSING"
    DISBURSED = "DISBURSED"


class LoanApplication(Base):
    __tablename__ = "loan_applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="application_status", create_constraint=True),
        nullable=False,
        default=ApplicationStatus.DRAFT,
        index=True,
    )
    purpose: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    monthly_income: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=True
    )
    requested_amount: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=True
    )
    existing_debt: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=True
    )
    employment_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    employer_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    designation: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    requested_tenure_months: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    credit_score: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    created_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    submitted_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    # Relationships
    user = relationship("User", back_populates="loan_applications")
    eligibility_checks = relationship(
        "EligibilityCheck", back_populates="application", cascade="all, delete-orphan"
    )
    offers = relationship(
        "LoanOffer", back_populates="application", cascade="all, delete-orphan"
    )
    bank_accounts = relationship(
        "BankAccount", back_populates="application", cascade="all, delete-orphan"
    )
    declarations = relationship(
        "Declaration", back_populates="application", cascade="all, delete-orphan"
    )
    selfie_verifications = relationship(
        "SelfieVerification", back_populates="application", cascade="all, delete-orphan"
    )
    admin_reviews = relationship(
        "AdminReview", back_populates="application", cascade="all, delete-orphan"
    )
    disbursements = relationship(
        "Disbursement", back_populates="application", cascade="all, delete-orphan"
    )
    audit_logs = relationship(
        "AuditLog", back_populates="application"
    )

    __table_args__ = (
        Index("ix_loan_applications_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<LoanApplication id={self.id} "
            f"number={self.application_number} status={self.status}>"
        )
