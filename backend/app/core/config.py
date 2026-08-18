"""
Application configuration loaded from environment variables.

All secrets and environment-specific values are read from .env files
or environment variables — never hardcoded.
"""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings sourced from environment variables."""

    # Application
    APP_NAME: str = "EZFINANZ"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/ezfinanz",
        description="PostgreSQL connection string",
    )

    # Authentication (placeholders — real values loaded from env)
    JWT_SECRET_KEY: str = Field(
        default="change-me",
        description="Secret key for JWT signing — must be overridden in production",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173",
        description="Comma-separated list of allowed CORS origins",
    )

    # Storage
    STORAGE_DIR: str = "./storage"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


# Singleton instance
settings = Settings()
