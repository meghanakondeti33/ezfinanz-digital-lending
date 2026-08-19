"""
Authentication API endpoints.

Provides public routes for customer registration, mobile OTP generation/verification,
email/password login, Google Identity Services OAuth, and authenticated profile retrieval.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import (
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    SendEmailVerificationRequest,
    SendEmailVerificationResponse,
    SendOtpRequest,
    SendOtpResponse,
    TokenResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.schemas.user import UserResponse
from app.services.auth_service import (
    authenticate_google_user,
    authenticate_user,
    register_user,
    send_user_email_verification,
    verify_user_email,
)
from app.services.otp_service import generate_and_send_mobile_otp, verify_mobile_otp

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/send-mobile-otp",
    response_model=SendOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate and send SMS OTP to mobile number",
)
def send_mobile_otp(
    request: SendOtpRequest,
    db: Session = Depends(get_db),
) -> SendOtpResponse:
    """
    Generates a secure 6-digit OTP, enforces rate-limiting, and dispatches via configured SMS provider.
    """
    result = generate_and_send_mobile_otp(db, request.phone)
    return SendOtpResponse(**result)


@router.post(
    "/verify-mobile-otp",
    response_model=VerifyOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify mobile OTP and issue phone verification token",
)
def verify_otp(
    request: VerifyOtpRequest,
) -> VerifyOtpResponse:
    """
    Verifies 6-digit OTP code against hash and expiration, and returns cryptographic phone verification token.
    """
    result = verify_mobile_otp(request.phone, request.otp)
    return VerifyOtpResponse(**result)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new customer",
)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
) -> UserResponse:
    """
    Public registration endpoint.
    Creates a new user account with role CUSTOMER after mobile OTP verification.
    """
    user = register_user(db, request)
    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate and receive JWT access token",
)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Public login endpoint.
    Verifies user credentials and returns a short-lived JWT token.
    """
    return authenticate_user(db, request)


@router.post(
    "/google",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate via Google Identity Services",
)
def google_auth(
    request: GoogleAuthRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Google Identity Services login & customer auto-provisioning endpoint.
    Verifies Google ID token, finds or creates CUSTOMER account, and issues JWT access token.
    """
    return authenticate_google_user(db, request)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """
    Protected profile endpoint.
    Returns the profile information of the currently authenticated user.
    """
    return UserResponse.model_validate(current_user)


@router.post(
    "/send-email-verification",
    response_model=SendEmailVerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Send or resend email verification link",
)
@router.post(
    "/resend-email-verification",
    response_model=SendEmailVerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend email verification link",
)
def send_email_verification(
    request: SendEmailVerificationRequest,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> SendEmailVerificationResponse:
    """
    Dispatches a time-limited signed verification link to the target email or currently authenticated user.
    Enforces a 60-second cooldown on resends.
    """
    result = send_user_email_verification(db, request.email, current_user)
    return SendEmailVerificationResponse(**result)


@router.post(
    "/verify-email",
    response_model=VerifyEmailResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify email with signed token (POST)",
)
def verify_email(
    request: VerifyEmailRequest,
    db: Session = Depends(get_db),
) -> VerifyEmailResponse:
    """
    Validates the signed token and permanently sets email_verified = True.
    """
    user = verify_user_email(db, request.token)
    return VerifyEmailResponse(
        message="Your email address has been successfully verified.",
        email_verified=user.email_verified,
        email=user.email,
    )


@router.get(
    "/verify-email",
    response_model=VerifyEmailResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify email with signed token (GET link)",
)
def verify_email_get(
    token: str,
    db: Session = Depends(get_db),
) -> VerifyEmailResponse:
    """
    Direct link endpoint for confirming email verification from an email client.
    """
    user = verify_user_email(db, token)
    return VerifyEmailResponse(
        message="Your email address has been successfully verified.",
        email_verified=user.email_verified,
        email=user.email,
    )
