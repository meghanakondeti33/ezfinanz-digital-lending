"""
AuditLog model.

Provides immutable traceability for important actions and status transitions.
Audit event dispatching logic is NOT implemented here.
"""

import uuid

from sqlalchemy import String, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    old_status: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    new_status: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    metadata_ = mapped_column(
        "metadata", JSONB, nullable=True
    )
    created_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    actor = relationship("User", foreign_keys=[actor_id])
    application = relationship("LoanApplication", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} action={self.action} created_at={self.created_at}>"
