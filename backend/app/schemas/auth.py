"""
Authentication request and response schemas.
"""

import re
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import validate_password_strength


class RegisterRequest(BaseModel):
    """
    Customer registration payload.
    Public registrations cannot specify a role and are always created as CUSTOMER.
    """
    email: EmailStr = Field(..., description="Valid email address")
    phone: str = Field(..., description="10-digit mobile number")
    password: str = Field(..., min_length=8, max_length=128, description="Strong password")

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    @field_validator("phone", mode="after")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        # Strip spaces and country code prefixes if present
        clean_phone = re.sub(r"[\s\-\(\)\+]", "", v)
        if clean_phone.startswith("91") and len(clean_phone) == 12:
            clean_phone = clean_phone[2:]
        if not re.match(r"^[6-9]\d{9}$", clean_phone):
            raise ValueError(
                "Phone number must be a valid 10-digit mobile number starting with 6, 7, 8, or 9."
            )
        return clean_phone

    @field_validator("password", mode="after")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        validate_password_strength(v)
        return v

    model_config = {
        "extra": "forbid",  # Reject unexpected fields such as 'role'
    }


class LoginRequest(BaseModel):
    """Credentials payload for user authentication."""
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., description="Account password")

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    model_config = {
        "extra": "forbid",
    }


class GoogleAuthRequest(BaseModel):
    """Payload containing Google ID token or OAuth access token from Google Identity Services."""
    credential: Optional[str] = Field(None, description="Google ID token")
    access_token: Optional[str] = Field(None, description="Google OAuth access token")

    model_config = {
        "extra": "forbid",
    }


class TokenResponse(BaseModel):
    """JWT Access Token response contract."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(
        ..., description="Token lifespan in seconds"
    )
