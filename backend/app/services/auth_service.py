"""
Authentication Service.

Encapsulates user registration, credential verification, and token issuance.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse


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
