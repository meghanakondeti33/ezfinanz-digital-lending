"""
Unit and integration tests for Google Identity Services Authentication.
Tests cryptographic token verification, customer auto-provisioning, role enforcement,
and security edge cases with Google verification mocked.
"""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.core.exceptions import UnauthorizedError
from app.models.user import User, UserRole


def test_google_auth_valid_new_customer(client: TestClient, db_session):
    """
    Test 1 & 7: Valid Google credential for a new user creates a CUSTOMER account
    and returns a standard EZFINANZ JWT access token.
    """
    mock_id_info = {
        "iss": "https://accounts.google.com",
        "aud": "mock-client-id.apps.googleusercontent.com",
        "email": "new.google.user@example.com",
        "email_verified": True,
        "name": "New Google User",
    }

    with patch("app.services.auth_service.verify_google_id_token", return_value=mock_id_info):
        response = client.post(
            "/api/v1/auth/google",
            json={"credential": "mock-valid-google-credential"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 1800

        # Verify created user profile via /auth/me
        token = data["access_token"]
        me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.status_code == 200
        user_data = me_res.json()
        assert user_data["email"] == "new.google.user@example.com"
        assert user_data["role"] == "CUSTOMER"
        assert user_data["is_active"] is True


def test_google_auth_existing_customer(client: TestClient, db_session):
    """
    Test 6: Existing customer logging in via Google authenticates the existing user.
    """
    # 1. Register customer via standard email/password
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "existing.borrower@example.com",
            "phone": "9123456780",
            "password": "Password@123",
        },
    )
    assert reg_res.status_code == 201

    # 2. Authenticate via Google with the same email
    mock_id_info = {
        "iss": "https://accounts.google.com",
        "aud": "mock-client-id.apps.googleusercontent.com",
        "email": "existing.borrower@example.com",
        "email_verified": True,
    }

    with patch("app.services.auth_service.verify_google_id_token", return_value=mock_id_info):
        response = client.post(
            "/api/v1/auth/google",
            json={"credential": "mock-valid-google-credential"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

        # Check me
        me_res = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {data['access_token']}"},
        )
        assert me_res.status_code == 200
        assert me_res.json()["email"] == "existing.borrower@example.com"
        assert me_res.json()["phone"] == "9123456780"
        assert me_res.json()["role"] == "CUSTOMER"


def test_google_auth_cannot_create_or_elevate_to_admin(client: TestClient, db_session):
    """
    Test 8: Google Sign-in NEVER creates an ADMIN account.
    """
    mock_id_info = {
        "iss": "https://accounts.google.com",
        "aud": "mock-client-id.apps.googleusercontent.com",
        "email": "hacker.admin@example.com",
        "email_verified": True,
    }

    with patch("app.services.auth_service.verify_google_id_token", return_value=mock_id_info):
        response = client.post(
            "/api/v1/auth/google",
            json={"credential": "mock-valid-google-credential"},
        )
        assert response.status_code == 200
        token = response.json()["access_token"]

        me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.json()["role"] == "CUSTOMER"

        # Attempt to access admin queue
        admin_res = client.get(
            "/api/v1/admin/applications",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert admin_res.status_code == 403


def test_google_auth_invalid_credential_fails(client: TestClient):
    """
    Test 2: Invalid Google credential returns 401 Unauthorized.
    """
    with patch(
        "app.services.auth_service.verify_google_id_token",
        side_effect=UnauthorizedError("Google authentication failed: Invalid Token"),
    ):
        response = client.post(
            "/api/v1/auth/google",
            json={"credential": "invalid-token-xyz"},
        )
        assert response.status_code == 401
        assert "Invalid Token" in response.json()["error"]["message"]


def test_google_auth_expired_credential_fails(client: TestClient):
    """
    Test 3: Expired Google credential returns 401 Unauthorized.
    """
    with patch(
        "app.services.auth_service.verify_google_id_token",
        side_effect=UnauthorizedError("Google authentication failed: Token expired"),
    ):
        response = client.post(
            "/api/v1/auth/google",
            json={"credential": "expired-token-xyz"},
        )
        assert response.status_code == 401


def test_google_auth_wrong_audience_fails(client: TestClient):
    """
    Test 4: Wrong audience returns 401 Unauthorized.
    """
    with patch(
        "app.services.auth_service.verify_google_id_token",
        side_effect=UnauthorizedError("Token audience does not match configured Google Client ID."),
    ):
        response = client.post(
            "/api/v1/auth/google",
            json={"credential": "wrong-audience-token"},
        )
        assert response.status_code == 401


def test_google_auth_unverified_email_fails(client: TestClient):
    """
    Test 5: Unverified Google email is rejected.
    """
    with patch(
        "app.services.auth_service.verify_google_id_token",
        side_effect=UnauthorizedError("Google email is not verified. Please verify your email with Google."),
    ):
        response = client.post(
            "/api/v1/auth/google",
            json={"credential": "unverified-email-token"},
        )
        assert response.status_code == 401
        assert "Google email is not verified" in response.json()["error"]["message"]


def test_google_auth_valid_oauth_access_token(client: TestClient, db_session):
    """
    Test Google auth using OAuth access_token with verified profile.
    """
    mock_profile = {
        "email": "oauth.user@example.com",
        "email_verified": True,
        "name": "OAuth User",
    }
    with patch("app.services.auth_service.verify_google_access_token", return_value=mock_profile):
        response = client.post(
            "/api/v1/auth/google",
            json={"access_token": "mock-valid-oauth-access-token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data


def test_normal_password_auth_and_rbac_still_work(client: TestClient, db_session):
    """
    Test 9 & 10: Standard password registration/login and customer/admin RBAC work seamlessly.
    """
    # 1. Normal Registration
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "normal.user@example.com",
            "phone": "9876543201",
            "password": "StrongPassword@123",
        },
    )
    assert res.status_code == 201

    # 2. Normal Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "normal.user@example.com",
            "password": "StrongPassword@123",
        },
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # 3. RBAC isolation test (Customer gets 403 on admin endpoint)
    rbac_res = client.get("/api/v1/admin/applications", headers={"Authorization": f"Bearer {token}"})
    assert rbac_res.status_code == 403


def test_verify_google_id_token_passes_clock_skew_tolerance():
    """
    Test that verify_google_id_token configures clock_skew_in_seconds=60
    to tolerate slight client/server clock drifts.
    """
    from app.core.config import settings
    from app.services.auth_service import verify_google_id_token

    mock_payload = {
        "iss": "https://accounts.google.com",
        "aud": settings.GOOGLE_CLIENT_ID or "mock-aud",
        "email": "clock.test@example.com",
        "email_verified": True,
    }

    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=mock_payload) as mock_verify:
        result = verify_google_id_token("fake-jwt-token")
        assert result["email"] == "clock.test@example.com"
        assert mock_verify.call_count == 1
        _, kwargs = mock_verify.call_args
        assert kwargs.get("clock_skew_in_seconds") == 60
