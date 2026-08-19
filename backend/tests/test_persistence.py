"""
Tests for Loan Application Persistence Across Relogin and Restarts (Feature 2).
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_loan_application_persists_across_relogin(client: TestClient, db_session: Session):
    """
    Test that a customer who creates a loan application can log out,
    log back in with fresh credentials/tokens, and their application is
    immediately retrieved from PostgreSQL without any client localStorage dependency.
    """
    email = "PersistentUser@EZFinanz.com"  # Mixed case to test casing normalization
    phone = "9876540009"
    password = "SuperPassword123!"

    # 1. Register user
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "phone": phone, "password": password},
    )
    assert reg_resp.status_code == 201

    # 2. Login #1
    login1_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email.lower(), "password": password},
    )
    assert login1_resp.status_code == 200
    token1 = login1_resp.json()["access_token"]

    # 3. Create Loan Application #1
    create_resp = client.post(
        "/api/v1/loans/applications",
        headers={"Authorization": f"Bearer {token1}"},
        json={
            "requested_amount": 75000.0,
            "requested_tenure_months": 18,
            "purpose": "Home Renovation",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    created_app = create_resp.json()
    app_id = created_app["id"]
    app_num = created_app["application_number"]

    # 4. Simulate Client Logout & Re-login with different casing in email
    login2_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "persistentuser@ezfinanz.com", "password": password},
    )
    assert login2_resp.status_code == 200
    token2 = login2_resp.json()["access_token"]

    # 5. Fetch applications list using new token
    list_resp = client.get(
        "/api/v1/loans/applications",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert list_resp.status_code == 200
    apps = list_resp.json()["items"]
    assert len(apps) >= 1
    assert any(a["id"] == app_id for a in apps)

    # 6. Fetch application details by ID using new token
    detail_resp = client.get(
        f"/api/v1/loans/applications/{app_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert detail_resp.status_code == 200
    fetched_app = detail_resp.json()
    assert fetched_app["id"] == app_id
    assert fetched_app["application_number"] == app_num
    assert float(fetched_app["requested_amount"]) == 75000.0
