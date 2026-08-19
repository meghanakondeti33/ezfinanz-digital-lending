"""
Pydantic schemas for Admin Underwriting & Application Review (Phase 6).
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.review import ReviewDecision
from app.schemas.verification import (
    BankAccountResponse,
    DeclarationResponse,
    KYCResponse,
    SelfieResponse,
)


class AdminDashboardStatsResponse(BaseModel):
    total_applications: int
    under_review_count: int
    approved_count: int
    rejected_count: int
    other_count: int


class AdminApplicationQueueItem(BaseModel):
    id: uuid.UUID
    application_number: str
    customer_name: Optional[str] = None
    customer_email: str
    customer_phone: str
    requested_amount: Optional[Decimal] = None
    purpose: Optional[str] = None
    status: str
    eligibility_status: Optional[str] = None
    eligibility_score: Optional[Decimal] = None
    selected_offer_amount: Optional[Decimal] = None
    selected_offer_rate: Optional[Decimal] = None
    selected_offer_emi: Optional[Decimal] = None
    verification_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminApplicationQueueResponse(BaseModel):
    total: int
    applications: list[AdminApplicationQueueItem]


class AdminReviewAuditLogItem(BaseModel):
    id: uuid.UUID
    action: str
    actor_email: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime


class AdminReviewItem(BaseModel):
    id: uuid.UUID
    admin_email: str
    decision: str
    remarks: Optional[str] = None
    created_at: datetime


class AdminCustomerProfile(BaseModel):
    user_id: uuid.UUID
    email: str
    phone: str
    full_name: Optional[str] = None


class AdminLoanDetails(BaseModel):
    requested_amount: Optional[Decimal] = None
    purpose: Optional[str] = None
    monthly_income: Optional[Decimal] = None
    employment_type: Optional[str] = None
    employer_name: Optional[str] = None
    existing_debt: Optional[Decimal] = None
    requested_tenure_months: Optional[int] = None


class AdminEligibilityDetails(BaseModel):
    status: Optional[str] = None
    score: Optional[Decimal] = None
    dti_ratio: Optional[Decimal] = None
    reasons: Optional[list[str]] = None
    calculated_at: Optional[datetime] = None


class AdminSelectedOfferDetails(BaseModel):
    principal: Optional[Decimal] = None
    interest_rate: Optional[Decimal] = None
    tenure_months: Optional[int] = None
    emi: Optional[Decimal] = None
    processing_fee: Optional[Decimal] = None
    gst: Optional[Decimal] = None
    total_charges: Optional[Decimal] = None
    net_disbursement: Optional[Decimal] = None
    total_interest: Optional[Decimal] = None
    total_repayment: Optional[Decimal] = None


class AdminVerificationDetails(BaseModel):
    status: str
    kyc: Optional[KYCResponse] = None
    bank_account: Optional[BankAccountResponse] = None
    selfie: Optional[SelfieResponse] = None
    declaration: Optional[DeclarationResponse] = None


class AdminApplicationDetailResponse(BaseModel):
    id: uuid.UUID
    application_number: str
    status: str
    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime] = None
    customer: AdminCustomerProfile
    loan_details: AdminLoanDetails
    eligibility: Optional[AdminEligibilityDetails] = None
    selected_offer: Optional[AdminSelectedOfferDetails] = None
    verification: AdminVerificationDetails
    audit_logs: list[AdminReviewAuditLogItem]
    admin_reviews: list[AdminReviewItem]


class AdminDecisionRequest(BaseModel):
    decision: ReviewDecision
    rejection_reason: Optional[str] = Field(
        None,
        description="Mandatory category if decision is REJECTED (e.g. Verification issue, Income insufficient, Risk policy violation, Incomplete information, Other)",
    )
    remarks: Optional[str] = Field(None, max_length=1000, description="Optional underwriter review notes")

    model_config = {"extra": "forbid"}


class AdminDecisionResponse(BaseModel):
    application_id: uuid.UUID
    application_number: str
    status: str
    decision: str
    remarks: Optional[str] = None
    reviewed_at: datetime
    reviewed_by: str
