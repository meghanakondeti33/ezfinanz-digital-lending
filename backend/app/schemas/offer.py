"""
Pydantic schemas for Loan Offers and Loan Terms.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict

from app.models.offer import OfferStatus


class LoanTermResponse(BaseModel):
    id: uuid.UUID
    offer_id: uuid.UUID
    tenure_months: int
    emi: Decimal
    total_interest: Decimal
    total_repayment: Decimal
    total_charges: Decimal
    net_disbursement: Decimal
    irr: Optional[Decimal] = None
    selected_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoanOfferResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    principal: Decimal
    interest_rate: Decimal
    processing_fee: Decimal
    gst: Decimal
    other_charges: Decimal
    status: OfferStatus
    terms: list[LoanTermResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoanOfferListResponse(BaseModel):
    application_id: uuid.UUID
    offers: list[LoanOfferResponse]
