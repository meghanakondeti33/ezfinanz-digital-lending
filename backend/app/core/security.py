"""
Core security utilities: Argon2id password hashing and JWT token handling.

Enforces memory-hard password hashing, centralized password policy validation,
and secure short-lived access token creation and decoding.
"""

import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHash

from app.core.config import settings
from app.core.exceptions import UnauthorizedError, ValidationError

# Initialize Argon2id password hasher
_hasher = PasswordHasher()

# Centralized password policy parameters
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def hash_password(password: str) -> str:
    """
    Hash a plaintext password using Argon2id.
    Never stores or logs the plaintext password.
    """
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """
    Verify a plaintext password against an Argon2id password hash.
    Returns True if valid, False otherwise.
    """
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHash):
        return False


def validate_password_strength(password: str) -> None:
    """
    Centralized password policy validator.
    Requirements:
    - Between 8 and 128 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one digit (0-9)
    - At least one special character
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
        )
    if len(password) > MAX_PASSWORD_LENGTH:
        raise ValidationError(
            f"Password must not exceed {MAX_PASSWORD_LENGTH} characters."
        )
    if not re.search(r"[A-Z]", password):
        raise ValidationError("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise ValidationError("Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", password):
        raise ValidationError("Password must contain at least one number.")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>\-_+=\[\]\\/`~]', password):
        raise ValidationError(
            "Password must contain at least one special character."
        )


def create_access_token(
    user_id: uuid.UUID | str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token containing only minimal necessary claims:
    - sub (user UUID string)
    - role (CUSTOMER / ADMIN)
    - iat (issued at timestamp)
    - exp (expiration timestamp)
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT access token.
    Raises UnauthorizedError if token is invalid, expired, or missing claims.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["sub", "role", "exp", "iat"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise UnauthorizedError("Invalid authentication token.")
