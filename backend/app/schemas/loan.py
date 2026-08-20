"""
Loan application request and response schemas.
"""

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import MIN_LOAN_AMOUNT, MAX_LOAN_AMOUNT
from app.models.loan import ApplicationStatus


class EmploymentType(str, enum.Enum):
    SALARIED = "SALARIED"
    SELF_EMPLOYED = "SELF_EMPLOYED"
    BUSINESS = "BUSINESS"
    OTHER = "OTHER"


class LoanApplicationCreate(BaseModel):
    """Payload to create a new draft loan application (all fields optional for drafts)."""
    requested_amount: Optional[Decimal] = Field(None, gt=0, description="Requested loan amount in INR")
    purpose: Optional[str] = Field(None, max_length=255, description="Purpose of the loan")
    monthly_income: Optional[Decimal] = Field(None, gt=0, description="Gross monthly income in INR")
    employment_type: Optional[str] = Field(None, max_length=50, description="Employment type (SALARIED, SELF_EMPLOYED, etc.)")
    employer_name: Optional[str] = Field(None, max_length=255, description="Employer or company name")
    designation: Optional[str] = Field(None, max_length=255, description="Job title or designation")
    existing_debt: Optional[Decimal] = Field(None, ge=0, description="Existing monthly debt obligations in INR")
    requested_tenure_months: Optional[int] = Field(None, ge=1, le=120, description="Requested loan tenure in months")

    @field_validator("requested_amount")
    @classmethod
    def validate_requested_amount(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            if v < MIN_LOAN_AMOUNT:
                raise ValueError(f"Requested loan amount must be at least ₹{MIN_LOAN_AMOUNT:,.2f}")
            if v > MAX_LOAN_AMOUNT:
                raise ValueError(f"Requested loan amount cannot exceed ₹{MAX_LOAN_AMOUNT:,.2f}")
        return v

    model_config = {
        "extra": "forbid",
    }


class LoanApplicationUpdate(BaseModel):
    """Payload to update an existing draft loan application."""
    requested_amount: Optional[Decimal] = Field(None, gt=0)
    purpose: Optional[str] = Field(None, max_length=255)
    monthly_income: Optional[Decimal] = Field(None, gt=0)
    employment_type: Optional[str] = Field(None, max_length=50)
    employer_name: Optional[str] = Field(None, max_length=255)
    designation: Optional[str] = Field(None, max_length=255)
    existing_debt: Optional[Decimal] = Field(None, ge=0)
    requested_tenure_months: Optional[int] = Field(None, ge=1, le=120)

    @field_validator("requested_amount")
    @classmethod
    def validate_requested_amount(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            if v < MIN_LOAN_AMOUNT:
                raise ValueError(f"Requested loan amount must be at least ₹{MIN_LOAN_AMOUNT:,.2f}")
            if v > MAX_LOAN_AMOUNT:
                raise ValueError(f"Requested loan amount cannot exceed ₹{MAX_LOAN_AMOUNT:,.2f}")
        return v

    model_config = {
        "extra": "forbid",
    }


class LoanApplicationResponse(BaseModel):
    """Safe public API representation of a loan application."""
    id: uuid.UUID
    application_number: str
    user_id: uuid.UUID
    status: ApplicationStatus
    requested_amount: Optional[Decimal] = None
    purpose: Optional[str] = None
    monthly_income: Optional[Decimal] = None
    employment_type: Optional[str] = None
    employer_name: Optional[str] = None
    designation: Optional[str] = None
    existing_debt: Optional[Decimal] = None
    requested_tenure_months: Optional[int] = None
    credit_score: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LoanApplicationListResponse(BaseModel):
    """Paginated list of customer loan applications."""
    items: list[LoanApplicationResponse]
    total: int
