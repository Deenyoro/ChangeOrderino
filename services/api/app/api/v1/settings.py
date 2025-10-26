"""Settings API endpoints"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings as app_settings
from app.services.settings_service import settings_service
from app.services.storage import storage_service
from app.schemas.settings import (
    SettingResponse,
    SettingUpdate,
    EffectiveSettings,
    CompanySettings,
    SMTPSettings,
    LaborRates,
    OHPPercentages,
    ReminderSettings,
    ApprovalSettings,
)

router = APIRouter()


# ============ ADMIN ENDPOINTS (Global Settings) ============

@router.get("/settings", response_model=List[SettingResponse])
async def get_global_settings(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    # TODO: Add admin auth dependency here
):
    """
    Get all global settings (admin only)

    Optional filter by category:
    - company: Company information
    - smtp: Email configuration
    - rates: Labor rates
    - ohp: OH&P percentages
    - reminders: Reminder settings
    - approval: Approval settings
    """
    settings = await settings_service.get_all_settings(db, category=category)
    return settings


@router.put("/settings/{key}", response_model=SettingResponse)
async def update_global_setting(
    key: str,
    update: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    # TODO: Add admin auth dependency here
    # current_user: TokenData = Depends(require_admin)
):
    """
    Update a global setting (admin only)

    The database becomes the source of truth after updating.
    """
    try:
        setting = await settings_service.update_global_setting(
            key=key,
            value=update.value,
            db=db,
            # user_id=current_user.sub  # TODO: Uncomment when auth is added
        )
        await db.commit()
        await db.refresh(setting)
        return setting
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update setting: {str(e)}"
        )


# ============ EFFECTIVE SETTINGS ENDPOINTS ============

@router.get("/settings/effective", response_model=EffectiveSettings)
async def get_effective_settings(
    project_id: Optional[UUID] = None,
    tnm_ticket_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    # current_user: TokenData = Depends(get_current_user)  # TODO: Add auth
):
    """
    Get effective settings for a project or TNM ticket

    Returns the actual values that will be used, after applying hierarchy resolution:
    1. TNM ticket overrides (if tnm_ticket_id provided)
    2. Project overrides (if project_id provided)
    3. Global database settings
    4. .env fallback

    This endpoint can be called by any authenticated user to see what settings
    will be applied for their project/ticket.
    """
    try:
        # Get all effective settings as a flat dict
        settings_dict = await settings_service.get_effective_settings(
            db=db,
            tnm_ticket_id=tnm_ticket_id,
            project_id=project_id,
        )

        # Group them into structured response
        effective = EffectiveSettings(
            company=CompanySettings(
                name=settings_dict.get("COMPANY_NAME", ""),
                email=settings_dict.get("COMPANY_EMAIL", ""),
                phone=settings_dict.get("COMPANY_PHONE", ""),
                timezone=settings_dict.get("TZ", "America/New_York"),
                logo_url=settings_dict.get("COMPANY_LOGO_URL"),
            ),
            smtp=SMTPSettings(
                enabled=settings_dict.get("SMTP_ENABLED", True),
                host=settings_dict.get("SMTP_HOST", ""),
                port=settings_dict.get("SMTP_PORT", 587),
                use_tls=settings_dict.get("SMTP_USE_TLS", True),
                username=settings_dict.get("SMTP_USERNAME", ""),
                from_email=settings_dict.get("SMTP_FROM_EMAIL", ""),
                from_name=settings_dict.get("SMTP_FROM_NAME", ""),
            ),
            rates=LaborRates(
                project_manager=settings_dict.get("RATE_PROJECT_MANAGER", 0),
                superintendent=settings_dict.get("RATE_SUPERINTENDENT", 0),
                carpenter=settings_dict.get("RATE_CARPENTER", 0),
                laborer=settings_dict.get("RATE_LABORER", 0),
            ),
            ohp=OHPPercentages(
                material=settings_dict.get("DEFAULT_MATERIAL_OHP", 15),
                labor=settings_dict.get("DEFAULT_LABOR_OHP", 20),
                equipment=settings_dict.get("DEFAULT_EQUIPMENT_OHP", 10),
                subcontractor=settings_dict.get("DEFAULT_SUBCONTRACTOR_OHP", 5),
            ),
            reminders=ReminderSettings(
                enabled=settings_dict.get("REMINDER_ENABLED", True),
                interval_days=settings_dict.get("REMINDER_INTERVAL_DAYS", 7),
                max_retries=settings_dict.get("REMINDER_MAX_RETRIES", 4),
            ),
            approval=ApprovalSettings(
                token_expiration_hours=settings_dict.get("APPROVAL_TOKEN_EXPIRATION_HOURS", 168),
            ),
        )

        return effective

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get effective settings: {str(e)}"
        )


# ============ LOGO UPLOAD ENDPOINT ============

@router.post("/settings/logo")
async def upload_company_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    # TODO: Add admin auth dependency here
):
    """
    Upload company logo (admin only)

    Accepts PNG or SVG files. Stores in MinIO and updates COMPANY_LOGO_URL setting.
    """
    # Validate file type
    allowed_types = {"image/png", "image/svg+xml"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Only PNG and SVG are allowed. Got: {file.content_type}"
        )

    # Validate file size (10MB max)
    max_size = 10 * 1024 * 1024  # 10MB
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size is 10MB. Got: {len(file_content)} bytes"
        )

    try:
        # Create a BytesIO object for MinIO upload
        from io import BytesIO
        file_data = BytesIO(file_content)

        # Upload to MinIO in 'logos' folder
        storage_key, file_size = storage_service.upload_file(
            file_data=file_data,
            filename=file.filename,
            content_type=file.content_type,
            folder="logos",
        )

        # Generate public URL using FRONTEND_URL
        # Use absolute URL so it works in emails
        logo_url = f"{app_settings.FRONTEND_URL}/storage/{storage_service.bucket_name}/{storage_key}"

        # Update COMPANY_LOGO_URL setting in database
        setting = await settings_service.update_global_setting(
            key="COMPANY_LOGO_URL",
            value=logo_url,
            db=db,
        )
        await db.commit()
        await db.refresh(setting)

        return {
            "success": True,
            "logo_url": logo_url,
            "storage_key": storage_key,
            "file_size": file_size,
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload logo: {str(e)}"
        )
