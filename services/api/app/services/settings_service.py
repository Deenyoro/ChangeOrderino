"""Settings service for hierarchical settings management"""
import os
from typing import Optional, Any, Dict
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from decimal import Decimal

from app.models.app_settings import AppSettings
from app.models.project import Project
from app.models.tnm_ticket import TNMTicket
from app.core.config import settings as app_config


class SettingsService:
    """
    Handles hierarchical settings resolution

    Hierarchy (highest priority first):
    1. TNM Ticket overrides (if tnm_ticket_id provided)
    2. Project overrides (if project_id provided)
    3. Global app settings (database)
    4. Environment variables (.env fallback)

    If PREFER_ENV_SETTINGS=true in .env, skip database and use .env directly
    """

    # Settings that can be overridden at project/ticket level
    OVERRIDABLE_SETTINGS = {
        # OH&P Percentages
        "DEFAULT_MATERIAL_OHP": {"attr": "material_ohp_percent", "type": "float"},
        "DEFAULT_LABOR_OHP": {"attr": "labor_ohp_percent", "type": "float"},
        "DEFAULT_EQUIPMENT_OHP": {"attr": "equipment_ohp_percent", "type": "float"},
        "DEFAULT_SUBCONTRACTOR_OHP": {"attr": "subcontractor_ohp_percent", "type": "float"},

        # Labor Rates
        "RATE_PROJECT_MANAGER": {"attr": "rate_project_manager", "type": "float"},
        "RATE_SUPERINTENDENT": {"attr": "rate_superintendent", "type": "float"},
        "RATE_CARPENTER": {"attr": "rate_carpenter", "type": "float"},
        "RATE_LABORER": {"attr": "rate_laborer", "type": "float"},
    }

    # Project-level settings (not overridable at ticket level)
    PROJECT_ONLY_SETTINGS = {
        "REMINDER_INTERVAL_DAYS": {"attr": "reminder_interval_days", "type": "int"},
        "REMINDER_MAX_RETRIES": {"attr": "reminder_max_retries", "type": "int"},
        "APPROVAL_TOKEN_EXPIRATION_HOURS": {"attr": "approval_token_expiration_hours", "type": "int"},
    }

    @staticmethod
    async def get_setting(
        key: str,
        db: AsyncSession,
        tnm_ticket_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
    ) -> Any:
        """
        Get a setting value with hierarchical resolution

        Args:
            key: Setting key (e.g., "RATE_PROJECT_MANAGER")
            db: Database session
            tnm_ticket_id: Optional TNM ticket ID for ticket-level overrides
            project_id: Optional project ID for project-level overrides

        Returns:
            Setting value with appropriate type
        """
        # If PREFER_ENV_SETTINGS is true, skip database and use env directly
        if getattr(app_config, "PREFER_ENV_SETTINGS", False):
            return SettingsService._get_env_value(key)

        # Check if this setting is overridable
        setting_config = (
            SettingsService.OVERRIDABLE_SETTINGS.get(key) or
            SettingsService.PROJECT_ONLY_SETTINGS.get(key)
        )

        # 1. Check TNM ticket overrides (for overridable settings only)
        if tnm_ticket_id and setting_config and key in SettingsService.OVERRIDABLE_SETTINGS:
            ticket = await db.get(TNMTicket, tnm_ticket_id)
            if ticket:
                attr_name = setting_config["attr"]
                value = getattr(ticket, attr_name, None)
                if value is not None:
                    return SettingsService._convert_type(value, setting_config["type"])
                # If ticket doesn't have override, use its project_id
                project_id = ticket.project_id

        # 2. Check project overrides
        if project_id and setting_config:
            project = await db.get(Project, project_id)
            if project:
                attr_name = setting_config["attr"]
                value = getattr(project, attr_name, None)
                if value is not None:
                    return SettingsService._convert_type(value, setting_config["type"])

        # 3. Check global app settings (database)
        result = await db.execute(
            select(AppSettings).where(AppSettings.key == key)
        )
        app_setting = result.scalar_one_or_none()
        if app_setting:
            return app_setting.get_typed_value()

        # 4. Fallback to environment variable
        return SettingsService._get_env_value(key)

    @staticmethod
    def _get_env_value(key: str) -> Any:
        """Get value from environment variables with type conversion"""
        value = os.getenv(key)
        if value is None:
            return None

        # Try to infer type from setting config
        setting_config = (
            SettingsService.OVERRIDABLE_SETTINGS.get(key) or
            SettingsService.PROJECT_ONLY_SETTINGS.get(key)
        )

        if setting_config:
            return SettingsService._convert_type(value, setting_config["type"])

        # Default type detection for other settings
        if value.lower() in ("true", "false"):
            return value.lower() == "true"
        try:
            if "." in value:
                return float(value)
            return int(value)
        except ValueError:
            return value

    @staticmethod
    def _convert_type(value: Any, type_name: str) -> Any:
        """Convert value to specified type"""
        if value is None:
            return None
        if isinstance(value, Decimal):
            value = float(value)
        if type_name == "float":
            return float(value)
        elif type_name == "int":
            return int(value)
        elif type_name == "boolean":
            if isinstance(value, str):
                return value.lower() in ("true", "1", "yes", "on")
            return bool(value)
        else:
            return str(value)

    @staticmethod
    async def get_effective_settings(
        db: AsyncSession,
        tnm_ticket_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Get all effective settings for a given context

        Returns a dictionary with all settings and their effective values
        """
        all_keys = {
            **SettingsService.OVERRIDABLE_SETTINGS,
            **SettingsService.PROJECT_ONLY_SETTINGS,
        }

        result = {}
        for key in all_keys.keys():
            result[key] = await SettingsService.get_setting(
                key, db, tnm_ticket_id, project_id
            )

        # Add company info (always from global)
        company_keys = ["COMPANY_NAME", "COMPANY_EMAIL", "COMPANY_PHONE", "TZ", "COMPANY_LOGO_URL"]
        for key in company_keys:
            result[key] = await SettingsService.get_setting(key, db)

        # Add SMTP settings (always from global)
        smtp_keys = [
            "SMTP_ENABLED", "SMTP_HOST", "SMTP_PORT", "SMTP_USE_TLS",
            "SMTP_USERNAME", "SMTP_FROM_EMAIL", "SMTP_FROM_NAME"
        ]
        for key in smtp_keys:
            result[key] = await SettingsService.get_setting(key, db)

        # Add reminder enabled (global only, but interval/retries can be project-level)
        result["REMINDER_ENABLED"] = await SettingsService.get_setting("REMINDER_ENABLED", db)

        return result

    @staticmethod
    async def update_global_setting(
        key: str,
        value: str,
        db: AsyncSession,
        user_id: Optional[UUID] = None,
    ) -> AppSettings:
        """
        Update or create a global setting

        Args:
            key: Setting key
            value: Setting value (as string)
            db: Database session
            user_id: User making the change

        Returns:
            Updated or created AppSettings object
        """
        result = await db.execute(
            select(AppSettings).where(AppSettings.key == key)
        )
        setting = result.scalar_one_or_none()

        if setting:
            setting.value = value
            setting.updated_by = user_id
        else:
            # Determine category and data_type from key
            category = SettingsService._get_category(key)
            data_type = SettingsService._get_data_type(key)

            setting = AppSettings(
                key=key,
                value=value,
                category=category,
                data_type=data_type,
                description=SettingsService._get_description(key),
                updated_by=user_id,
            )
            db.add(setting)

        return setting

    @staticmethod
    async def get_all_settings(
        db: AsyncSession,
        category: Optional[str] = None,
    ) -> list[AppSettings]:
        """Get all global settings, optionally filtered by category"""
        query = select(AppSettings)
        if category:
            query = query.where(AppSettings.category == category)
        query = query.order_by(AppSettings.category, AppSettings.key)

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    def _get_category(key: str) -> str:
        """Determine category from setting key"""
        if key.startswith("COMPANY_"):
            return "company"
        elif key.startswith("SMTP_"):
            return "smtp"
        elif key.startswith("RATE_"):
            return "rates"
        elif key.startswith("DEFAULT_") and "_OHP" in key:
            return "ohp"
        elif key.startswith("REMINDER_"):
            return "reminders"
        elif key.startswith("APPROVAL_") or key == "REQUIRE_GC_SIGNATURE_ON_APPROVAL":
            return "approval"
        elif key == "TZ":
            return "company"
        else:
            return "other"

    @staticmethod
    def _get_data_type(key: str) -> str:
        """Determine data type from setting key"""
        if key in SettingsService.OVERRIDABLE_SETTINGS:
            return SettingsService.OVERRIDABLE_SETTINGS[key]["type"]
        elif key in SettingsService.PROJECT_ONLY_SETTINGS:
            return SettingsService.PROJECT_ONLY_SETTINGS[key]["type"]
        elif "ENABLED" in key or "USE_TLS" in key or "REQUIRE_" in key:
            return "boolean"
        elif "PORT" in key or "DAYS" in key or "RETRIES" in key or "HOURS" in key:
            return "integer"
        else:
            return "string"

    @staticmethod
    def _get_description(key: str) -> str:
        """Get description for setting key"""
        descriptions = {
            "COMPANY_NAME": "Company name",
            "COMPANY_EMAIL": "Company email address",
            "COMPANY_PHONE": "Company phone number",
            "TZ": "Timezone (e.g., America/New_York)",
            "SMTP_ENABLED": "Enable/disable email sending",
            "SMTP_HOST": "SMTP server hostname",
            "SMTP_PORT": "SMTP server port",
            "SMTP_USE_TLS": "Use TLS for SMTP connection",
            "SMTP_USERNAME": "SMTP username/email",
            "SMTP_FROM_EMAIL": "Email 'from' address",
            "SMTP_FROM_NAME": "Email 'from' name",
            "DEFAULT_MATERIAL_OHP": "Default Material OH&P percentage",
            "DEFAULT_LABOR_OHP": "Default Labor OH&P percentage",
            "DEFAULT_EQUIPMENT_OHP": "Default Equipment OH&P percentage",
            "DEFAULT_SUBCONTRACTOR_OHP": "Default Subcontractor OH&P percentage",
            "RATE_PROJECT_MANAGER": "Project Manager hourly rate",
            "RATE_SUPERINTENDENT": "Superintendent hourly rate",
            "RATE_CARPENTER": "Carpenter hourly rate",
            "RATE_LABORER": "Laborer hourly rate",
            "REMINDER_ENABLED": "Enable/disable email reminders",
            "REMINDER_INTERVAL_DAYS": "Days between reminder emails",
            "REMINDER_MAX_RETRIES": "Maximum number of reminder emails",
            "APPROVAL_TOKEN_EXPIRATION_HOURS": "Hours until approval link expires",
            "REQUIRE_GC_SIGNATURE_ON_APPROVAL": "Require General Contractor signature on approval page",
        }
        return descriptions.get(key, "")


# Singleton instance
settings_service = SettingsService()
