"""
Authentication and Role-Based Access Control (RBAC) dependencies.

Provides reusable FastAPI dependencies to authenticate incoming requests via JWT
and enforce role-based access restrictions.
"""

import uuid
from typing import Callable
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.models.user import User, UserRole

# HTTP Bearer scheme (extracts Authorization: Bearer <token>)
security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that extracts and validates the JWT Bearer token,
    verifying user existence and active status against PostgreSQL.
    """
    if not credentials or not credentials.credentials:
        raise UnauthorizedError("Authentication credentials were not provided.")

    token = credentials.credentials
    payload = decode_access_token(token)

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedError("Token payload is missing subject claim.")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedError("Invalid user ID in token claim.")

    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()

    if not user:
        raise UnauthorizedError("User account associated with this token was not found.")

    if not user.is_active:
        raise UnauthorizedError("User account is inactive.")

    return user


def require_role(allowed_role: UserRole) -> Callable:
    """
    Dependency factory to enforce role-based access control (RBAC).

    Usage:
        @router.get("/admin/test")
        def admin_endpoint(current_user: User = Depends(require_role(UserRole.ADMIN))):
            ...
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role != allowed_role:
            raise ForbiddenError("You do not have permission to access this resource.")
        return current_user

    return role_checker
