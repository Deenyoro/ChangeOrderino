"""TNM Ticket schemas"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator


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
    due_date: Optional[date] = None
    send_reminders_until_accepted: bool = False
    send_reminders_until_paid: bool = False

    @field_validator('due_date')
    @classmethod
    def validate_due_date(cls, v: Optional[date], info) -> Optional[date]:
        """Validate that due_date is not before proposal_date"""
        if v is not None and 'proposal_date' in info.data:
            proposal_date = info.data['proposal_date']
            if v < proposal_date:
                raise ValueError('Due date cannot be before proposal date')
        return v


class TNMTicketCreate(TNMTicketBase):
    """Create TNM ticket schema"""
    project_id: UUID

    # Line items
    labor_items: List[LaborItemCreate] = []
    material_items: List[MaterialItemCreate] = []
    equipment_items: List[EquipmentItemCreate] = []
    subcontractor_items: List[SubcontractorItemCreate] = []

    # Attachments
    signature_url: Optional[str] = None
    photo_urls: Optional[List[str]] = None
    notes: Optional[str] = None


class TNMTicketUpdate(BaseModel):
    """Update TNM ticket schema"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None

    # Settings overrides
    labor_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    material_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    equipment_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    subcontractor_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    rate_project_manager: Optional[Decimal] = Field(None, ge=0)
    rate_superintendent: Optional[Decimal] = Field(None, ge=0)
    rate_carpenter: Optional[Decimal] = Field(None, ge=0)
    rate_laborer: Optional[Decimal] = Field(None, ge=0)

    response_date: Optional[date] = None
    due_date: Optional[date] = None
    send_reminders_until_accepted: Optional[bool] = None
    send_reminders_until_paid: Optional[bool] = None
    notes: Optional[str] = None

    # Line items (optional - only update if provided)
    labor_items: Optional[List[LaborItemCreate]] = None
    material_items: Optional[List[MaterialItemCreate]] = None
    equipment_items: Optional[List[EquipmentItemCreate]] = None
    subcontractor_items: Optional[List[SubcontractorItemCreate]] = None

    # Attachments
    signature_url: Optional[str] = None
    photo_urls: Optional[List[str]] = None


class TNMTicketResponse(TNMTicketBase):
    """TNM ticket response schema"""
    id: UUID
    tnm_number: str
    rfco_number: Optional[str]
    project_id: UUID
    project_number: str
    submitter_id: Optional[UUID]
    status: str

    # Settings overrides (can be null if using project/global defaults)
    labor_ohp_percent: Optional[Decimal]
    material_ohp_percent: Optional[Decimal]
    equipment_ohp_percent: Optional[Decimal]
    subcontractor_ohp_percent: Optional[Decimal]
    rate_project_manager: Optional[Decimal]
    rate_superintendent: Optional[Decimal]
    rate_carpenter: Optional[Decimal]
    rate_laborer: Optional[Decimal]

    # Calculated totals
    labor_subtotal: Decimal
    labor_total: Decimal
    total_labor_hours: Decimal

    material_subtotal: Decimal
    material_total: Decimal

    equipment_subtotal: Decimal
    equipment_total: Decimal

    subcontractor_subtotal: Decimal
    subcontractor_total: Decimal

    proposal_amount: Decimal
    approved_amount: Decimal

    # Line items (optional, loaded separately)
    labor_items: List[LaborItemResponse] = []
    material_items: List[MaterialItemResponse] = []
    equipment_items: List[EquipmentItemResponse] = []
    subcontractor_items: List[SubcontractorItemResponse] = []

    # Attachments
    signature_url: Optional[str] = None
    gc_signature_url: Optional[str] = None
    photo_urls: Optional[List[str]] = None
    notes: Optional[str] = None

    # Metadata
    email_sent_count: int
    reminder_count: int
    viewed_at: Optional[datetime]
    send_reminders_until_accepted: bool
    send_reminders_until_paid: bool

    # Payment tracking
    is_paid: int = 0
    paid_date: Optional[datetime] = None
    paid_by: Optional[UUID] = None

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


# ============ MANUAL APPROVAL SCHEMAS ============

class ManualApprovalRequest(BaseModel):
    """Request schema for manual approval override"""
    status: str = Field(..., pattern='^(approved|denied|partially_approved|sent)$')
    approved_amount: Optional[Decimal] = Field(None, ge=0)
    reason: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None


class MarkAsPaidRequest(BaseModel):
    """Request schema for marking ticket as paid"""
    is_paid: bool = True
    notes: Optional[str] = None


# ============ BULK ACTION SCHEMAS ============

class BulkApprovalRequest(BaseModel):
    """Request schema for bulk manual approval"""
    ticket_ids: List[UUID] = Field(..., min_length=1)
    status: str = Field(..., pattern='^(approved|denied|partially_approved|sent)$')
    approved_amount: Optional[Decimal] = Field(None, ge=0)
    reason: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None


class BulkMarkAsPaidRequest(BaseModel):
    """Request schema for bulk marking tickets as paid"""
    ticket_ids: List[UUID] = Field(..., min_length=1)
    is_paid: bool = True
    notes: Optional[str] = None


class BulkActionResult(BaseModel):
    """Result for a single ticket in a bulk action"""
    ticket_id: str
    tnm_number: str
    success: bool
    error: Optional[str] = None


class BulkActionResponse(BaseModel):
    """Response schema for bulk actions"""
    total: int
    successful: int
    failed: int
    results: List[BulkActionResult]


# ============ EDIT SCHEMAS ============

class TNMTicketEditRequest(BaseModel):
    """Request schema for editing TNM ticket fields"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    submitter_name: Optional[str] = Field(None, min_length=1, max_length=255)
    submitter_email: Optional[EmailStr] = None
    proposal_date: Optional[date] = None
    response_date: Optional[date] = None
    due_date: Optional[date] = None

    # OH&P overrides
    material_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    labor_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    equipment_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    subcontractor_ohp_percent: Optional[Decimal] = Field(None, ge=0, le=100)

    # Labor rate overrides
    rate_project_manager: Optional[Decimal] = Field(None, ge=0)
    rate_superintendent: Optional[Decimal] = Field(None, ge=0)
    rate_carpenter: Optional[Decimal] = Field(None, ge=0)
    rate_laborer: Optional[Decimal] = Field(None, ge=0)

    # Signature (base64 data URL or existing URL)
    signature_url: Optional[str] = None

    notes: Optional[str] = None
    edit_reason: Optional[str] = Field(None, max_length=500)
