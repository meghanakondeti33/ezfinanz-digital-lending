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
        default="postgresql+psycopg2://postgres:postgres@localhost:5432/ezfinanz",
        description="PostgreSQL connection string",
    )

    # Authentication (placeholders — real values loaded from env)
    JWT_SECRET_KEY: str = Field(
        default="change-me",
        description="Secret key for JWT signing — must be overridden in production",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Google OAuth Configuration
    GOOGLE_CLIENT_ID: str = Field(
        default="",
        description="Google OAuth 2.0 Web Client ID",
    )

    # SMS & OTP Configuration
    OTP_MODE: str = Field(
        default="demo",
        description="OTP delivery mode: 'demo' (simulated/returned for dev) or 'sms' (sent via provider)",
    )
    OTP_EXPIRE_SECONDS: int = 300
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    SMS_PROVIDER: str = Field(
        default="fast2sms",
        description="SMS Provider: 'fast2sms', '2factor', 'msg91', 'twilio', or 'mock'",
    )
    SMS_API_KEY: str = Field(
        default="",
        description="API Key for the SMS Provider",
    )
    SMS_SENDER_ID: str = Field(
        default="",
        description="Sender ID / DLT Header",
    )
    SMS_TEMPLATE_ID: str = Field(
        default="",
        description="DLT Template ID (if required by provider)",
    )
    TWILIO_ACCOUNT_SID: str = Field(default="")
    TWILIO_AUTH_TOKEN: str = Field(default="")
    # Email & Email Verification Configuration
    EMAIL_MODE: str = Field(
        default="mock",
        description="Email delivery mode: 'mock' (logs for dev/testing) or 'smtp' (real delivery)",
    )
    EMAIL_PROVIDER: str = Field(
        default="mock",
        description="Email provider: 'mock', 'smtp', or 'sendgrid'",
    )
    EMAIL_FROM: str = Field(
        default="noreply@ezfinanz.com",
        description="Sender email address",
    )
    SMTP_HOST: str = Field(default="smtp.gmail.com", description="SMTP server hostname")
    SMTP_PORT: int = Field(default=587, description="SMTP server port (587 for TLS, 465 for SSL)")
    SMTP_USER: str = Field(default="", description="SMTP username or email")
    SMTP_PASSWORD: str = Field(default="", description="SMTP password or app password")
    SMTP_USE_TLS: bool = Field(default=True, description="Enable STARTTLS for SMTP")
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    EMAIL_RESEND_COOLDOWN_SECONDS: int = 60
    FRONTEND_URL: str = Field(
        default="http://localhost:5173",
        description="Frontend base URL for verification links",
    )

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


settings = Settings()
