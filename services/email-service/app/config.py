"""Email service configuration"""
import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class Config:
    """Email service configuration"""

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://changeorderino:password@db:5432/changeorderino")

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    # SMTP Configuration
    SMTP_ENABLED: bool = os.getenv("SMTP_ENABLED", "false").lower() == "true"
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.office365.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "changeorder@treconstruction.net")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "TRE Construction Change Orders")

    # Company Info
    COMPANY_NAME: str = os.getenv("COMPANY_NAME", "TRE Construction")
    COMPANY_EMAIL: str = os.getenv("COMPANY_EMAIL", "changeorder@treconstruction.net")
    COMPANY_PHONE: str = os.getenv("COMPANY_PHONE", "555-123-4567")

    # Reminder Configuration
    REMINDER_ENABLED: bool = os.getenv("REMINDER_ENABLED", "true").lower() == "true"
    REMINDER_INTERVAL_DAYS: int = int(os.getenv("REMINDER_INTERVAL_DAYS", "7"))
    REMINDER_MAX_RETRIES: int = int(os.getenv("REMINDER_MAX_RETRIES", "4"))

    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # API URL (for generating approval links)
    API_BASE_URL: str = os.getenv("API_BASE_URL", "http://localhost:3000")

    # Queue Configuration
    QUEUE_NAME: str = "email_queue"
    FAILED_QUEUE_NAME: str = "failed_email_queue"

    # Email Retry Configuration
    MAX_RETRIES: int = 3
    RETRY_DELAY_SECONDS: int = 60

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")


# Global config instance
config = Config()
