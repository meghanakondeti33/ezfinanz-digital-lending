"""
BankAccount model.

Stores bank account information associated with a loan application.
Account number is protected/hashed, only last 4 digits stored unhashed.
Bank verification logic is NOT implemented here.
"""

import uuid

from sqlalchemy import String, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_holder_name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    # Sensitive — store only encrypted/hashed representation
    account_number_hash: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    account_number_last4: Mapped[str] = mapped_column(
        String(4), nullable=False
    )
    ifsc: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    bank_name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    created_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    application = relationship("LoanApplication", back_populates="bank_accounts")

    def __repr__(self) -> str:
        return f"<BankAccount id={self.id} bank={self.bank_name} last4={self.account_number_last4}>"
