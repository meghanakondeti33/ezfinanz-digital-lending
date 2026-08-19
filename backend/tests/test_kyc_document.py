"""
Tests for KYC PDF Document Upload, RBAC, and Underwriter Review (Feature 3).
"""

import io
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import UserRole


def test_kyc_pdf_upload_and_review_workflow(
    client: TestClient,
    db_session: Session,
):
    """
    Test complete lifecycle:
    1. Customer creates application
    2. Upload valid PDF document (%PDF header)
    3. Verify rejecting non-PDF files
    4. Customer and Admin download/view streaming
    5. Admin reviews (approves and rejects)
    """
    # Create customer
    c_email = "kyc_doc_cust@ezfinanz.com"
    c_pass = "Password123!"
    client.post("/api/v1/auth/register", json={"email": c_email, "phone": "9876500011", "password": c_pass})
    c_login = client.post("/api/v1/auth/login", json={"email": c_email, "password": c_pass})
    customer_token = c_login.json()["access_token"]

    # Login default admin
    a_login = client.post("/api/v1/auth/login", json={"email": "admin@ezfinanz.com", "password": "AdminPass@123"})
    assert a_login.status_code == 200, a_login.text
    admin_token = a_login.json()["access_token"]

    # 1. Create a draft application
    resp = client.post(
        "/api/v1/loans/applications",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "requested_amount": 50000.0,
            "requested_tenure_months": 12,
            "purpose": "Medical Emergency",
            "monthly_income": 45000.0,
            "employment_type": "SALARIED",
            "employer_name": "Tech Corp",
            "existing_debt": 5000.0,
        },
    )
    assert resp.status_code == 201, resp.text
    app_id = resp.json()["id"]

    # Advance to verification stage: Submit -> Eligibility -> Select Offer
    client.post(f"/api/v1/loans/applications/{app_id}/submit", headers={"Authorization": f"Bearer {customer_token}"})
    client.post(f"/api/v1/loans/applications/{app_id}/eligibility", headers={"Authorization": f"Bearer {customer_token}"})
    offers_res = client.get(f"/api/v1/loans/applications/{app_id}/offers", headers={"Authorization": f"Bearer {customer_token}"})
    offer_id = offers_res.json()["offers"][0]["id"]
    client.post(f"/api/v1/loans/applications/{app_id}/offers/{offer_id}/select", headers={"Authorization": f"Bearer {customer_token}"})

    # 2. Reject non-PDF file
    fake_png = b"\x89PNG\r\n\x1a\nFake PNG bytes"
    bad_upload = client.post(
        f"/api/v1/loans/applications/{app_id}/kyc/document",
        headers={"Authorization": f"Bearer {customer_token}"},
        files={"file": ("fake.png", io.BytesIO(fake_png), "image/png")},
    )
    assert bad_upload.status_code == 422
    err_body = bad_upload.json()
    err_msg = err_body.get("error", {}).get("message") or err_body.get("message") or err_body.get("detail") or ""
    assert "PDF" in err_msg

    # 3. Upload valid PDF file
    valid_pdf = b"%PDF-1.4\n%Fake PDF binary content for identity verification"
    good_upload = client.post(
        f"/api/v1/loans/applications/{app_id}/kyc/document",
        headers={"Authorization": f"Bearer {customer_token}"},
        files={"file": ("passport_doc.pdf", io.BytesIO(valid_pdf), "application/pdf")},
    )
    assert good_upload.status_code == 200
    doc_res = good_upload.json()
    assert doc_res["status"] == "KYC_DOCUMENT_UPLOADED"
    assert doc_res["filename"] == "passport_doc.pdf"

    # 4. View KYC document streaming as Customer
    stream_cust = client.get(
        f"/api/v1/loans/applications/{app_id}/kyc/document",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert stream_cust.status_code == 200
    assert stream_cust.headers["content-type"] == "application/pdf"
    assert stream_cust.content == valid_pdf

    # 5. View KYC document streaming as Admin
    stream_admin = client.get(
        f"/api/v1/loans/applications/{app_id}/kyc/document",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert stream_admin.status_code == 200
    assert stream_admin.content == valid_pdf

    # 6. Admin approves KYC document
    appr_resp = client.post(
        f"/api/v1/admin/applications/{app_id}/kyc/review",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"action": "APPROVE"},
    )
    assert appr_resp.status_code == 200
    assert appr_resp.json()["status"] == "KYC_VERIFIED"

    # 7. Admin rejects KYC document with reason
    rej_resp = client.post(
        f"/api/v1/admin/applications/{app_id}/kyc/review",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"action": "REJECT", "reason": "Document is blurry."},
    )
    assert rej_resp.status_code == 200
    assert rej_resp.json()["status"] == "KYC_REJECTED"
    assert rej_resp.json()["rejection_reason"] == "Document is blurry."
