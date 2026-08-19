"""
Disbursement model.

Stores disbursement execution details and transaction references.
Disbursement execution logic is NOT implemented here.
"""

import enum
import uuid
from decimal import Decimal

from sqlalchemy import String, Numeric, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DisbursementStatus(str, enum.Enum):
    PENDING = "PENDING"
    INITIATED = "INITIATED"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class Disbursement(Base):
    __tablename__ = "disbursements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    net_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 2), nullable=True
    )
    destination_account_summary: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    bank_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bank_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[DisbursementStatus] = mapped_column(
        Enum(DisbursementStatus, name="disbursement_status", create_constraint=True),
        nullable=False,
        default=DisbursementStatus.PENDING,
    )
    transaction_reference: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )
    initiated_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    failure_reason: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )

    # Relationships
    application = relationship("LoanApplication", back_populates="disbursements")
    bank_account = relationship("BankAccount")

    def __repr__(self) -> str:
        return f"<Disbursement id={self.id} amount={self.amount} net_amount={self.net_amount} status={self.status}>"
