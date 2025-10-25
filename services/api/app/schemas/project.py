"""Project schemas"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, EmailStr, ConfigDict


class ProjectBase(BaseModel):
    """Base project schema"""
    name: str = Field(..., min_length=1, max_length=255)
    project_number: str = Field(..., min_length=1, max_length=100)
    customer_company: Optional[str] = None
    gc_company: Optional[str] = None
    gc_email: Optional[EmailStr] = None
    gc_contact_name: Optional[str] = None
    gc_phone: Optional[str] = None
    project_manager_id: Optional[UUID] = None
    project_manager_name: Optional[str] = None

    # Settings overrides (nullable = use global defaults)
    material_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    labor_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    equipment_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    subcontractor_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    rate_project_manager: Optional[Decimal] = Field(None, ge=0)
    rate_superintendent: Optional[Decimal] = Field(None, ge=0)
    rate_carpenter: Optional[Decimal] = Field(None, ge=0)
    rate_laborer: Optional[Decimal] = Field(None, ge=0)
    reminder_interval_days: Optional[int] = Field(None, ge=1, le=30)
    reminder_max_retries: Optional[int] = Field(None, ge=0, le=10)
    approval_token_expiration_hours: Optional[int] = Field(None, ge=1, le=720)

    is_active: bool = True
    notes: Optional[str] = None


class ProjectCreate(ProjectBase):
    """Create project schema"""
    pass


class ProjectUpdate(BaseModel):
    """Update project schema (all fields optional)"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    project_number: Optional[str] = Field(None, min_length=1, max_length=100)
    customer_company: Optional[str] = None
    gc_company: Optional[str] = None
    gc_email: Optional[EmailStr] = None
    gc_contact_name: Optional[str] = None
    gc_phone: Optional[str] = None
    project_manager_id: Optional[UUID] = None
    project_manager_name: Optional[str] = None

    # Settings overrides
    material_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    labor_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    equipment_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    subcontractor_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    rate_project_manager: Optional[Decimal] = Field(None, ge=0)
    rate_superintendent: Optional[Decimal] = Field(None, ge=0)
    rate_carpenter: Optional[Decimal] = Field(None, ge=0)
    rate_laborer: Optional[Decimal] = Field(None, ge=0)
    reminder_interval_days: Optional[int] = Field(None, ge=1, le=30)
    reminder_max_retries: Optional[int] = Field(None, ge=0, le=10)
    approval_token_expiration_hours: Optional[int] = Field(None, ge=1, le=720)

    is_active: Optional[bool] = None
    notes: Optional[str] = None


class ProjectResponse(ProjectBase):
    """Project response schema"""
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
