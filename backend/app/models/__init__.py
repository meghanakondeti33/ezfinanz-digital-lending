"""
EZFINANZ SQLAlchemy Models.

Importing this module ensures all models are registered with the
declarative Base, so Alembic can discover them for migration generation.
"""

from app.models.user import User
from app.models.verification import UserVerification
from app.models.kyc import KYCDetail
from app.models.loan import LoanApplication
from app.models.eligibility import EligibilityCheck
from app.models.offer import LoanOffer
from app.models.loan_term import LoanTerm
from app.models.bank import BankAccount
from app.models.declaration import Declaration
from app.models.selfie import SelfieVerification
from app.models.review import AdminReview
from app.models.disbursement import Disbursement
from app.models.audit import AuditLog

__all__ = [
    "User",
    "UserVerification",
    "KYCDetail",
    "LoanApplication",
    "EligibilityCheck",
    "LoanOffer",
    "LoanTerm",
    "BankAccount",
    "Declaration",
    "SelfieVerification",
    "AdminReview",
    "Disbursement",
    "AuditLog",
]
