"""
Pydantic schemas for Customer Verification Pipeline (KYC, Bank, Selfie, Declaration).
"""

import enum
import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.kyc import Gender, IDType
from app.models.selfie import SelfieVerificationStatus, SelfieVerificationType


class KYCSubmitRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    date_of_birth: date
    gender: Gender
    address_line_1: str = Field(..., min_length=3, max_length=500)
    address_line_2: Optional[str] = Field(None, max_length=500)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., min_length=6, max_length=10)
    id_type: IDType
    id_number: str = Field(..., min_length=4, max_length=50, description="Raw ID number to be hashed and masked")
    document_storage_key: Optional[str] = Field(None, max_length=500)

    model_config = {"extra": "forbid"}


class KYCResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    date_of_birth: date
    gender: Gender
    address_line_1: str
    address_line_2: Optional[str] = None
    city: str
    state: str
    pincode: str
    id_type: IDType
    id_number_masked: str
    status: str = "VERIFIED"
    document_status: Optional[str] = "KYC_NOT_SUBMITTED"
    document_filename: Optional[str] = None
    document_rejection_reason: Optional[str] = None
    document_uploaded_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class KYCDocumentUploadResponse(BaseModel):
    status: str
    filename: str
    uploaded_at: datetime
    message: str


class KYCDocumentReviewAction(str, enum.Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"


class KYCDocumentReviewRequest(BaseModel):
    action: KYCDocumentReviewAction
    reason: Optional[str] = Field(None, max_length=500, description="Rejection reason if rejected")

    model_config = {"extra": "forbid"}


class BankAccountSubmitRequest(BaseModel):
    account_holder_name: str = Field(..., min_length=2, max_length=255)
    account_number: str = Field(..., min_length=8, max_length=30)
    ifsc: str = Field(..., min_length=11, max_length=11)
    bank_name: str = Field(..., min_length=2, max_length=255)

    model_config = {"extra": "forbid"}


class BankAccountResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    account_holder_name: str
    account_number_masked: str
    account_number_last4: str
    ifsc: str
    bank_name: str
    status: str = "VERIFIED"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SelfieSubmitRequest(BaseModel):
    storage_key: Optional[str] = Field(
        "selfies/live_photo_simulated.jpg",
        max_length=500,
        description="Reference storage key for live photo metadata",
    )
    verification_type: SelfieVerificationType = SelfieVerificationType.LIVE_PHOTO

    model_config = {"extra": "forbid"}


class SelfieResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    verification_type: SelfieVerificationType
    status: SelfieVerificationStatus
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    photo_url: Optional[str] = None
    submitted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SelfieReviewAction(str, enum.Enum):
    APPROVE = "APPROVE"
    REQUEST_RETAKE = "REQUEST_RETAKE"


class SelfieReviewRequest(BaseModel):
    action: SelfieReviewAction
    reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Reason when requesting a retake (e.g. Blurry photo, Face not centered)",
    )

    model_config = {"extra": "forbid"}


class DeclarationSubmitRequest(BaseModel):
    accepted: bool = Field(..., description="Must explicitly be True to confirm terms acceptance")
    declaration_version: str = Field("v1.0", max_length=50)

    model_config = {"extra": "forbid"}


class DeclarationResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    accepted: bool
    declaration_version: str
    accepted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VerificationSummaryResponse(BaseModel):
    application_id: uuid.UUID
    status: str  # NOT_STARTED, IN_PROGRESS, COMPLETED
    kyc: str  # NOT_STARTED, VERIFIED, FAILED
    bank_account: str  # NOT_STARTED, VERIFIED, FAILED
    selfie: str  # NOT_STARTED, PHOTO_PENDING_REVIEW, PHOTO_APPROVED, PHOTO_RETAKE_REQUIRED, VERIFIED
    selfie_details: Optional[SelfieResponse] = None
    declaration: str  # NOT_STARTED, ACCEPTED
    is_ready_for_review: bool
