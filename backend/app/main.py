"""
EZFINANZ — FastAPI Application Entry Point.

Configures middleware, exception handlers, and mounts all API routers.
Business logic lives in dedicated modules, not here.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.exceptions import AppException, app_exception_handler
from app.services.auth_service import ensure_default_accounts
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.loans import router as loans_router
from app.api.verification import router as verification_router
from app.api.admin import router as admin_api_router
from app.api.test_rbac import customer_router, admin_router


import logging

logger = logging.getLogger("uvicorn.info")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure default admin and customer demo accounts exist
    db = SessionLocal()
    try:
        ensure_default_accounts(db)
    finally:
        db.close()

    # Safe startup diagnostics (Never logs passwords or secrets)
    email_mode = settings.EMAIL_MODE.upper().strip()
    is_smtp = email_mode == "SMTP"
    smtp_has_creds = bool(settings.SMTP_USER and settings.SMTP_PASSWORD and settings.SMTP_HOST)
    
    print("=" * 60)
    print(f"  EZFINANZ Backend Initialized")
    print(f"  App Environment: {settings.APP_ENV}")
    print(f"  Email mode: {email_mode}")
    if is_smtp:
        provider = "Gmail SMTP" if "gmail" in settings.SMTP_HOST.lower() else "Custom SMTP"
        print(f"  Email provider: {provider}")
        print(f"  SMTP host: {settings.SMTP_HOST}")
        print(f"  SMTP port: {settings.SMTP_PORT}")
        print(f"  SMTP user: {settings.SMTP_USER}")
        print(f"  SMTP configured: {'YES' if smtp_has_creds else 'NO (Missing user or password)'}")
    else:
        print(f"  Email provider: Mock (In-Memory)")
        print(f"  SMTP configured: NO (Mock Mode)")
    print(f"  OTP mode: {settings.OTP_MODE.upper()}")
    print("=" * 60)

    yield


def create_app() -> FastAPI:
    """Application factory."""

    app = FastAPI(
        title=settings.APP_NAME,
        description="Personal Loan Application Platform",
        version="0.1.0",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # ---------------------
    # Middleware
    # ---------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---------------------
    # Exception Handlers
    # ---------------------
    app.add_exception_handler(AppException, app_exception_handler)

    # ---------------------
    # Routers
    # ---------------------
    app.include_router(health_router, prefix="/api/v1", tags=["health"])
    app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
    app.include_router(loans_router, prefix="/api/v1", tags=["loans"])
    app.include_router(verification_router, prefix="/api/v1", tags=["verification"])
    app.include_router(admin_api_router, prefix="/api/v1", tags=["admin"])
    app.include_router(customer_router, prefix="/api/v1", tags=["customer-test"])
    app.include_router(admin_router, prefix="/api/v1", tags=["admin-test"])

    return app


app = create_app()
