"""
Authentication Service.

Encapsulates user registration, credential verification, Google Identity Services OAuth,
and token issuance.
"""

import secrets
import uuid
import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.auth import GoogleAuthRequest, LoginRequest, RegisterRequest, TokenResponse


def register_user(db: Session, request: RegisterRequest) -> User:
    """
    Register a new customer.
    Enforces uniqueness of email and phone and applies Argon2id password hashing.
    Always assigns the CUSTOMER role.
    """
    # 1. Check for duplicate email
    email_stmt = select(User).where(User.email == request.email)
    if db.execute(email_stmt).scalar_one_or_none():
        raise ConflictError("An account with this email address already exists.")

    # 2. Check for duplicate phone number
    phone_stmt = select(User).where(User.phone == request.phone)
    if db.execute(phone_stmt).scalar_one_or_none():
        raise ConflictError("An account with this phone number already exists.")

    # 3. Hash password using Argon2id
    hashed_password = hash_password(request.password)

    # 4. Create and persist user entity (strictly role=CUSTOMER)
    new_user = User(
        email=request.email,
        phone=request.phone,
        password_hash=hashed_password,
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


def authenticate_user(db: Session, request: LoginRequest) -> TokenResponse:
    """
    Authenticate a user by email and password.
    Returns a short-lived JWT access token upon successful authentication.
    Uses generic error responses to prevent account enumeration.
    """
    stmt = select(User).where(User.email == request.email)
    user = db.execute(stmt).scalar_one_or_none()

    # Generic authentication failure check to prevent user enumeration
    if not user or not verify_password(request.password, user.password_hash):
        raise UnauthorizedError("Invalid email or password.")

    if not user.is_active:
        raise UnauthorizedError("Your account has been deactivated. Please contact support.")

    # Generate JWT token
    access_token = create_access_token(
        user_id=user.id,
        role=user.role.value,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def verify_google_id_token(credential: str) -> dict:
    """
    Verify Google ID token cryptographically against Google's public keys.
    Validates signature, expiration, issuer, audience, and email verification status.
    """
    try:
        request_adapter = google_requests.Request()
        audience = settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID else None

        id_info = id_token.verify_oauth2_token(
            credential,
            request_adapter,
            audience=audience,
        )

        # Validate issuer
        if id_info.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
            raise UnauthorizedError("Invalid token issuer. Untrusted authentication source.")

        # Validate audience if GOOGLE_CLIENT_ID is configured
        if settings.GOOGLE_CLIENT_ID and id_info.get("aud") != settings.GOOGLE_CLIENT_ID:
            raise UnauthorizedError("Token audience does not match configured Google Client ID.")

        # Ensure email is present
        email = id_info.get("email")
        if not email:
            raise UnauthorizedError("Google ID token does not contain an email address.")

        # Ensure email is verified by Google
        if not id_info.get("email_verified"):
            raise UnauthorizedError("Google email is not verified. Please verify your email with Google.")

        return id_info
    except UnauthorizedError:
        raise
    except Exception as exc:
        raise UnauthorizedError(f"Google authentication failed: {str(exc)}") from exc


def verify_google_access_token(access_token: str) -> dict:
    """
    Verify Google OAuth access token by querying Google's userinfo endpoint.
    Ensures email is present and marked verified by Google.
    """
    try:
        resp = httpx.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )
        if resp.status_code != 200:
            raise UnauthorizedError("Invalid or expired Google access token.")

        data = resp.json()
        email = data.get("email")
        if not email:
            raise UnauthorizedError("Google profile does not contain an email address.")

        if not data.get("email_verified"):
            raise UnauthorizedError("Google email is not verified.")

        return data
    except UnauthorizedError:
        raise
    except Exception as exc:
        raise UnauthorizedError(f"Google access token verification failed: {str(exc)}") from exc


def authenticate_google_user(db: Session, request: GoogleAuthRequest) -> TokenResponse:
    """
    Authenticate or auto-provision a customer account using a verified Google ID token or OAuth access token.
    1. Cryptographically verifies Google ID token or queries Google userinfo for access tokens.
    2. Finds existing user by verified Google email or provisions a new CUSTOMER.
    3. Issues standard EZFINANZ JWT access token.
    """
    if request.credential:
        id_info = verify_google_id_token(request.credential)
    elif request.access_token:
        id_info = verify_google_access_token(request.access_token)
    else:
        raise UnauthorizedError("Neither credential nor access_token was provided.")

    email = id_info["email"].strip().lower()

    # Find existing user by verified email
    stmt = select(User).where(User.email == email)
    user = db.execute(stmt).scalar_one_or_none()

    if user:
        if not user.is_active:
            raise UnauthorizedError("Your account has been deactivated. Please contact support.")
    else:
        # Auto-provision new CUSTOMER account (strictly role=CUSTOMER)
        random_pwd = secrets.token_urlsafe(32)
        unique_phone_placeholder = f"G{uuid.uuid4().hex[:12]}"

        user = User(
            email=email,
            phone=unique_phone_placeholder,
            password_hash=hash_password(random_pwd),
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Issue standard EZFINANZ JWT access token
    access_token = create_access_token(
        user_id=user.id,
        role=user.role.value,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
