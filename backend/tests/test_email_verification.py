"""
Tests for Email Verification Workflow (Feature 1).
"""

import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User, UserRole
from app.services.email_service import (
    MOCK_OUTBOX,
    create_email_verification_token,
    verify_email_verification_token,
)


def test_registration_creates_unverified_user(client: TestClient, db_session: Session):
    """
    Test that regular registration creates a user with email_verified = False.
    """
    email = "unverified_test@ezfinanz.com"
    phone = "9876540001"
    password = "SecurePassword123!"

    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "phone": phone, "password": password},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["email_verified"] is False

    # Check database
    user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one()
    assert user.email_verified is False


def test_email_verification_token_generation_and_validation():
    """
    Test HMAC-SHA256 token generation, valid decode, and tamper protection.
    """
    from app.core.exceptions import UnauthorizedError

    user_id = "11111111-2222-3333-4444-555555555555"
    email = "token_test@ezfinanz.com"

    token = create_email_verification_token(user_id=user_id, email=email)
    assert isinstance(token, str)

    # Valid decode
    payload = verify_email_verification_token(token)
    assert payload["uid"] == user_id
    assert payload["em"] == email

    # Tampered token
    tampered_token = token[:-5] + "abcde"
    with pytest.raises(UnauthorizedError):
        verify_email_verification_token(tampered_token)


def test_verify_email_endpoints(client: TestClient, db_session: Session):
    """
    Test GET /api/v1/auth/verify-email?token=... and POST /api/v1/auth/send-email-verification.
    """
    from app.services.email_service import _RESEND_TIMESTAMPS

    email = "flow_test@ezfinanz.com"
    phone = "9876540002"
    password = "SecurePassword123!"

    MOCK_OUTBOX.clear()
    _RESEND_TIMESTAMPS.clear()

    # 1. Register (dispatches initial verification email)
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "phone": phone, "password": password},
    )
    assert reg_resp.status_code == 201
    assert len(MOCK_OUTBOX) == 1
    sent_token = MOCK_OUTBOX[0]["token"]

    # 2. Resending immediately without clearing cooldown triggers 429
    cooldown_resp = client.post(
        "/api/v1/auth/send-email-verification",
        json={"email": email},
    )
    assert cooldown_resp.status_code == 429

    # 3. Verify email with GET endpoint
    verify_resp = client.get(f"/api/v1/auth/verify-email?token={sent_token}")
    assert verify_resp.status_code == 200
    assert verify_resp.json()["email_verified"] is True

    # 4. Check user record is now verified in DB
    user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one()
    assert user.email_verified is True

    # 5. Clear cooldown and re-send after already verified should inform user
    _RESEND_TIMESTAMPS.clear()
    resend_again = client.post(
        "/api/v1/auth/resend-email-verification",
        json={"email": email},
    )
    assert resend_again.status_code == 200
    assert "already verified" in resend_again.json()["message"].lower()


def test_smtp_mode_invokes_smtplib_and_does_not_return_mock_link(client: TestClient, db_session: Session, monkeypatch):
    """
    Test that when EMAIL_MODE=smtp:
    1. Real smtplib dispatch is invoked
    2. Response does NOT return verify_url (no mock shortcut exposed)
    """
    from unittest.mock import MagicMock
    from app.services.email_service import _RESEND_TIMESTAMPS

    smtp_mock = MagicMock()
    monkeypatch.setattr("smtplib.SMTP", MagicMock(return_value=smtp_mock))
    monkeypatch.setattr(settings, "EMAIL_MODE", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USER", "tester@gmail.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "testpassword1234")
    monkeypatch.setattr(settings, "SMTP_USE_TLS", True)

    email = "smtp_test@ezfinanz.com"
    _RESEND_TIMESTAMPS.clear()

    # Register user
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "phone": "9876500099", "password": "Password123!"},
    )
    assert reg.status_code == 201

    # Request resend
    _RESEND_TIMESTAMPS.clear()
    resp = client.post(
        "/api/v1/auth/resend-email-verification",
        json={"email": email},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "smtp"
    assert data["verify_url"] is None  # Never exposed in SMTP mode

    # Verify smtplib was called
    server_mock = smtp_mock.__enter__.return_value
    assert server_mock.starttls.called
    assert server_mock.login.called
    assert server_mock.sendmail.called


def test_smtp_mode_fails_loudly_on_connection_error(client: TestClient, db_session: Session, monkeypatch):
    """
    Test that when EMAIL_MODE=smtp and SMTP dispatch fails:
    1. It fails with 503 (ServiceUnavailableError)
    2. It does NOT silently fall back to mock or return a mock verify_url
    """
    from unittest.mock import MagicMock
    from app.services.email_service import _RESEND_TIMESTAMPS

    def broken_smtp(*args, **kwargs):
        raise ConnectionRefusedError("SMTP connection timed out")

    monkeypatch.setattr("smtplib.SMTP", broken_smtp)
    monkeypatch.setattr(settings, "EMAIL_MODE", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USER", "tester@gmail.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "testpassword1234")

    email = "smtp_fail@ezfinanz.com"
    _RESEND_TIMESTAMPS.clear()

    # Register user
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "phone": "9876500098", "password": "Password123!"},
    )
    assert reg.status_code == 201

    # Attempt send verification
    _RESEND_TIMESTAMPS.clear()
    resp = client.post(
        "/api/v1/auth/resend-email-verification",
        json={"email": email},
    )
    assert resp.status_code == 503
    err = resp.json()
    assert "Unable to send verification email" in err["error"]["message"]


def test_expired_token_is_rejected():
    """
    Test that tokens created beyond expiration window fail validation.
    """
    from app.core.exceptions import UnauthorizedError
    import base64
    import hmac
    import hashlib
    import json
    import time

    now = int(time.time()) - (25 * 3600)  # 25 hours ago (expired)
    payload = {
        "uid": "11111111-2222-3333-4444-555555555555",
        "em": "expired@ezfinanz.com",
        "iat": now - 3600,
        "exp": now,
    }
    payload_json = json.dumps(payload, separators=(',', ':'), sort_keys=True)
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode('utf-8')).decode('utf-8').rstrip('=')
    sig = hmac.new(
        settings.JWT_SECRET_KEY.encode('utf-8'),
        payload_b64.encode('utf-8'),
        hashlib.sha256
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode('utf-8').rstrip('=')
    expired_token = f"{payload_b64}.{sig_b64}"

    with pytest.raises(UnauthorizedError) as exc_info:
        verify_email_verification_token(expired_token)
    assert "expired" in str(exc_info.value).lower()
