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
        {
            "key": "COMPANY_LOGO_URL",
            "value": "",
            "category": "company",
            "data_type": "string",
            "description": "Company logo URL (uploaded to MinIO)"
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

        # Email Template Settings - RFCO Send Email
        {
            "key": "EMAIL_RFCO_SUBJECT",
            "value": "RFCO {tnm_number} - {project_name}",
            "category": "email_templates",
            "data_type": "string",
            "description": "Subject line for RFCO send email (variables: {tnm_number}, {project_name})"
        },
        {
            "key": "EMAIL_RFCO_GREETING",
            "value": "Dear General Contractor,",
            "category": "email_templates",
            "data_type": "string",
            "description": "Greeting for RFCO send email"
        },
        {
            "key": "EMAIL_RFCO_INTRO",
            "value": "Please review the following Request for Change Order (RFCO) for your approval.",
            "category": "email_templates",
            "data_type": "string",
            "description": "Introduction text for RFCO send email"
        },
        {
            "key": "EMAIL_RFCO_BUTTON_TEXT",
            "value": "Review & Approve RFCO",
            "category": "email_templates",
            "data_type": "string",
            "description": "Button text for RFCO send email"
        },
        {
            "key": "EMAIL_RFCO_FOOTER_TEXT",
            "value": "If you have any questions about this change order, please contact us at {company_email} or {company_phone}.",
            "category": "email_templates",
            "data_type": "string",
            "description": "Footer text for RFCO send email (variables: {company_email}, {company_phone})"
        },

        # Email Template Settings - Reminder Email
        {
            "key": "EMAIL_REMINDER_SUBJECT",
            "value": "REMINDER #{reminder_number}: RFCO {tnm_number} - {project_name}",
            "category": "email_templates",
            "data_type": "string",
            "description": "Subject line for reminder email (variables: {reminder_number}, {tnm_number}, {project_name})"
        },
        {
            "key": "EMAIL_REMINDER_GREETING",
            "value": "Dear General Contractor,",
            "category": "email_templates",
            "data_type": "string",
            "description": "Greeting for reminder email"
        },
        {
            "key": "EMAIL_REMINDER_INTRO",
            "value": "This is a friendly reminder that the following Request for Change Order (RFCO) is still pending your review and approval.",
            "category": "email_templates",
            "data_type": "string",
            "description": "Introduction text for reminder email"
        },
        {
            "key": "EMAIL_REMINDER_BUTTON_TEXT",
            "value": "Review & Approve RFCO",
            "category": "email_templates",
            "data_type": "string",
            "description": "Button text for reminder email"
        },
        {
            "key": "EMAIL_REMINDER_FOOTER_TEXT",
            "value": "If you need additional details or have questions about this change order, please contact us immediately.",
            "category": "email_templates",
            "data_type": "string",
            "description": "Footer text for reminder email"
        },

        # Email Template Settings - Approval Confirmation Email
        {
            "key": "EMAIL_APPROVAL_SUBJECT",
            "value": "Change Order {status}: {tnm_number} - {project_name}",
            "category": "email_templates",
            "data_type": "string",
            "description": "Subject line for approval confirmation email (variables: {status}, {tnm_number}, {project_name})"
        },
        {
            "key": "EMAIL_APPROVAL_INTRO",
            "value": "A decision has been made on the following change order.",
            "category": "email_templates",
            "data_type": "string",
            "description": "Introduction text for approval confirmation email"
        },

        # Email Template Settings - Due Date
        {
            "key": "EMAIL_DUE_DATE_LABEL",
            "value": "Response Due Date:",
            "category": "email_templates",
            "data_type": "string",
            "description": "Label for due date field in emails"
        },
        {
            "key": "EMAIL_SHOW_DUE_DATE",
            "value": "true",
            "category": "email_templates",
            "data_type": "boolean",
            "description": "Show due date in emails if set"
        },

        # PDF Template Settings
        {
            "key": "PDF_HEADER_SHOW_COMPANY_INFO",
            "value": "true",
            "category": "pdf",
            "data_type": "boolean",
            "description": "Show company name, email, and phone in PDF header"
        },
        {
            "key": "PDF_DOCUMENT_TITLE",
            "value": "REQUEST FOR CHANGE ORDER (RFCO)",
            "category": "pdf",
            "data_type": "string",
            "description": "Main document title displayed below header"
        },
        {
            "key": "PDF_PRIMARY_COLOR",
            "value": "#1d4ed8",
            "category": "pdf",
            "data_type": "string",
            "description": "Primary color for header border, section titles (hex color code)"
        },
        {
            "key": "PDF_SHOW_PROJECT_INFO_SECTION",
            "value": "true",
            "category": "pdf",
            "data_type": "boolean",
            "description": "Show 'Project Information' section"
        },
        {
            "key": "PDF_SHOW_NOTES_SECTION",
            "value": "true",
            "category": "pdf",
            "data_type": "boolean",
            "description": "Show 'Notes' section (if notes exist)"
        },
        {
            "key": "PDF_SHOW_SIGNATURE_SECTION",
            "value": "true",
            "category": "pdf",
            "data_type": "boolean",
            "description": "Show signature section at bottom"
        },
        {
            "key": "PDF_SIGNATURE_TITLE",
            "value": "General Contractor Approval:",
            "category": "pdf",
            "data_type": "string",
            "description": "Title for signature section"
        },
        {
            "key": "PDF_FOOTER_TEXT",
            "value": "This document was generated by {company_name}",
            "category": "pdf",
            "data_type": "string",
            "description": "Footer text for PDF documents (variables: {company_name}, {company_email}, {company_phone})"
        },
        {
            "key": "PDF_SHOW_COMPANY_INFO_IN_FOOTER",
            "value": "true",
            "category": "pdf",
            "data_type": "boolean",
            "description": "Show company name and email in PDF footer"
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
