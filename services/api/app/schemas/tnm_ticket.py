"""TNM Ticket schemas"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ============ LINE ITEM SCHEMAS ============

class LaborItemBase(BaseModel):
    """Base labor item schema"""
    description: str
    hours: Decimal = Field(..., ge=0)
    labor_type: str  # 'project_manager', 'superintendent', 'carpenter', 'laborer'
    rate_per_hour: Decimal = Field(..., ge=0)
    line_order: int = 0


class LaborItemCreate(LaborItemBase):
    """Create labor item schema"""
    pass


class LaborItemResponse(LaborItemBase):
    """Labor item response schema"""
    id: UUID
    tnm_ticket_id: UUID
    subtotal: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MaterialItemBase(BaseModel):
    """Base material item schema"""
    description: str
    quantity: Decimal = Field(..., ge=0)
    unit: Optional[str] = None
    unit_price: Decimal = Field(..., ge=0)
    line_order: int = 0


class MaterialItemCreate(MaterialItemBase):
    """Create material item schema"""
    pass


class MaterialItemResponse(MaterialItemBase):
    """Material item response schema"""
    id: UUID
    tnm_ticket_id: UUID
    subtotal: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EquipmentItemBase(BaseModel):
    """Base equipment item schema"""
    description: str
    quantity: Decimal = Field(..., ge=0)
    unit: Optional[str] = None
    unit_price: Decimal = Field(..., ge=0)
    line_order: int = 0


class EquipmentItemCreate(EquipmentItemBase):
    """Create equipment item schema"""
    pass


class EquipmentItemResponse(EquipmentItemBase):
    """Equipment item response schema"""
    id: UUID
    tnm_ticket_id: UUID
    subtotal: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubcontractorItemBase(BaseModel):
    """Base subcontractor item schema"""
    description: str
    subcontractor_name: Optional[str] = None
    proposal_date: Optional[date] = None
    amount: Decimal = Field(..., ge=0)
    line_order: int = 0


class SubcontractorItemCreate(SubcontractorItemBase):
    """Create subcontractor item schema"""
    pass


class SubcontractorItemResponse(SubcontractorItemBase):
    """Subcontractor item response schema"""
    id: UUID
    tnm_ticket_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ TNM TICKET SCHEMAS ============

class TNMTicketBase(BaseModel):
    """Base TNM ticket schema"""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    submitter_name: str
    submitter_email: EmailStr
    proposal_date: date


class TNMTicketCreate(TNMTicketBase):
    """Create TNM ticket schema"""
    project_id: UUID

    # Line items
    labor_items: List[LaborItemCreate] = []
    material_items: List[MaterialItemCreate] = []
    equipment_items: List[EquipmentItemCreate] = []
    subcontractor_items: List[SubcontractorItemCreate] = []


class TNMTicketUpdate(BaseModel):
    """Update TNM ticket schema"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None
    labor_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    material_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    equipment_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    subcontractor_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    response_date: Optional[date] = None
    notes: Optional[str] = None


class TNMTicketResponse(TNMTicketBase):
    """TNM ticket response schema"""
    id: UUID
    tnm_number: str
    rfco_number: Optional[str]
    project_id: UUID
    project_number: str
    submitter_id: Optional[UUID]
    status: str

    # Calculated totals
    labor_subtotal: Decimal
    labor_ohp_percent: Decimal
    labor_total: Decimal

    material_subtotal: Decimal
    material_ohp_percent: Decimal
    material_total: Decimal

    equipment_subtotal: Decimal
    equipment_ohp_percent: Decimal
    equipment_total: Decimal

    subcontractor_subtotal: Decimal
    subcontractor_ohp_percent: Decimal
    subcontractor_total: Decimal

    proposal_amount: Decimal
    approved_amount: Decimal

    # Line items (optional, loaded separately)
    labor_items: List[LaborItemResponse] = []
    material_items: List[MaterialItemResponse] = []
    equipment_items: List[EquipmentItemResponse] = []
    subcontractor_items: List[SubcontractorItemResponse] = []

    # Metadata
    email_sent_count: int
    reminder_count: int
    viewed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ SEND RFCO SCHEMAS ============

class SendRFCORequest(BaseModel):
    """Request schema for sending RFCO to GC"""
    gc_email: EmailStr
    gc_name: Optional[str] = None
    message: Optional[str] = None


class SendRFCOResponse(BaseModel):
    """Response schema for send RFCO endpoint"""
    success: bool
    tnm_ticket_id: str
    tnm_number: str
    status: str
    approval_token: str
    approval_link: str
    sent_at: datetime
    email_log_id: str
