"""
Pydantic schemas for Eligibility assessment and explainable decisions.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict

from app.models.eligibility import EligibilityStatus


class EligibilityCheckResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    status: EligibilityStatus
    score: Optional[Decimal] = None
    dti_ratio: Optional[Decimal] = None
    reasons: Optional[list[str]] = None
    calculated_at: datetime

    model_config = ConfigDict(from_attributes=True)
