"""Settings schemas"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ============ Individual Setting ============

class SettingBase(BaseModel):
    """Base setting schema"""
    key: str = Field(..., min_length=1, max_length=255)
    value: str
    category: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    data_type: str = Field(..., min_length=1, max_length=50)


class SettingCreate(SettingBase):
    """Create setting schema"""
    pass


class SettingUpdate(BaseModel):
    """Update setting schema (just the value)"""
    value: str


class SettingResponse(SettingBase):
    """Setting response schema"""
    id: int
    created_at: datetime
    updated_at: datetime
    updated_by: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)


# ============ Grouped Settings ============

class CompanySettings(BaseModel):
    """Company information settings"""
    name: str
    email: EmailStr
    phone: str
    timezone: str
    logo_url: Optional[str] = None


class SMTPSettings(BaseModel):
    """SMTP email configuration"""
    enabled: bool
    host: str
    port: int
    use_tls: bool
    username: str
    from_email: EmailStr
    from_name: str
    # Note: password is NOT included (security)


class LaborRates(BaseModel):
    """Labor hourly rates"""
    project_manager: float = Field(..., ge=0)
    superintendent: float = Field(..., ge=0)
    carpenter: float = Field(..., ge=0)
    laborer: float = Field(..., ge=0)


class OHPPercentages(BaseModel):
    """Overhead & Profit percentages"""
    material: float = Field(..., ge=0, le=100)
    labor: float = Field(..., ge=0, le=100)
    equipment: float = Field(..., ge=0, le=100)
    subcontractor: float = Field(..., ge=0, le=100)


class ReminderSettings(BaseModel):
    """Email reminder configuration"""
    enabled: bool
    interval_days: int = Field(..., ge=1, le=30)
    max_retries: int = Field(..., ge=0, le=10)


class ApprovalSettings(BaseModel):
    """Approval link settings"""
    token_expiration_hours: int = Field(..., ge=1, le=720)  # 1 hour to 30 days


class EffectiveSettings(BaseModel):
    """
    All effective settings for a given context

    This returns the actual values that will be used,
    after applying hierarchy resolution.
    """
    company: CompanySettings
    smtp: SMTPSettings
    rates: LaborRates
    ohp: OHPPercentages
    reminders: ReminderSettings
    approval: ApprovalSettings


# ============ Settings Overrides ============

class SettingsOverrides(BaseModel):
    """
    Settings that can be overridden at project/ticket level
    All fields are optional - null means "use parent/global default"
    """
    # OH&P Percentages
    material_ohp_percent: Optional[float] = Field(None, ge=0, le=100)
    labor_ohp_percent: Optional[float] = Field(None, ge=0, le=100)
    equipment_ohp_percent: Optional[float] = Field(None, ge=0, le=100)
    subcontractor_ohp_percent: Optional[float] = Field(None, ge=0, le=100)

    # Labor Rates
    rate_project_manager: Optional[float] = Field(None, ge=0)
    rate_superintendent: Optional[float] = Field(None, ge=0)
    rate_carpenter: Optional[float] = Field(None, ge=0)
    rate_laborer: Optional[float] = Field(None, ge=0)


class ProjectSettingsOverrides(SettingsOverrides):
    """
    Settings overrides for Project level
    Includes project-only settings like reminders and approval
    """
    # Reminder settings (project-level only)
    reminder_interval_days: Optional[int] = Field(None, ge=1, le=30)
    reminder_max_retries: Optional[int] = Field(None, ge=0, le=10)

    # Approval settings (project-level only)
    approval_token_expiration_hours: Optional[int] = Field(None, ge=1, le=720)
