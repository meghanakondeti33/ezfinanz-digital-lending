"""
SelfieVerification model.

Stores selfie verification metadata, reviewer decisions, and storage keys.
"""

import enum
import uuid

from sqlalchemy import String, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class SelfieVerificationType(str, enum.Enum):
    LIVE_PHOTO = "LIVE_PHOTO"
    DOCUMENT_MATCH = "DOCUMENT_MATCH"


class SelfieVerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    PHOTO_PENDING_REVIEW = "PHOTO_PENDING_REVIEW"
    PHOTO_APPROVED = "PHOTO_APPROVED"
    PHOTO_RETAKE_REQUIRED = "PHOTO_RETAKE_REQUIRED"


class SelfieVerification(Base):
    __tablename__ = "selfie_verifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    storage_key: Mapped[str] = mapped_column(
        String(500), nullable=False
    )
    verification_type: Mapped[SelfieVerificationType] = mapped_column(
        Enum(SelfieVerificationType, name="selfie_verification_type", create_constraint=False),
        nullable=False,
        default=SelfieVerificationType.LIVE_PHOTO,
    )
    status: Mapped[SelfieVerificationStatus] = mapped_column(
        Enum(SelfieVerificationStatus, name="selfie_verification_status", create_constraint=False),
        nullable=False,
        default=SelfieVerificationStatus.PHOTO_PENDING_REVIEW,
    )
    rejection_reason: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    submitted_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    reviewed_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    # Relationships
    application = relationship("LoanApplication", back_populates="selfie_verifications")
    reviewer = relationship("User", foreign_keys=[reviewed_by])

    def __repr__(self) -> str:
        return f"<SelfieVerification id={self.id} status={self.status}>"
