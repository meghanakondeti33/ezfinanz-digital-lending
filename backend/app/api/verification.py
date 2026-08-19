"""
Verification Pipeline API Endpoints.

Provides customer endpoints for KYC document submission, bank account verification,
selfie verification, declaration acceptance, and consolidated verification status tracking.
"""

import uuid
from fastapi import APIRouter, Depends, File, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.verification import (
    BankAccountResponse,
    BankAccountSubmitRequest,
    DeclarationResponse,
    DeclarationSubmitRequest,
    KYCDocumentUploadResponse,
    KYCResponse,
    KYCSubmitRequest,
    SelfieResponse,
    SelfieSubmitRequest,
    VerificationSummaryResponse,
)
from app.services.verification_service import (
    get_bank_account,
    get_declaration,
    get_kyc,
    get_kyc_document_file_path,
    get_selfie,
    get_selfie_photo_file,
    get_verification_summary,
    submit_bank_account,
    submit_declaration,
    submit_kyc,
    submit_selfie,
    upload_and_verify_selfie,
    upload_kyc_document,
)

router = APIRouter(prefix="/loans/applications/{application_id}", tags=["verification"])


# ==============================================================================
# 1. KYC Endpoints
# ==============================================================================

@router.post(
    "/kyc",
    response_model=KYCResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit and verify customer KYC",
)
def submit_customer_kyc(
    application_id: uuid.UUID,
    payload: KYCSubmitRequest,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> KYCResponse:
    """
    Submit customer KYC demographic details and government ID for simulated verification.
    """
    return submit_kyc(db, current_user, application_id, payload)


@router.post(
    "/kyc/document",
    response_model=KYCDocumentUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload KYC supporting identity document (PDF)",
)
async def upload_customer_kyc_document(
    application_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> KYCDocumentUploadResponse:
    """
    Upload a government ID PDF document (Aadhaar, PAN, Passport, etc.).
    Enforces PDF format check, size <= 5MB, and stores in private directory.
    """
    file_bytes = await file.read()
    filename = file.filename or "kyc_document.pdf"
    content_type = file.content_type or "application/pdf"
    return upload_kyc_document(db, current_user, application_id, file_bytes, filename, content_type)


@router.get(
    "/kyc/document",
    summary="Download or view KYC identity document",
)
def view_customer_kyc_document(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    """
    Securely stream the uploaded KYC PDF document.
    Authorized for the loan applicant and underwriting credit officers.
    """
    file_path, filename = get_kyc_document_file_path(db, current_user, application_id)
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )


@router.get(
    "/verification/kyc-document",
    summary="Download or view KYC identity document (alias)",
)
def view_customer_kyc_document_alias(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    """
    Securely stream the uploaded KYC PDF document (alias route).
    """
    file_path, filename = get_kyc_document_file_path(db, current_user, application_id)
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )


@router.get(
    "/kyc",
    response_model=KYCResponse,
    status_code=status.HTTP_200_OK,
    summary="Get customer KYC details",
)
def get_customer_kyc(
    application_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> KYCResponse:
    """
    Retrieve existing customer KYC details with sensitive ID masked.
    """
    return get_kyc(db, current_user, application_id)


# ==============================================================================
# 2. Bank Account Endpoints
# ==============================================================================

@router.post(
    "/bank-account",
    response_model=BankAccountResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit and verify destination bank account",
)
def submit_customer_bank_account(
    application_id: uuid.UUID,
    payload: BankAccountSubmitRequest,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> BankAccountResponse:
    """
    Submit destination bank account details for simulated verification.
    """
    return submit_bank_account(db, current_user, application_id, payload)


@router.get(
    "/bank-account",
    response_model=BankAccountResponse,
    status_code=status.HTTP_200_OK,
    summary="Get verified bank account details",
)
def get_customer_bank_account(
    application_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> BankAccountResponse:
    """
    Retrieve verified bank account information with masked account number.
    """
    return get_bank_account(db, current_user, application_id)


# ==============================================================================
# 3. Selfie Verification Endpoints
# ==============================================================================

@router.post(
    "/selfie",
    response_model=SelfieResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit and verify live selfie",
)
def submit_customer_selfie(
    application_id: uuid.UUID,
    payload: SelfieSubmitRequest = SelfieSubmitRequest(),
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> SelfieResponse:
    """
    Submit live photo verification reference for simulated verification.
    """
    return submit_selfie(db, current_user, application_id, payload)


@router.post(
    "/selfie/upload",
    response_model=SelfieResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload and verify live browser camera photo",
)
async def upload_customer_selfie(
    application_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> SelfieResponse:
    """
    Upload real live photo binary from browser camera capture, validate format/size,
    and process simulated liveness verification.
    """
    file_bytes = await file.read()
    return upload_and_verify_selfie(
        db=db,
        user=current_user,
        application_id=application_id,
        file_bytes=file_bytes,
        filename=file.filename or "selfie.jpg",
        content_type=file.content_type or "image/jpeg",
    )


@router.get(
    "/selfie",
    response_model=SelfieResponse,
    status_code=status.HTTP_200_OK,
    summary="Get selfie verification status",
)
def get_customer_selfie(
    application_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> SelfieResponse:
    """
    Retrieve selfie verification status.
    """
    return get_selfie(db, current_user, application_id)


@router.get(
    "/verification/live-photo",
    summary="Retrieve live selfie photo image securely",
)
def get_live_photo_image(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stream the actual verified customer live photo binary.
    Restricted to the application owner (customer) and credit officers (admin).
    """
    file_path, media_type = get_selfie_photo_file(db, current_user, application_id)
    return FileResponse(file_path, media_type=media_type)


# ==============================================================================
# 4. Declaration Endpoints
# ==============================================================================

@router.post(
    "/declaration",
    response_model=DeclarationResponse,
    status_code=status.HTTP_200_OK,
    summary="Accept legal loan terms declaration",
)
def accept_loan_declaration(
    application_id: uuid.UUID,
    payload: DeclarationSubmitRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> DeclarationResponse:
    """
    Explicitly accept borrower declaration terms. Records client IP and backend timestamp.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    return submit_declaration(db, current_user, application_id, payload, client_ip)


@router.get(
    "/declaration",
    response_model=DeclarationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get declaration status",
)
def get_loan_declaration(
    application_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> DeclarationResponse:
    """
    Retrieve declaration acceptance status.
    """
    return get_declaration(db, current_user, application_id)


# ==============================================================================
# 5. Consolidated Verification Summary Endpoint
# ==============================================================================

@router.get(
    "/verification",
    response_model=VerificationSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get consolidated verification pipeline status",
)
@router.get(
    "/verification/summary",
    response_model=VerificationSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get consolidated verification pipeline status alias",
)
def get_verification_status(
    application_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> VerificationSummaryResponse:
    """
    Get consolidated progress summary across KYC, Bank Account, Selfie, and Declaration steps.
    """
    return get_verification_summary(db, current_user, application_id)
