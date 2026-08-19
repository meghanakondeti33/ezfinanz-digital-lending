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
from app.schemas.auth import (
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    SendEmailVerificationResponse,
    TokenResponse,
    VerifyEmailResponse,
)
from app.services.email_service import (
    create_email_verification_token,
    send_verification_email,
    verify_email_verification_token,
)
from app.services.otp_service import validate_phone_verification_token


def register_user(db: Session, request: RegisterRequest) -> User:
    """
    Register a new customer.
    Enforces uniqueness of email and phone, phone verification token validity,
    and applies Argon2id password hashing. Always assigns the CUSTOMER role with email_verified=False.
    """
    clean_email = request.email.strip().lower()
    clean_phone = request.phone.strip()

    # 0. Enforce Phone Verification Token if present or if in SMS mode
    if request.phone_verification_token:
        is_valid = validate_phone_verification_token(clean_phone, request.phone_verification_token)
        if not is_valid:
            raise UnauthorizedError("Invalid or expired mobile verification token. Please verify your phone number via OTP.")
    elif settings.OTP_MODE.lower() == "sms":
        raise UnauthorizedError("Mobile verification required. Please verify your phone number via OTP before registering.")

    # 1. Check for duplicate email
    email_stmt = select(User).where(User.email == clean_email)
    if db.execute(email_stmt).scalar_one_or_none():
        raise ConflictError("An account with this email address already exists.")

    # 2. Check for duplicate phone number
    phone_stmt = select(User).where(User.phone == clean_phone)
    if db.execute(phone_stmt).scalar_one_or_none():
        raise ConflictError("An account with this phone number already exists.")

    # 3. Hash password using Argon2id
    hashed_password = hash_password(request.password)

    # 4. Create and persist user entity (strictly role=CUSTOMER, email_verified=False)
    new_user = User(
        email=clean_email,
        phone=clean_phone,
        password_hash=hashed_password,
        role=UserRole.CUSTOMER,
        is_active=True,
        email_verified=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 5. Automatically dispatch email verification link
    try:
        verif_token = create_email_verification_token(str(new_user.id), clean_email)
        send_verification_email(clean_email, verif_token)
    except Exception:
        # Non-critical during registration transaction
        pass

    return new_user


def ensure_default_accounts(db: Session):
    """
    Guarantees default development admin and customer accounts are always provisioned.
    """
    # 1. Admin
    admin_user = db.execute(select(User).where(User.email == "admin@ezfinanz.com")).scalar_one_or_none()
    if not admin_user:
        try:
            admin_user = User(
                email="admin@ezfinanz.com",
                phone="8888888888",
                password_hash=hash_password("AdminPass@123"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin_user)
            db.commit()
        except Exception:
            db.rollback()

    # 2. Customer Demo
    cust_user = db.execute(select(User).where(User.email == "customer@ezfinanz.com")).scalar_one_or_none()
    if not cust_user:
        try:
            cust_user = User(
                email="customer@ezfinanz.com",
                phone="9999999999",
                password_hash=hash_password("Password@123"),
                role=UserRole.CUSTOMER,
                is_active=True,
            )
            db.add(cust_user)
            db.commit()
        except Exception:
            db.rollback()


def authenticate_user(db: Session, request: LoginRequest) -> TokenResponse:
    """
    Authenticate a user by email and password.
    Returns a short-lived JWT access token upon successful authentication.
    Uses generic error responses to prevent account enumeration.
    """
    clean_email = request.email.strip().lower()
    stmt = select(User).where(User.email == clean_email)
    user = db.execute(stmt).scalar_one_or_none()

    # Self-healing fallback: if default admin/customer missing (e.g. after test run or fresh DB), provision automatically
    if not user and clean_email in ("admin@ezfinanz.com", "customer@ezfinanz.com"):
        ensure_default_accounts(db)
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
            clock_skew_in_seconds=60,
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
        # If Google verified the email, ensure email_verified is marked True
        if id_info.get("email_verified") and not user.email_verified:
            user.email_verified = True
            db.commit()
            db.refresh(user)
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
            email_verified=bool(id_info.get("email_verified", True)),
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


def verify_user_email(db: Session, token: str) -> User:
    """
    Validates a signed email verification token and marks the corresponding user's email_verified = True.
    """
    payload = verify_email_verification_token(token)
    user_id_str = payload["uid"]
    email = payload["em"]

    try:
        user_id = uuid.UUID(user_id_str)
    except Exception:
        raise ValidationError("Invalid user ID in verification token.")

    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise NotFoundError("User account associated with this verification link was not found.")

    if user.email.lower() != email.lower():
        raise UnauthorizedError("Email verification link does not match current account email.")

    if user.email_verified:
        return user  # Already verified, idempotent success

    user.email_verified = True
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def send_user_email_verification(db: Session, target_email: str | None, current_user: User | None) -> dict:
    """
    Dispatches a verification email link to the requested email or current user.
    """
    if current_user:
        user = current_user
    elif target_email:
        clean_email = target_email.strip().lower()
        user = db.execute(select(User).where(User.email == clean_email)).scalar_one_or_none()
        if not user:
            # Generic response to prevent user enumeration
            return {
                "message": "If an account exists with this email, a verification link has been sent.",
                "status": "sent",
                "mode": settings.EMAIL_MODE,
                "verify_url": None,
                "cooldown_seconds": settings.EMAIL_RESEND_COOLDOWN_SECONDS,
            }
    else:
        raise ValidationError("Email address or active session is required.")

    if user.email_verified:
        return {
            "message": "Your email address is already verified.",
            "status": "already_verified",
            "mode": settings.EMAIL_MODE,
            "verify_url": None,
            "cooldown_seconds": 0,
        }

    token = create_email_verification_token(str(user.id), user.email)
    result = send_verification_email(user.email, token)
    return {
        "message": f"Verification email sent to {user.email}.",
        "status": result["status"],
        "mode": result["mode"],
        "verify_url": result.get("verify_url"),
        "cooldown_seconds": result.get("cooldown_seconds", settings.EMAIL_RESEND_COOLDOWN_SECONDS),
    }
