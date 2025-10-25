"""Settings initialization - Migrate .env to database on first run"""
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.app_settings import AppSettings
from app.core.config import settings as app_config


async def initialize_settings_from_env(db: AsyncSession) -> None:
    """
    Initialize global settings from environment variables

    This is called on application startup. If the app_settings table is empty,
    it populates it with values from .env. After initial deployment, the database
    becomes the source of truth (unless PREFER_ENV_SETTINGS=true).
    """
    # Check if settings table already has data
    result = await db.execute(select(AppSettings).limit(1))
    existing = result.scalar_one_or_none()

    if existing:
        print("⚙️  Settings already initialized in database")
        return

    print("⚙️  Initializing settings from .env...")

    # Define all settings to migrate
    settings_to_migrate = [
        # Company Info
        {
            "key": "COMPANY_NAME",
            "value": app_config.COMPANY_NAME,
            "category": "company",
            "data_type": "string",
            "description": "Company name"
        },
        {
            "key": "COMPANY_EMAIL",
            "value": app_config.COMPANY_EMAIL,
            "category": "company",
            "data_type": "string",
            "description": "Company email address"
        },
        {
            "key": "COMPANY_PHONE",
            "value": app_config.COMPANY_PHONE,
            "category": "company",
            "data_type": "string",
            "description": "Company phone number"
        },
        {
            "key": "TZ",
            "value": app_config.TZ,
            "category": "company",
            "data_type": "string",
            "description": "Timezone (e.g., America/New_York)"
        },

        # SMTP Settings
        {
            "key": "SMTP_ENABLED",
            "value": str(app_config.SMTP_ENABLED),
            "category": "smtp",
            "data_type": "boolean",
            "description": "Enable/disable email sending"
        },
        {
            "key": "SMTP_HOST",
            "value": app_config.SMTP_HOST,
            "category": "smtp",
            "data_type": "string",
            "description": "SMTP server hostname"
        },
        {
            "key": "SMTP_PORT",
            "value": str(app_config.SMTP_PORT),
            "category": "smtp",
            "data_type": "integer",
            "description": "SMTP server port"
        },
        {
            "key": "SMTP_USE_TLS",
            "value": str(app_config.SMTP_USE_TLS),
            "category": "smtp",
            "data_type": "boolean",
            "description": "Use TLS for SMTP connection"
        },
        {
            "key": "SMTP_USERNAME",
            "value": app_config.SMTP_USERNAME,
            "category": "smtp",
            "data_type": "string",
            "description": "SMTP username/email"
        },
        {
            "key": "SMTP_FROM_EMAIL",
            "value": app_config.SMTP_FROM_EMAIL,
            "category": "smtp",
            "data_type": "string",
            "description": "Email 'from' address"
        },
        {
            "key": "SMTP_FROM_NAME",
            "value": app_config.SMTP_FROM_NAME,
            "category": "smtp",
            "data_type": "string",
            "description": "Email 'from' name"
        },

        # OH&P Percentages
        {
            "key": "DEFAULT_MATERIAL_OHP",
            "value": str(app_config.DEFAULT_MATERIAL_OHP),
            "category": "ohp",
            "data_type": "float",
            "description": "Default Material OH&P percentage"
        },
        {
            "key": "DEFAULT_LABOR_OHP",
            "value": str(app_config.DEFAULT_LABOR_OHP),
            "category": "ohp",
            "data_type": "float",
            "description": "Default Labor OH&P percentage"
        },
        {
            "key": "DEFAULT_EQUIPMENT_OHP",
            "value": str(app_config.DEFAULT_EQUIPMENT_OHP),
            "category": "ohp",
            "data_type": "float",
            "description": "Default Equipment OH&P percentage"
        },
        {
            "key": "DEFAULT_SUBCONTRACTOR_OHP",
            "value": str(app_config.DEFAULT_SUBCONTRACTOR_OHP),
            "category": "ohp",
            "data_type": "float",
            "description": "Default Subcontractor OH&P percentage"
        },

        # Labor Rates
        {
            "key": "RATE_PROJECT_MANAGER",
            "value": str(app_config.RATE_PROJECT_MANAGER),
            "category": "rates",
            "data_type": "float",
            "description": "Project Manager hourly rate"
        },
        {
            "key": "RATE_SUPERINTENDENT",
            "value": str(app_config.RATE_SUPERINTENDENT),
            "category": "rates",
            "data_type": "float",
            "description": "Superintendent hourly rate"
        },
        {
            "key": "RATE_CARPENTER",
            "value": str(app_config.RATE_CARPENTER),
            "category": "rates",
            "data_type": "float",
            "description": "Carpenter hourly rate"
        },
        {
            "key": "RATE_LABORER",
            "value": str(app_config.RATE_LABORER),
            "category": "rates",
            "data_type": "float",
            "description": "Laborer hourly rate"
        },

        # Reminder Settings
        {
            "key": "REMINDER_ENABLED",
            "value": str(app_config.REMINDER_ENABLED),
            "category": "reminders",
            "data_type": "boolean",
            "description": "Enable/disable email reminders"
        },
        {
            "key": "REMINDER_INTERVAL_DAYS",
            "value": str(app_config.REMINDER_INTERVAL_DAYS),
            "category": "reminders",
            "data_type": "integer",
            "description": "Days between reminder emails"
        },
        {
            "key": "REMINDER_MAX_RETRIES",
            "value": str(app_config.REMINDER_MAX_RETRIES),
            "category": "reminders",
            "data_type": "integer",
            "description": "Maximum number of reminder emails"
        },

        # Approval Settings
        {
            "key": "APPROVAL_TOKEN_EXPIRATION_HOURS",
            "value": str(app_config.APPROVAL_TOKEN_EXPIRATION_HOURS),
            "category": "approval",
            "data_type": "integer",
            "description": "Hours until approval link expires"
        },
    ]

    # Insert all settings
    for setting_data in settings_to_migrate:
        setting = AppSettings(**setting_data)
        db.add(setting)

    await db.commit()

    print(f"✅ Initialized {len(settings_to_migrate)} settings from .env")
    print("   Settings can now be configured through the Settings page")
    print("   Database is now the source of truth (unless PREFER_ENV_SETTINGS=true)")
