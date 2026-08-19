"""
Pydantic Schemas for Loan Disbursement Workflow.
"""

from datetime import datetime
from decimal import Decimal
import uuid
from pydantic import BaseModel, ConfigDict


class DisbursementInitiateRequest(BaseModel):
    remarks: str | None = None


class DisbursementConfirmRequest(BaseModel):
    remarks: str | None = None


class DisbursementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    disbursement_id: uuid.UUID
    application_id: uuid.UUID
    application_number: str
    approved_amount: Decimal
    net_disbursement_amount: Decimal
    disbursement_reference: str
    destination_account_summary: str | None
    status: str
    application_status: str
    initiated_at: datetime
    completed_at: datetime | None


class DisbursementDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    application_id: uuid.UUID
    application_number: str
    application_status: str
    approved_amount: Decimal
    net_disbursement_amount: Decimal
    selected_offer_id: uuid.UUID | None
    interest_rate: Decimal | None
    tenure_months: int | None
    emi: Decimal | None
    processing_fee: Decimal | None
    gst: Decimal | None
    total_interest: Decimal | None
    total_repayment: Decimal | None
    approval_date: datetime | None
    reviewed_by: str | None
    disbursement_id: uuid.UUID | None
    disbursement_reference: str | None
    disbursement_status: str | None
    destination_bank_name: str | None
    destination_account_last4: str | None
    destination_ifsc: str | None
    account_holder_name: str | None
    initiated_at: datetime | None
    completed_at: datetime | None
    failure_reason: str | None
