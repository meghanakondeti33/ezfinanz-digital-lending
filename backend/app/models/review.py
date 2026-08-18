"""
AdminReview model.

Stores administrative review decisions for loan applications.
Admin review logic is NOT implemented here.
"""

import enum
import uuid

from sqlalchemy import String, Text, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ReviewDecision(str, enum.Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FURTHER_INFO_REQUIRED = "FURTHER_INFO_REQUIRED"


class AdminReview(Base):
    __tablename__ = "admin_reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    decision: Mapped[ReviewDecision] = mapped_column(
        Enum(ReviewDecision, name="review_decision", create_constraint=True),
        nullable=False,
    )
    remarks: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    created_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    application = relationship("LoanApplication", back_populates="admin_reviews")
    admin = relationship("User", foreign_keys=[admin_id])

    def __repr__(self) -> str:
        return f"<AdminReview id={self.id} decision={self.decision}>"
