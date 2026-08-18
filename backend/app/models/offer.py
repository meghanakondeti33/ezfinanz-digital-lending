"""
LoanOffer model.

Represents loan offers generated for an application.
Financial fields use Numeric/Decimal.
Offer-generation logic is NOT implemented here.
"""

import enum
import uuid

from sqlalchemy import Numeric, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class OfferStatus(str, enum.Enum):
    GENERATED = "GENERATED"
    SELECTED = "SELECTED"
    EXPIRED = "EXPIRED"
    REJECTED = "REJECTED"


class LoanOffer(Base):
    __tablename__ = "loan_offers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    principal: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    interest_rate: Mapped[None] = mapped_column(
        Numeric(5, 2), nullable=False
    )
    processing_fee: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    gst: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    other_charges: Mapped[None] = mapped_column(
        Numeric(15, 2), nullable=False, default=0.00
    )
    status: Mapped[OfferStatus] = mapped_column(
        Enum(OfferStatus, name="offer_status", create_constraint=True),
        nullable=False,
        default=OfferStatus.GENERATED,
    )
    created_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    application = relationship("LoanApplication", back_populates="offers")
    terms = relationship("LoanTerm", back_populates="offer", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<LoanOffer id={self.id} principal={self.principal} status={self.status}>"
