"""
User response schemas.

Safely projects User domain models into API contracts without exposing password_hash.
"""

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole


class UserResponse(BaseModel):
    """Safe public representation of a User entity."""
    id: uuid.UUID
    email: str
    phone: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
