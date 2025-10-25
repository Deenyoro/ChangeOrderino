"""
Application configuration using Pydantic Settings
"""
from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # ============ GENERAL ============
    APP_NAME: str = "ChangeOrderino API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=False)

    # ============ API ============
    API_HOST: str = Field(default="0.0.0.0")
    API_PORT: int = Field(default=8000)
    CORS_ORIGINS: str = Field(default="http://localhost:3000")

    # ============ DATABASE ============
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://changeorderino:password@db:5432/changeorderino"
    )
    DB_POOL_SIZE: int = Field(default=20)
    DB_MAX_OVERFLOW: int = Field(default=0)
    DB_ECHO: bool = Field(default=False)

    # ============ REDIS ============
    REDIS_URL: str = Field(default="redis://redis:6379/0")

    # ============ MINIO (S3 Storage) ============
    MINIO_SERVER_URL: str = Field(default="minio:9000")
    MINIO_ROOT_USER: str = Field(default="minioadmin")
    MINIO_ROOT_PASSWORD: str = Field(default="minioadmin")
    MINIO_BUCKET_NAME: str = Field(default="changeorders")
    MINIO_SECURE: bool = Field(default=False)

    # ============ SECURITY ============
    JWT_SECRET: str = Field(default="changeme_jwt_secret_key_min_32_chars")
    JWT_ALGORITHM: str = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int = Field(default=60)
    MAX_UPLOAD_SIZE: int = Field(default=10485760)  # 10MB

    # ============ AUTHENTICATION (Keycloak) ============
    AUTH_ENABLED: bool = Field(default=True)
    KEYCLOAK_SERVER_URL: str = Field(default="http://keycloak:8080")
    KEYCLOAK_REALM_URL: str = Field(default="http://keycloak:8080/realms/changeorderino")
    KEYCLOAK_REALM: str = Field(default="changeorderino")
    KEYCLOAK_CLIENT_ID: str = Field(default="changeorderino-app")
    KEYCLOAK_CLIENT_SECRET: Optional[str] = Field(default=None)

    # ============ EMAIL (SMTP) ============
    SMTP_ENABLED: bool = Field(default=True)
    SMTP_HOST: str = Field(default="smtp.office365.com")
    SMTP_PORT: int = Field(default=587)
    SMTP_USE_TLS: bool = Field(default=True)
    SMTP_USERNAME: str = Field(default="changeorder@treconstruction.net")
    SMTP_PASSWORD: str = Field(default="")
    SMTP_FROM_EMAIL: str = Field(default="changeorder@treconstruction.net")
    SMTP_FROM_NAME: str = Field(default="TRE Construction Change Orders")

    # ============ COMPANY INFO ============
    COMPANY_NAME: str = Field(default="TRE Construction")
    COMPANY_EMAIL: str = Field(default="changeorder@treconstruction.net")
    COMPANY_PHONE: str = Field(default="555-123-4567")

    # ============ CHANGE ORDER SETTINGS ============
    DEFAULT_MATERIAL_OHP: float = Field(default=15.0)
    DEFAULT_LABOR_OHP: float = Field(default=20.0)
    DEFAULT_EQUIPMENT_OHP: float = Field(default=10.0)
    DEFAULT_SUBCONTRACTOR_OHP: float = Field(default=5.0)

    RATE_PROJECT_MANAGER: float = Field(default=91.0)
    RATE_SUPERINTENDENT: float = Field(default=82.0)
    RATE_CARPENTER: float = Field(default=75.0)
    RATE_LABORER: float = Field(default=57.0)

    REMINDER_ENABLED: bool = Field(default=True)
    REMINDER_INTERVAL_DAYS: int = Field(default=7)
    REMINDER_MAX_RETRIES: int = Field(default=4)

    APPROVAL_TOKEN_EXPIRATION_HOURS: int = Field(default=168)  # 7 days

    # ============ CONFIGURATION ============
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    def get_cors_origins_list(self) -> list[str]:
        """Parse and return CORS origins as a list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    def get_labor_rate(self, labor_type: str) -> float:
        """Get hourly rate for labor type"""
        rates = {
            "project_manager": self.RATE_PROJECT_MANAGER,
            "superintendent": self.RATE_SUPERINTENDENT,
            "carpenter": self.RATE_CARPENTER,
            "laborer": self.RATE_LABORER,
        }
        return rates.get(labor_type, 0.0)


# Singleton settings instance
settings = Settings()
