"""
Declaration model.

Stores customer declaration acceptance for a loan application.
Declaration workflow logic is NOT implemented here.
"""

import uuid

from sqlalchemy import String, Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Declaration(Base):
    __tablename__ = "declarations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    accepted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    declaration_version: Mapped[str] = mapped_column(
        String(50), nullable=False, default="v1.0"
    )
    accepted_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )

    # Relationships
    application = relationship("LoanApplication", back_populates="declarations")

    def __repr__(self) -> str:
        return f"<Declaration id={self.id} accepted={self.accepted} version={self.declaration_version}>"
