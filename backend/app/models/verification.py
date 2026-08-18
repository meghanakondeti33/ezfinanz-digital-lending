"""
UserVerification model.

Tracks email and phone verification state per user.
OTP generation/verification logic is NOT implemented here.
"""

import enum
import uuid

from sqlalchemy import String, Integer, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class VerificationType(str, enum.Enum):
    EMAIL = "EMAIL"
    PHONE = "PHONE"


class VerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    EXPIRED = "EXPIRED"
    FAILED = "FAILED"


class UserVerification(Base):
    __tablename__ = "user_verifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    verification_type: Mapped[VerificationType] = mapped_column(
        Enum(VerificationType, name="verification_type", create_constraint=True),
        nullable=False,
    )
    status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, name="verification_status", create_constraint=True),
        nullable=False,
        default=VerificationStatus.PENDING,
    )
    otp_hash: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    expires_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    verified_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    attempt_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    created_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="verifications")

    def __repr__(self) -> str:
        return (
            f"<UserVerification id={self.id} "
            f"type={self.verification_type} status={self.status}>"
        )
