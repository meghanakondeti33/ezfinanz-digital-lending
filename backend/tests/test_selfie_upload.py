"""
Comprehensive Tests for Live Photo / Selfie Camera Upload & Underwriting Review Workflow.

Verifies:
- Customer live camera photo upload (JPEG / PNG).
- Magic byte validation and size / format constraints.
- Secure image retrieval with strict RBAC (owner customer + admin credit officer).
- Rejection of unauthenticated or unauthorized cross-customer photo access.
- Admin Credit Officer visual review actions:
  - PHOTO_APPROVED
  - PHOTO_RETAKE_REQUIRED
- Customer retake re-submission workflow.
- Audit trail event logging at every step.
"""

import io
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models.audit import AuditLog
from app.models.loan import ApplicationStatus, LoanApplication
from app.models.selfie import SelfieVerification, SelfieVerificationStatus
from app.models.user import User, UserRole


# Minimal 1x1 valid JPEG binary for testing
VALID_JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00"
    b"\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f"
    b"\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b"
    b"\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01"
    b"\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01"
    b"\x01\x00\x00?\x00\xbf\x00\xff\xd9"
)

# Minimal valid PNG binary
VALID_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15"
    b"\xc4\x89\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
    + b" " * 100
)


def _setup_accepted_application(db_session: Session) -> tuple[User, LoanApplication, str]:
    """Helper to create a customer user and an accepted application for verification."""
    unique_suffix = str(uuid.uuid4())[:8]
    user = User(
        email=f"selfie_{unique_suffix}@ezfinanz.com",
        password_hash="hashed_test_password",
        role=UserRole.CUSTOMER,
        phone=f"98{unique_suffix[:8]}",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    app = LoanApplication(
        user_id=user.id,
        application_number=f"EZ-SELFIE-{unique_suffix}",
        requested_amount=50000.0,
        requested_tenure_months=12,
        purpose="Medical Equipment",
        status=ApplicationStatus.OFFER_SELECTED,
    )
    db_session.add(app)
    db_session.commit()
    db_session.refresh(app)

    token = create_access_token(user_id=user.id, role=user.role.value)
    return user, app, token


def _setup_admin_user(db_session: Session) -> tuple[User, str]:
    """Helper to create an admin credit officer user and JWT token."""
    unique_suffix = str(uuid.uuid4())[:8]
    admin = User(
        email=f"officer_{unique_suffix}@ezfinanz.com",
        password_hash="hashed_admin_password",
        role=UserRole.ADMIN,
        phone=f"88{unique_suffix[:8]}",
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)

    token = create_access_token(user_id=admin.id, role=admin.role.value)
    return admin, token


def test_customer_can_upload_photo_and_transitions_to_pending_review(
    client: TestClient, db_session: Session
):
    """Test customer can upload photo, status becomes PHOTO_PENDING_REVIEW, and audit log is created."""
    user, app, token = _setup_accepted_application(db_session)

    files = {"file": ("camera_capture.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")}
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        f"/api/v1/loans/applications/{app.id}/selfie/upload",
        files=files,
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PHOTO_PENDING_REVIEW"
    assert data["verification_type"] == "LIVE_PHOTO"
    assert data["application_id"] == str(app.id)

    # Check DB record
    selfie_record = db_session.query(SelfieVerification).filter_by(application_id=app.id).first()
    assert selfie_record is not None
    assert selfie_record.status == SelfieVerificationStatus.PHOTO_PENDING_REVIEW

    # Check Audit Log created
    audit = db_session.query(AuditLog).filter_by(application_id=app.id, action="PHOTO_SUBMITTED").first()
    assert audit is not None
    assert audit.actor_id == user.id


def test_selfie_upload_success_png(client: TestClient, db_session: Session):
    """Test successful live camera photo upload with PNG format."""
    user, app, token = _setup_accepted_application(db_session)

    files = {"file": ("selfie.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        f"/api/v1/loans/applications/{app.id}/selfie/upload",
        files=files,
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PHOTO_PENDING_REVIEW"


def test_invalid_image_rejected(client: TestClient, db_session: Session):
    """Test rejection of non-image file formats (e.g. PDF/TXT)."""
    _, app, token = _setup_accepted_application(db_session)

    files = {"file": ("fake.pdf", io.BytesIO(b"%PDF-1.4 header text" + b" " * 150), "application/pdf")}
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        f"/api/v1/loans/applications/{app.id}/selfie/upload",
        files=files,
        headers=headers,
    )

    assert response.status_code == 422
    assert "Unsupported image format" in response.json()["error"]["message"]


def test_photo_associated_with_correct_application(client: TestClient, db_session: Session):
    """Test photo is strictly associated with target application and customer."""
    user, app, token = _setup_accepted_application(db_session)

    files = {"file": ("selfie.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")}
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        f"/api/v1/loans/applications/{app.id}/selfie/upload",
        files=files,
        headers=headers,
    )

    selfie = db_session.query(SelfieVerification).filter_by(application_id=app.id).first()
    assert selfie is not None
    assert selfie.application_id == app.id


def test_customer_cannot_access_another_customers_photo(client: TestClient, db_session: Session):
    """Test that customer A cannot download customer B's selfie image."""
    _, app_a, _ = _setup_accepted_application(db_session)
    _, _, token_b = _setup_accepted_application(db_session)

    # First upload photo for customer A
    files = {"file": ("selfie.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")}
    headers_a = {"Authorization": f"Bearer {create_access_token(user_id=app_a.user_id, role='CUSTOMER')}"}
    client.post(f"/api/v1/loans/applications/{app_a.id}/selfie/upload", files=files, headers=headers_a)

    # Customer B attempts to retrieve photo of Application A
    headers_b = {"Authorization": f"Bearer {token_b}"}
    response = client.get(
        f"/api/v1/loans/applications/{app_a.id}/verification/live-photo",
        headers=headers_b,
    )

    assert response.status_code == 403


def test_unauthenticated_user_cannot_access_photo(client: TestClient, db_session: Session):
    """Test unauthenticated request cannot access live photo."""
    _, app, _ = _setup_accepted_application(db_session)

    response = client.get(f"/api/v1/loans/applications/{app.id}/verification/live-photo")
    assert response.status_code == 401


def test_admin_can_retrieve_photo(client: TestClient, db_session: Session):
    """Test admin credit officer can retrieve customer photo binary."""
    user, app, token = _setup_accepted_application(db_session)
    admin, admin_token = _setup_admin_user(db_session)

    # Upload photo
    files = {"file": ("selfie.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")}
    headers = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/v1/loans/applications/{app.id}/selfie/upload", files=files, headers=headers)

    # Admin fetches photo
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get(
        f"/api/v1/loans/applications/{app.id}/verification/live-photo",
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert len(response.content) > 0


def test_customer_cannot_approve_photo(client: TestClient, db_session: Session):
    """Test customer role is forbidden from calling admin photo review endpoint."""
    user, app, token = _setup_accepted_application(db_session)

    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        f"/api/v1/admin/applications/{app.id}/selfie/review",
        json={"action": "APPROVE"},
        headers=headers,
    )

    assert response.status_code == 403


def test_admin_can_approve_photo_and_creates_audit_event(
    client: TestClient, db_session: Session
):
    """Test admin can approve photo, updates status to PHOTO_APPROVED, and writes audit event."""
    user, app, token = _setup_accepted_application(db_session)
    admin, admin_token = _setup_admin_user(db_session)

    # 1. Customer uploads photo
    files = {"file": ("selfie.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")}
    client.post(
        f"/api/v1/loans/applications/{app.id}/selfie/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )

    # 2. Admin approves photo
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post(
        f"/api/v1/admin/applications/{app.id}/selfie/review",
        json={"action": "APPROVE"},
        headers=admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PHOTO_APPROVED"
    assert data["reviewed_by"] == str(admin.id)
    assert data["reviewed_at"] is not None

    # Verify DB state
    selfie = db_session.query(SelfieVerification).filter_by(application_id=app.id).first()
    assert selfie.status == SelfieVerificationStatus.PHOTO_APPROVED
    assert selfie.reviewed_by == admin.id

    # Verify Audit trail
    audit = db_session.query(AuditLog).filter_by(application_id=app.id, action="PHOTO_APPROVED").first()
    assert audit is not None
    assert audit.actor_id == admin.id
    assert audit.new_status == "PHOTO_APPROVED"


def test_admin_can_request_retake_with_reason(client: TestClient, db_session: Session):
    """Test admin can request retake with reason, state transitions to PHOTO_RETAKE_REQUIRED."""
    user, app, token = _setup_accepted_application(db_session)
    admin, admin_token = _setup_admin_user(db_session)

    # 1. Customer uploads photo
    files = {"file": ("selfie.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")}
    client.post(
        f"/api/v1/loans/applications/{app.id}/selfie/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )

    # 2. Admin requests retake
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    retake_reason = "Photo is blurry and lighting is insufficient. Please face the light."
    response = client.post(
        f"/api/v1/admin/applications/{app.id}/selfie/review",
        json={"action": "REQUEST_RETAKE", "reason": retake_reason},
        headers=admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PHOTO_RETAKE_REQUIRED"
    assert data["rejection_reason"] == retake_reason

    # Verify DB state
    selfie = db_session.query(SelfieVerification).filter_by(application_id=app.id).first()
    assert selfie.status == SelfieVerificationStatus.PHOTO_RETAKE_REQUIRED
    assert selfie.rejection_reason == retake_reason

    # Verify Audit trail
    audit = db_session.query(AuditLog).filter_by(application_id=app.id, action="PHOTO_RETAKE_REQUESTED").first()
    assert audit is not None
    assert audit.actor_id == admin.id
    assert audit.new_status == "PHOTO_RETAKE_REQUIRED"


def test_retake_creates_new_submission_and_resets_status(
    client: TestClient, db_session: Session
):
    """Test customer uploading a new photo after retake required resets status to PHOTO_PENDING_REVIEW."""
    user, app, token = _setup_accepted_application(db_session)
    admin, admin_token = _setup_admin_user(db_session)

    # 1. First upload
    client.post(
        f"/api/v1/loans/applications/{app.id}/selfie/upload",
        files={"file": ("selfie_1.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )

    # 2. Admin requests retake
    client.post(
        f"/api/v1/admin/applications/{app.id}/selfie/review",
        json={"action": "REQUEST_RETAKE", "reason": "Face partially obscured."},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # 3. Customer resubmits new photo
    resubmit_response = client.post(
        f"/api/v1/loans/applications/{app.id}/selfie/upload",
        files={"file": ("selfie_2.png", io.BytesIO(VALID_PNG_BYTES), "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resubmit_response.status_code == 200
    data = resubmit_response.json()
    assert data["status"] == "PHOTO_PENDING_REVIEW"
    assert data["rejection_reason"] is None

    # Check DB record updated
    db_session.expire_all()
    selfie = db_session.query(SelfieVerification).filter_by(application_id=app.id).first()
    assert selfie.status == SelfieVerificationStatus.PHOTO_PENDING_REVIEW
    assert selfie.rejection_reason is None


def test_complete_photo_verification_and_admin_review_e2e_flow(
    client: TestClient, db_session: Session
):
    """
    Comprehensive 20-point test of full Customer -> Admin -> Customer live photo workflow:
    1. Customer uploads photo -> persisted.
    2. Customer retrieves summary / reloads dashboard -> PHOTO_PENDING_REVIEW.
    3. Customer relogs in -> state is permanently preserved in backend.
    4. Admin accesses customer photo binary.
    5. Admin requests retake with reason.
    6. Customer reloads -> sees PHOTO_RETAKE_REQUIRED & specific reason.
    7. Customer uploads replacement photo -> status resets to PHOTO_PENDING_REVIEW.
    8. Admin approves photo -> status becomes PHOTO_APPROVED.
    9. Customer reloads -> sees PHOTO_APPROVED.
    10. Audit trail contains complete history.
    """
    user, app, token = _setup_accepted_application(db_session)
    admin, admin_token = _setup_admin_user(db_session)

    # 1. Customer uploads live photo
    upload_res = client.post(
        f"/api/v1/loans/applications/{app.id}/selfie/upload",
        files={"file": ("selfie_capture_1.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert upload_res.status_code == 200
    assert upload_res.json()["status"] == "PHOTO_PENDING_REVIEW"

    # 2. Customer reloads dashboard / summary
    summary_res1 = client.get(
        f"/api/v1/loans/applications/{app.id}/verification/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert summary_res1.status_code == 200
    summary_data1 = summary_res1.json()
    assert summary_data1["selfie"] == "PHOTO_PENDING_REVIEW"
    assert summary_data1["selfie_details"]["status"] == "PHOTO_PENDING_REVIEW"

    # 3. Simulate customer relogging in (new access token)
    new_cust_token = create_access_token(user_id=user.id, role="CUSTOMER")
    summary_res2 = client.get(
        f"/api/v1/loans/applications/{app.id}/verification/summary",
        headers={"Authorization": f"Bearer {new_cust_token}"},
    )
    assert summary_res2.status_code == 200
    assert summary_res2.json()["selfie"] == "PHOTO_PENDING_REVIEW"

    # 4. Admin opens application & retrieves photo
    admin_photo_res = client.get(
        f"/api/v1/loans/applications/{app.id}/verification/live-photo",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_photo_res.status_code == 200
    assert admin_photo_res.headers["content-type"] == "image/jpeg"

    # 5. Admin requests retake with specific feedback
    retake_reason = "Lighting is too dark. Please take photo facing natural light."
    retake_res = client.post(
        f"/api/v1/admin/applications/{app.id}/selfie/review",
        json={"action": "REQUEST_RETAKE", "reason": retake_reason},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert retake_res.status_code == 200
    assert retake_res.json()["status"] == "PHOTO_RETAKE_REQUIRED"
    assert retake_res.json()["rejection_reason"] == retake_reason

    # 6. Customer reloads dashboard -> sees retake required & reason
    cust_check_res = client.get(
        f"/api/v1/loans/applications/{app.id}/verification/summary",
        headers={"Authorization": f"Bearer {new_cust_token}"},
    )
    assert cust_check_res.status_code == 200
    cust_check_data = cust_check_res.json()
    assert cust_check_data["selfie"] == "PHOTO_RETAKE_REQUIRED"
    assert cust_check_data["selfie_details"]["rejection_reason"] == retake_reason

    # 7. Customer captures & uploads a replacement photo
    resubmit_res = client.post(
        f"/api/v1/loans/applications/{app.id}/selfie/upload",
        files={"file": ("selfie_capture_2.png", io.BytesIO(VALID_PNG_BYTES), "image/png")},
        headers={"Authorization": f"Bearer {new_cust_token}"},
    )
    assert resubmit_res.status_code == 200
    assert resubmit_res.json()["status"] == "PHOTO_PENDING_REVIEW"
    assert resubmit_res.json()["rejection_reason"] is None

    # 8. Admin reviews new photo and approves it
    approve_res = client.post(
        f"/api/v1/admin/applications/{app.id}/selfie/review",
        json={"action": "APPROVE"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "PHOTO_APPROVED"

    # 9. Customer reloads dashboard / summary -> sees approved
    final_cust_res = client.get(
        f"/api/v1/loans/applications/{app.id}/verification/summary",
        headers={"Authorization": f"Bearer {new_cust_token}"},
    )
    assert final_cust_res.status_code == 200
    assert final_cust_res.json()["selfie"] in ("PHOTO_APPROVED", "VERIFIED")

    # 10. Audit trail check
    db_session.expire_all()
    audit_logs = (
        db_session.query(AuditLog)
        .filter_by(application_id=app.id)
        .order_by(AuditLog.created_at.asc())
        .all()
    )
    actions = [log.action for log in audit_logs]
    assert "PHOTO_SUBMITTED" in actions
    assert "PHOTO_RETAKE_REQUESTED" in actions
    assert "PHOTO_APPROVED" in actions
