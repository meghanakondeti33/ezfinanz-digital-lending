"""
Authentication request and response schemas.
"""

import re
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import validate_password_strength


class SendOtpRequest(BaseModel):
    """Payload for requesting an SMS verification OTP."""
    phone: str = Field(..., description="10-digit Indian mobile number")

    @field_validator("phone", mode="after")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean_phone = re.sub(r"[\s\-\(\)\+]", "", v)
        if clean_phone.startswith("91") and len(clean_phone) == 12:
            clean_phone = clean_phone[2:]
        if not re.match(r"^[6-9]\d{9}$", clean_phone):
            raise ValueError(
                "Phone number must be a valid 10-digit mobile number starting with 6, 7, 8, or 9."
            )
        return clean_phone

    model_config = {
        "extra": "forbid",
    }


class SendOtpResponse(BaseModel):
    """Response contract for OTP dispatch."""
    message: str
    expires_in: int
    resend_cooldown: int
    otp_mode: str
    demo_otp: Optional[str] = None


class VerifyOtpRequest(BaseModel):
    """Payload for verifying an SMS OTP."""
    phone: str = Field(..., description="10-digit Indian mobile number")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")

    @field_validator("phone", mode="after")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean_phone = re.sub(r"[\s\-\(\)\+]", "", v)
        if clean_phone.startswith("91") and len(clean_phone) == 12:
            clean_phone = clean_phone[2:]
        if not re.match(r"^[6-9]\d{9}$", clean_phone):
            raise ValueError(
                "Phone number must be a valid 10-digit mobile number starting with 6, 7, 8, or 9."
            )
        return clean_phone

    @field_validator("otp", mode="after")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        clean_otp = v.strip()
        if not re.match(r"^\d{6}$", clean_otp):
            raise ValueError("Verification code must be exactly 6 numeric digits.")
        return clean_otp

    model_config = {
        "extra": "forbid",
    }


class VerifyOtpResponse(BaseModel):
    """Response contract for successful OTP verification."""
    verified: bool
    message: str
    phone_verification_token: str


class RegisterRequest(BaseModel):
    """
    Customer registration payload.
    Public registrations cannot specify a role and are always created as CUSTOMER.
    """
    email: EmailStr = Field(..., description="Valid email address")
    phone: str = Field(..., description="10-digit mobile number")
    password: str = Field(..., min_length=8, max_length=128, description="Strong password")
    phone_verification_token: Optional[str] = Field(
        None, description="Cryptographic token issued after successful mobile OTP verification"
    )

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    @field_validator("phone", mode="after")
    @classmethod
    def validate_phone(cls, v: str) -> str:
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


class SendEmailVerificationRequest(BaseModel):
    """Payload for dispatching or resending an email verification link."""
    email: Optional[EmailStr] = Field(None, description="Target email address (optional if authenticated)")

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: Optional[EmailStr]) -> Optional[str]:
        if v is not None:
            return str(v).strip().lower()
        return None

    model_config = {
        "extra": "forbid",
    }


class SendEmailVerificationResponse(BaseModel):
    """Response contract for email verification dispatch."""
    message: str
    status: str
    mode: str
    verify_url: Optional[str] = None
    cooldown_seconds: int


class VerifyEmailRequest(BaseModel):
    """Payload for confirming an email verification token."""
    token: str = Field(..., description="Cryptographically signed email verification token")

    model_config = {
        "extra": "forbid",
    }


class VerifyEmailResponse(BaseModel):
    """Response contract for email verification confirmation."""
    message: str
    email_verified: bool
    email: str
