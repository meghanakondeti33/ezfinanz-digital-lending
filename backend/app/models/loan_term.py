"""
LoanTerm model.

Represents selected repayment terms for a loan offer.
All financial fields use Numeric/Decimal.
EMI / IRR calculation logic is NOT implemented here.
"""

import uuid

from sqlalchemy import Integer, Numeric, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class LoanTerm(Base):
    __tablename__ = "loan_terms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    offer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("loan_offers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenure_months: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    emi: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    total_interest: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    total_repayment: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    total_charges: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    net_disbursement: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    irr: Mapped[None] = mapped_column(
        Numeric(7, 4), nullable=True
    )
    selected_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    offer = relationship("LoanOffer", back_populates="terms")

    def __repr__(self) -> str:
        return f"<LoanTerm id={self.id} tenure={self.tenure_months} emi={self.emi}>"
