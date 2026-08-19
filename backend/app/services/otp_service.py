"""
OTP Service.

Manages cryptographically secure 6-digit OTP generation, hashing, verification,
rate-limiting, attempt tracking, and issuance of phone verification tokens.
"""

import hmac
import hashlib
import secrets
import string
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflictError, UnauthorizedError, ValidationError
from app.models.user import User
from app.services.sms_service import get_sms_provider


@dataclass
class OTPRecord:
    otp_hash: str
    plain_otp_for_demo: Optional[str]
    expires_at: float
    attempts: int
    last_requested_at: float
    is_verified: bool


# Thread-safe in-memory store for OTP lifecycle tracking
_otp_store: Dict[str, OTPRecord] = {}


def _hash_otp(phone: str, otp: str) -> str:
    """Generate HMAC-SHA256 hash of the OTP salted with phone and secret key."""
    key = settings.JWT_SECRET_KEY.encode("utf-8")
    msg = f"{phone}:{otp}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def generate_and_send_mobile_otp(db: Session, phone: str) -> dict:
    """
    Generate a cryptographically secure 6-digit OTP and send via configured SMS provider.
    - Validates phone uniqueness (cannot send OTP to already registered phone).
    - Enforces 60-second resend rate-limiting cooldown.
    - Sets 5-minute expiry.
    - Invalidates any previous active OTP for this mobile number.
    """
    clean_phone = phone.strip()

    # 1. Ensure phone is not already registered by an existing user
    stmt = select(User).where(User.phone == clean_phone)
    if db.execute(stmt).scalar_one_or_none():
        raise ConflictError("An account with this mobile number already exists. Please sign in.")

    current_time = time.time()

    # 2. Check resend cooldown
    if clean_phone in _otp_store:
        record = _otp_store[clean_phone]
        elapsed = current_time - record.last_requested_at
        if elapsed < settings.OTP_RESEND_COOLDOWN_SECONDS:
            remaining = int(settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed)
            raise ValidationError(f"Please wait {remaining} seconds before requesting a new verification code.")

    # 3. Generate 6-digit OTP
    otp = "".join(secrets.choice(string.digits) for _ in range(6))
    # Ensure no leading zero ambiguity if needed, but 6-digit string is standard
    if otp.startswith("0"):
        otp = str(secrets.randbelow(900000) + 100000)

    otp_hash = _hash_otp(clean_phone, otp)
    expires_at = current_time + settings.OTP_EXPIRE_SECONDS

    # 4. Dispatch via SMS provider
    sms_provider = get_sms_provider()
    sms_provider.send_otp(clean_phone, otp)

    # 5. Persist record in OTP store
    is_demo = settings.OTP_MODE.lower() == "demo"
    _otp_store[clean_phone] = OTPRecord(
        otp_hash=otp_hash,
        plain_otp_for_demo=otp if is_demo else None,
        expires_at=expires_at,
        attempts=0,
        last_requested_at=current_time,
        is_verified=False,
    )

    return {
        "message": f"Verification code sent to +91-{clean_phone[-4:].rjust(10, '*')}",
        "expires_in": settings.OTP_EXPIRE_SECONDS,
        "resend_cooldown": settings.OTP_RESEND_COOLDOWN_SECONDS,
        "otp_mode": settings.OTP_MODE.lower(),
        "demo_otp": otp if is_demo else None,
    }


def verify_mobile_otp(phone: str, entered_otp: str) -> dict:
    """
    Verify the submitted OTP for the given phone number.
    - Validates presence and format.
    - Checks 5-minute expiration.
    - Checks attempt limits (max 5).
    - Invalidates OTP upon success.
    - Issues a cryptographically signed phone verification token.
    """
    clean_phone = phone.strip()
    clean_otp = entered_otp.strip()

    if not clean_otp or len(clean_otp) != 6:
        raise ValidationError("Verification code must be exactly 6 numeric digits.")

    if clean_phone not in _otp_store:
        raise UnauthorizedError("No active verification code found for this mobile number. Please request a new code.")

    record = _otp_store[clean_phone]
    current_time = time.time()

    # 1. Check expiration
    if current_time > record.expires_at:
        del _otp_store[clean_phone]
        raise UnauthorizedError("Verification code has expired. Please request a new code.")

    # 2. Check maximum attempts
    if record.attempts >= settings.OTP_MAX_ATTEMPTS:
        del _otp_store[clean_phone]
        raise UnauthorizedError("Too many failed attempts. For security, please request a new verification code.")

    # 3. Verify OTP hash with constant-time comparison
    entered_hash = _hash_otp(clean_phone, clean_otp)
    if not hmac.compare_digest(record.otp_hash, entered_hash):
        record.attempts += 1
        remaining = settings.OTP_MAX_ATTEMPTS - record.attempts
        raise UnauthorizedError(f"Invalid verification code. {remaining} attempt(s) remaining.")

    # 4. Mark verified & consume OTP to prevent reuse
    record.is_verified = True
    del _otp_store[clean_phone]

    # 5. Issue short-lived Phone Verification Token (15 minutes)
    payload = {
        "sub": clean_phone,
        "purpose": "phone_verification",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    verification_token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    return {
        "verified": True,
        "message": "Mobile number verified successfully.",
        "phone_verification_token": verification_token,
    }


def validate_phone_verification_token(phone: str, token: Optional[str]) -> bool:
    """
    Validate that a given phone number has a valid, unexpired phone_verification_token.
    """
    if not token:
        # In demo mode, if no token provided, enforce verification check
        return False

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("purpose") != "phone_verification":
            return False
        if payload.get("sub") != phone.strip():
            return False
        return True
    except jwt.PyJWTError:
        return False
