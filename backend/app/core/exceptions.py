"""
Application exception hierarchy and FastAPI exception handlers.

All custom exceptions inherit from AppException so they can be
caught by a single handler and returned as consistent JSON errors.
"""

from fastapi import Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base exception for all application errors."""

    def __init__(self, message: str = "An unexpected error occurred", status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(AppException):
    """Resource not found."""

    def __init__(self, message: str = "Resource not found"):
        super().__init__(message=message, status_code=404)


class ValidationError(AppException):
    """Request validation failed."""

    def __init__(self, message: str = "Validation error"):
        super().__init__(message=message, status_code=422)


class UnauthorizedError(AppException):
    """Authentication required or failed."""

    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message=message, status_code=401)


class ForbiddenError(AppException):
    """Insufficient permissions."""

    def __init__(self, message: str = "Forbidden"):
        super().__init__(message=message, status_code=403)


class ConflictError(AppException):
    """Resource conflict (e.g. duplicate entry, invalid state transition)."""

    def __init__(self, message: str = "Conflict"):
        super().__init__(message=message, status_code=409)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """
    Global handler for AppException and its subclasses.

    Returns a consistent JSON error envelope:
    {
        "error": {
            "message": "...",
            "status_code": 404
        }
    }
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.message,
                "status_code": exc.status_code,
            }
        },
    )
