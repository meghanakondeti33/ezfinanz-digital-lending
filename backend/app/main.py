"""
EZFINANZ — FastAPI Application Entry Point.

Configures middleware, exception handlers, and mounts all API routers.
Business logic lives in dedicated modules, not here.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import AppException, app_exception_handler
from app.api.health import router as health_router


def create_app() -> FastAPI:
    """Application factory."""

    app = FastAPI(
        title=settings.APP_NAME,
        description="Personal Loan Application Platform",
        version="0.1.0",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
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

    return app


app = create_app()
