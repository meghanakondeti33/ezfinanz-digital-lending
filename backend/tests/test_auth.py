"""
Phase 2 Authentication and Role-Based Access Control (RBAC) Test Suite.
"""

import uuid
from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.core.exceptions import ValidationError
from app.models.user import User, UserRole


# ==============================================================================
# 1. Password Security & Hashing Tests
# ==============================================================================

def test_argon2id_hashing_and_verification():
    """Verify password hashing produces distinct Argon2id hashes and verifies correctly."""
    plain = "ValidPassword@123"
    hashed = hash_password(plain)

    # 1. Password is not plaintext
    assert hashed != plain
    assert "$argon2id$" in hashed

    # 2. Correct password verifies
    assert verify_password(plain, hashed) is True

    # 3. Incorrect password fails
    assert verify_password("WrongPassword@123", hashed) is False


def test_password_policy_validation():
    """Verify centralized password policy enforces length and complexity."""
    # Valid passwords
    validate_password_strength("StrongPass@1")
    validate_password_strength("Secure#Password99")

    # Too short (< 8 chars)
    with pytest.raises(ValidationError, match="at least 8 characters"):
        validate_password_strength("Short1!")

    # Missing uppercase
    with pytest.raises(ValidationError, match="uppercase"):
        validate_password_strength("lowercase123!")

    # Missing lowercase
    with pytest.raises(ValidationError, match="lowercase"):
        validate_password_strength("UPPERCASE123!")

    # Missing number
    with pytest.raises(ValidationError, match="number"):
        validate_password_strength("NoNumbersHere!")

    # Missing special character
    with pytest.raises(ValidationError, match="special character"):
        validate_password_strength("NoSpecialChar123")


# ==============================================================================
# 2. Registration Tests
# ==============================================================================

def test_successful_customer_registration(client: TestClient, db_session: Session):
    """Verify customer registration creates active user with role CUSTOMER."""
    payload = {
        "email": "newcustomer@ezfinanz.com",
        "phone": "9871112223",
        "password": "SecurePassword@123",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()

    # Verify response schema
    assert data["email"] == "newcustomer@ezfinanz.com"
    assert data["phone"] == "9871112223"
    assert data["role"] == "CUSTOMER"
    assert data["is_active"] is True
    assert "id" in data
    assert "password" not in data
    assert "password_hash" not in data

    # Verify persistence in database
    user = db_session.execute(
        select(User).where(User.email == "newcustomer@ezfinanz.com")
    ).scalar_one()
    assert user.role == UserRole.CUSTOMER
    assert verify_password("SecurePassword@123", user.password_hash) is True


def test_registration_rejects_duplicate_email(client: TestClient, db_session: Session):
    """Verify registration rejects duplicate email with 409 Conflict."""
    payload1 = {
        "email": "duplicate@ezfinanz.com",
        "phone": "9876500001",
        "password": "Password@123",
    }
    resp1 = client.post("/api/v1/auth/register", json=payload1)
    assert resp1.status_code == 201

    payload2 = {
        "email": "duplicate@ezfinanz.com",
        "phone": "9876500002",
        "password": "Password@123",
    }
    resp2 = client.post("/api/v1/auth/register", json=payload2)
    assert resp2.status_code == 409
    assert "already exists" in resp2.json()["error"]["message"]


def test_registration_rejects_duplicate_phone(client: TestClient, db_session: Session):
    """Verify registration rejects duplicate phone with 409 Conflict."""
    payload1 = {
        "email": "phone1@ezfinanz.com",
        "phone": "9876511111",
        "password": "Password@123",
    }
    resp1 = client.post("/api/v1/auth/register", json=payload1)
    assert resp1.status_code == 201

    payload2 = {
        "email": "phone2@ezfinanz.com",
        "phone": "9876511111",
        "password": "Password@123",
    }
    resp2 = client.post("/api/v1/auth/register", json=payload2)
    assert resp2.status_code == 409
    assert "already exists" in resp2.json()["error"]["message"]


def test_registration_rejects_weak_password(client: TestClient):
    """Verify registration rejects weak passwords."""
    payload = {
        "email": "weak@ezfinanz.com",
        "phone": "9876522222",
        "password": "weak",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


def test_registration_phone_validation_edge_cases(client: TestClient):
    """Verify phone validation strictly enforces Indian 10-digit format (starting with 6-9)."""
    base_payload = {
        "email": "phone_test@ezfinanz.com",
        "password": "StrongPassword@123",
    }

    # 1. Short phone (9 digits) -> 422
    res_short = client.post("/api/v1/auth/register", json={**base_payload, "phone": "987654321"})
    assert res_short.status_code == 422

    # 2. Long phone (11 digits) -> 422
    res_long = client.post("/api/v1/auth/register", json={**base_payload, "phone": "98765432101"})
    assert res_long.status_code == 422

    # 3. Invalid starting digit (starts with 1) -> 422
    res_start = client.post("/api/v1/auth/register", json={**base_payload, "phone": "1234567890"})
    assert res_start.status_code == 422

    # 4. Non-numeric characters -> 422
    res_alpha = client.post("/api/v1/auth/register", json={**base_payload, "phone": "98765abc10"})
    assert res_alpha.status_code == 422


def test_registration_cannot_specify_admin_role(client: TestClient):
    """Verify public registration rejects extra 'role' field (role escalation attempt)."""
    payload = {
        "email": "hacker@ezfinanz.com",
        "phone": "9876533333",
        "password": "StrongPassword@123",
        "role": "ADMIN",  # Forbidden extra field
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


# ==============================================================================
# 3. Login & Authentication Tests
# ==============================================================================

def test_successful_login(client: TestClient, db_session: Session):
    """Verify valid credentials return JWT access token."""
    # Create user
    user = User(
        email="logintest@ezfinanz.com",
        phone="9876544444",
        password_hash=hash_password("LoginPass@123"),
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    login_payload = {
        "email": "logintest@ezfinanz.com",
        "password": "LoginPass@123",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


def test_login_with_incorrect_password(client: TestClient, db_session: Session):
    """Verify incorrect password returns generic 401 Unauthorized."""
    user = User(
        email="wrongpass@ezfinanz.com",
        phone="9876555555",
        password_hash=hash_password("RealPass@123"),
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    login_payload = {
        "email": "wrongpass@ezfinanz.com",
        "password": "WrongPassword@123",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["error"]["message"]


def test_login_with_nonexistent_email(client: TestClient):
    """Verify nonexistent email returns generic 401 Unauthorized without enumerating."""
    login_payload = {
        "email": "nonexistent@ezfinanz.com",
        "password": "Password@123",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["error"]["message"]


def test_login_with_inactive_account(client: TestClient, db_session: Session):
    """Verify deactivated user cannot login."""
    user = User(
        email="inactive@ezfinanz.com",
        phone="9876566666",
        password_hash=hash_password("Password@123"),
        role=UserRole.CUSTOMER,
        is_active=False,
    )
    db_session.add(user)
    db_session.flush()

    login_payload = {
        "email": "inactive@ezfinanz.com",
        "password": "Password@123",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert "deactivated" in response.json()["error"]["message"].lower()


# ==============================================================================
# 4. Current User & JWT Validation Tests
# ==============================================================================

def test_get_current_user_profile(client: TestClient, db_session: Session):
    """Verify /auth/me returns current user profile for valid JWT."""
    user = User(
        email="me_user@ezfinanz.com",
        phone="9876577777",
        password_hash=hash_password("Password@123"),
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    token = create_access_token(user_id=user.id, role=user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me_user@ezfinanz.com"
    assert data["role"] == "CUSTOMER"
    assert "password_hash" not in data


def test_unauthenticated_request_rejected(client: TestClient):
    """Verify accessing protected endpoint without token returns 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_invalid_jwt_rejected(client: TestClient):
    """Verify malformed/tampered JWT is rejected with 401."""
    headers = {"Authorization": "Bearer invalid.malformed.token"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401


def test_expired_jwt_rejected(client: TestClient, db_session: Session):
    """Verify expired JWT is rejected with 401."""
    user = User(
        email="expired@ezfinanz.com",
        phone="9876588888",
        password_hash=hash_password("Password@123"),
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    # Create token expired 1 hour ago
    expired_token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        expires_delta=timedelta(hours=-1),
    )
    headers = {"Authorization": f"Bearer {expired_token}"}

    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401
    assert "expired" in response.json()["error"]["message"].lower()


# ==============================================================================
# 5. Role-Based Access Control (RBAC) Tests
# ==============================================================================

def test_customer_role_access(client: TestClient, db_session: Session):
    """
    Verify customer:
    - CAN access /customer/test (200)
    - CANNOT access /admin/test (403 Forbidden)
    """
    customer = User(
        email="cust_rbac@ezfinanz.com",
        phone="9876599991",
        password_hash=hash_password("Password@123"),
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(customer)
    db_session.flush()

    token = create_access_token(user_id=customer.id, role=customer.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Customer accesses customer endpoint -> 200 OK
    resp_cust = client.get("/api/v1/customer/test", headers=headers)
    assert resp_cust.status_code == 200
    assert resp_cust.json()["status"] == "authorized"

    # 2. Customer accesses admin endpoint -> 403 Forbidden
    resp_admin = client.get("/api/v1/admin/test", headers=headers)
    assert resp_admin.status_code == 403
    assert "permission" in resp_admin.json()["error"]["message"].lower()


def test_admin_role_access(client: TestClient, db_session: Session):
    """
    Verify admin:
    - CAN access /admin/test (200)
    """
    admin = User(
        email="admin_rbac@ezfinanz.com",
        phone="9876599992",
        password_hash=hash_password("AdminPass@123"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    db_session.flush()

    token = create_access_token(user_id=admin.id, role=admin.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    resp_admin = client.get("/api/v1/admin/test", headers=headers)
    assert resp_admin.status_code == 200
    assert resp_admin.json()["status"] == "authorized"
    assert resp_admin.json()["role"] == "ADMIN"


def test_admin_account_creation_logic(db_session: Session):
    """Verify admin user created with Argon2id and ADMIN role."""
    email = "superadmin@ezfinanz.com"
    phone = "9876599993"
    password = "SuperAdminPassword@2026"

    # Validate policy and hash
    validate_password_strength(password)
    hashed_password = hash_password(password)

    admin = User(
        email=email,
        phone=phone,
        password_hash=hashed_password,
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    db_session.flush()

    saved_admin = db_session.execute(
        select(User).where(User.email == email)
    ).scalar_one()

    assert saved_admin.role == UserRole.ADMIN
    assert saved_admin.is_active is True
    assert verify_password(password, saved_admin.password_hash) is True


def test_provision_admin_user_script_and_login(client: TestClient, db_session: Session):
    """Verify admin provisioned via script function can log in and access admin resources."""
    from app.scripts.create_admin import provision_admin_user

    admin_email = "provisioned_admin@ezfinanz.com"
    admin_phone = "9876599994"
    admin_pwd = "ProvisionedAdmin@123"

    admin_user = provision_admin_user(db_session, email=admin_email, phone=admin_phone, password=admin_pwd)
    assert admin_user.role == UserRole.ADMIN

    # Test login via standard /api/v1/auth/login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": admin_email, "password": admin_pwd},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify /auth/me returns ADMIN role
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["role"] == "ADMIN"

    # Verify admin can access admin dashboard stats
    admin_res = client.get("/api/v1/admin/dashboard/stats", headers=headers)
    assert admin_res.status_code == 200


def test_customer_registration_cannot_specify_or_promote_role(client: TestClient, db_session: Session):
    """Verify that public registration strictly provisions CUSTOMER role and rejects/ignores role injection."""
    cust_email = "injected_role_user@ezfinanz.com"
    cust_payload = {
        "email": cust_email,
        "phone": "9876599995",
        "password": "CustomerPassword@123",
        "role": "ADMIN",  # Attempted privilege escalation
    }
    # If schema forbids extra fields, it returns 422; if schema strips extra fields, it creates CUSTOMER
    res = client.post("/api/v1/auth/register", json=cust_payload)
    if res.status_code == 201:
        # If accepted, verify role was strictly set to CUSTOMER, not ADMIN
        user = db_session.execute(select(User).where(User.email == cust_email)).scalar_one()
        assert user.role == UserRole.CUSTOMER
    else:
        assert res.status_code == 422


