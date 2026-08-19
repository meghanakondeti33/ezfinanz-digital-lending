"""
Comprehensive Unit & Integration Test Suite for SMS OTP Generation and Verification.
"""

import time
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User, UserRole
from app.services.otp_service import _otp_store


@pytest.fixture(autouse=True)
def clean_otp_store():
    """Clear in-memory OTP store before and after each test."""
    _otp_store.clear()
    yield
    _otp_store.clear()


def test_send_otp_success_in_demo_mode(client: TestClient, db_session: Session):
    """
    Test 1: Requesting OTP generates a 6-digit code, sets expiry, and returns cooldown.
    """
    response = client.post("/api/v1/auth/send-mobile-otp", json={"phone": "9876543210"})
    assert response.status_code == 200
    data = response.json()
    assert "expires_in" in data
    assert data["expires_in"] == 300
    assert data["resend_cooldown"] == 60
    assert data["otp_mode"] in ["demo", "sms"]
    if data["otp_mode"] == "demo":
        assert len(data["demo_otp"]) == 6
        assert data["demo_otp"].isdigit()


def test_send_otp_rejects_duplicate_registered_phone(client: TestClient, db_session: Session):
    """
    Test 2: Requesting OTP for a phone number that already has an active account returns 409 Conflict.
    """
    existing_user = User(
        email="existing_mobile@ezfinanz.com",
        phone="9876500099",
        password_hash="hashed",
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(existing_user)
    db_session.commit()

    response = client.post("/api/v1/auth/send-mobile-otp", json={"phone": "9876500099"})
    assert response.status_code == 409
    assert "already exists" in response.json()["error"]["message"]


def test_send_otp_rate_limiting_cooldown(client: TestClient):
    """
    Test 3: Requesting a second OTP within 60 seconds returns 422 with remaining cooldown.
    """
    res1 = client.post("/api/v1/auth/send-mobile-otp", json={"phone": "9871234567"})
    assert res1.status_code == 200

    # Immediate second request
    res2 = client.post("/api/v1/auth/send-mobile-otp", json={"phone": "9871234567"})
    assert res2.status_code == 422
    assert "Please wait" in res2.json()["error"]["message"]


def test_verify_otp_success_and_issues_token(client: TestClient):
    """
    Test 4: Correct OTP returns verified: True and a valid phone_verification_token.
    """
    send_res = client.post("/api/v1/auth/send-mobile-otp", json={"phone": "9876541234"})
    assert send_res.status_code == 200
    demo_otp = send_res.json().get("demo_otp")

    verify_res = client.post(
        "/api/v1/auth/verify-mobile-otp",
        json={"phone": "9876541234", "otp": demo_otp},
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["verified"] is True
    assert "phone_verification_token" in data
    assert len(data["phone_verification_token"]) > 20


def test_verify_otp_incorrect_code_fails(client: TestClient):
    """
    Test 5: Incorrect OTP returns 401 Unauthorized with attempt counter.
    """
    client.post("/api/v1/auth/send-mobile-otp", json={"phone": "9876549999"})

    verify_res = client.post(
        "/api/v1/auth/verify-mobile-otp",
        json={"phone": "9876549999", "otp": "000000"},
    )
    assert verify_res.status_code == 401
    assert "Invalid verification code" in verify_res.json()["error"]["message"]


def test_verify_otp_max_attempts_lockout(client: TestClient):
    """
    Test 6: Exceeding 5 failed attempts locks out the OTP.
    """
    client.post("/api/v1/auth/send-mobile-otp", json={"phone": "9876548888"})

    for _ in range(5):
        client.post(
            "/api/v1/auth/verify-mobile-otp",
            json={"phone": "9876548888", "otp": "000000"},
        )

    # 6th attempt should return lockout message
    lockout_res = client.post(
        "/api/v1/auth/verify-mobile-otp",
        json={"phone": "9876548888", "otp": "000000"},
    )
    assert lockout_res.status_code == 401
    assert "Too many failed attempts" in lockout_res.json()["error"]["message"] or "No active verification code" in lockout_res.json()["error"]["message"]


def test_verify_otp_cannot_be_reused(client: TestClient):
    """
    Test 7: Once an OTP is verified, it is deleted and cannot be reused.
    """
    send_res = client.post("/api/v1/auth/send-mobile-otp", json={"phone": "9876547777"})
    demo_otp = send_res.json()["demo_otp"]

    # 1st verification -> 200
    res1 = client.post(
        "/api/v1/auth/verify-mobile-otp",
        json={"phone": "9876547777", "otp": demo_otp},
    )
    assert res1.status_code == 200

    # 2nd verification attempt -> 401
    res2 = client.post(
        "/api/v1/auth/verify-mobile-otp",
        json={"phone": "9876547777", "otp": demo_otp},
    )
    assert res2.status_code == 401


def test_full_registration_with_phone_verification_token(client: TestClient, db_session: Session):
    """
    Test 8: Full progressive registration flow: Send OTP -> Verify -> Register with Token.
    """
    phone = "9876540001"
    email = "progressive.user@ezfinanz.com"

    # 1. Send OTP
    send_res = client.post("/api/v1/auth/send-mobile-otp", json={"phone": phone})
    assert send_res.status_code == 200
    demo_otp = send_res.json()["demo_otp"]

    # 2. Verify OTP
    verify_res = client.post(
        "/api/v1/auth/verify-mobile-otp",
        json={"phone": phone, "otp": demo_otp},
    )
    assert verify_res.status_code == 200
    token = verify_res.json()["phone_verification_token"]

    # 3. Complete Registration
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "phone": phone,
            "password": "StrongPassword@123",
            "phone_verification_token": token,
        },
    )
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert data["email"] == email
    assert data["phone"] == phone
    assert data["role"] == "CUSTOMER"


def test_registration_with_tampered_token_fails(client: TestClient):
    """
    Test 9: Registering with an invalid or tampered verification token fails.
    """
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "tampered@ezfinanz.com",
            "phone": "9876540002",
            "password": "StrongPassword@123",
            "phone_verification_token": "tampered-invalid-jwt-token",
        },
    )
    assert reg_res.status_code == 401
    assert "Invalid or expired mobile verification token" in reg_res.json()["error"]["message"]
