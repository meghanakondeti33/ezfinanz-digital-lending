"""
KYC Details model.

Stores Know-Your-Customer information.
Sensitive fields (id_number_hash) are stored as hashed values.
KYC workflow logic is NOT implemented here.
"""

import enum
import uuid

from sqlalchemy import String, Date, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class IDType(str, enum.Enum):
    AADHAAR = "AADHAAR"
    PAN = "PAN"
    PASSPORT = "PASSPORT"
    DRIVING_LICENSE = "DRIVING_LICENSE"
    VOTER_ID = "VOTER_ID"


class KYCDetail(Base):
    __tablename__ = "kyc_details"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth = mapped_column(Date, nullable=False)
    gender: Mapped[Gender] = mapped_column(
        Enum(Gender, name="gender_type", create_constraint=True),
        nullable=False,
    )
    address_line_1: Mapped[str] = mapped_column(String(500), nullable=False)
    address_line_2: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    pincode: Mapped[str] = mapped_column(String(10), nullable=False)
    id_type: Mapped[IDType] = mapped_column(
        Enum(IDType, name="id_document_type", create_constraint=True),
        nullable=False,
    )
    # Sensitive — store only a hash/encrypted representation
    id_number_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    document_storage_key: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    document_filename: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    document_status: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default="KYC_NOT_SUBMITTED"
    )
    document_rejection_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    document_uploaded_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
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

    # Relationships
    user = relationship("User", back_populates="kyc_details")

    def __repr__(self) -> str:
        return f"<KYCDetail id={self.id} user_id={self.user_id}>"
