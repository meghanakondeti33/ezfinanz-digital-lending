"""
Test RBAC verification endpoints.

These endpoints are strictly for architectural verification of Role-Based Access Control
and will be replaced by actual business endpoints in future phases.
"""

from fastapi import APIRouter, Depends

from app.core.auth import require_role
from app.models.user import User, UserRole

customer_router = APIRouter(prefix="/customer", tags=["customer-test"])
admin_router = APIRouter(prefix="/admin", tags=["admin-test"])


@customer_router.get(
    "/test",
    summary="Test endpoint requiring CUSTOMER role",
)
def customer_test_endpoint(
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
):
    """
    Development verification endpoint accessible only to users with the CUSTOMER role.
    """
    return {
        "status": "authorized",
        "role": current_user.role.value,
        "message": "Welcome, verified customer! You have access to the customer portal.",
        "user_id": str(current_user.id),
    }


@admin_router.get(
    "/test",
    summary="Test endpoint requiring ADMIN role",
)
def admin_test_endpoint(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    Development verification endpoint accessible only to users with the ADMIN role.
    """
    return {
        "status": "authorized",
        "role": current_user.role.value,
        "message": "Welcome, authorized administrator! You have access to the admin portal.",
        "user_id": str(current_user.id),
    }
