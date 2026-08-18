"""
EligibilityCheck model.

Stores historical eligibility decisions for a loan application.
One application may have multiple checks.
Eligibility calculation logic is NOT implemented here.
"""

import enum
import uuid

from sqlalchemy import Numeric, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class EligibilityStatus(str, enum.Enum):
    ELIGIBLE = "ELIGIBLE"
    INELIGIBLE = "INELIGIBLE"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class EligibilityCheck(Base):
    __tablename__ = "eligibility_checks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    score: Mapped[None] = mapped_column(
        Numeric(7, 2), nullable=True
    )
    dti_ratio: Mapped[None] = mapped_column(
        Numeric(7, 4), nullable=True
    )
    status: Mapped[EligibilityStatus] = mapped_column(
        Enum(EligibilityStatus, name="eligibility_status", create_constraint=True),
        nullable=False,
    )
    reasons = mapped_column(
        JSONB, nullable=True
    )
    calculated_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    application = relationship("LoanApplication", back_populates="eligibility_checks")

    def __repr__(self) -> str:
        return f"<EligibilityCheck id={self.id} status={self.status}>"
