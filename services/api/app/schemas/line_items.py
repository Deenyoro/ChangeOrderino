"""Line Item Schemas"""
from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional
from uuid import UUID
from datetime import date


# ============ LABOR ITEMS ============

class LaborItemCreate(BaseModel):
    tnm_ticket_id: UUID
    description: str
    hours: Decimal = Field(..., gt=0)
    labor_type: str  # 'project_manager', 'superintendent', 'carpenter', 'laborer'
    line_order: int = 0


class LaborItemUpdate(BaseModel):
    description: Optional[str] = None
    hours: Optional[Decimal] = Field(None, gt=0)
    labor_type: Optional[str] = None
    line_order: Optional[int] = None


class LaborItemResponse(BaseModel):
    id: UUID
    tnm_ticket_id: UUID
    description: str
    hours: Decimal
    labor_type: str
    rate_per_hour: Decimal
    subtotal: Decimal
    line_order: int

    class Config:
        from_attributes = True


# ============ MATERIAL ITEMS ============

class MaterialItemCreate(BaseModel):
    tnm_ticket_id: UUID
    description: str
    quantity: Decimal = Field(..., gt=0)
    unit: Optional[str] = None
    unit_price: Decimal = Field(..., ge=0)
    line_order: int = 0


class MaterialItemUpdate(BaseModel):
    description: Optional[str] = None
    quantity: Optional[Decimal] = Field(None, gt=0)
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = Field(None, ge=0)
    line_order: Optional[int] = None


class MaterialItemResponse(BaseModel):
    id: UUID
    tnm_ticket_id: UUID
    description: str
    quantity: Decimal
    unit: Optional[str] = None
    unit_price: Decimal
    subtotal: Decimal
    line_order: int

    class Config:
        from_attributes = True


# ============ EQUIPMENT ITEMS ============

class EquipmentItemCreate(BaseModel):
    tnm_ticket_id: UUID
    description: str
    quantity: Decimal = Field(..., gt=0)
    unit: Optional[str] = None
    unit_price: Decimal = Field(..., ge=0)
    line_order: int = 0


class EquipmentItemUpdate(BaseModel):
    description: Optional[str] = None
    quantity: Optional[Decimal] = Field(None, gt=0)
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = Field(None, ge=0)
    line_order: Optional[int] = None


class EquipmentItemResponse(BaseModel):
    id: UUID
    tnm_ticket_id: UUID
    description: str
    quantity: Decimal
    unit: Optional[str] = None
    unit_price: Decimal
    subtotal: Decimal
    line_order: int

    class Config:
        from_attributes = True


# ============ SUBCONTRACTOR ITEMS ============

class SubcontractorItemCreate(BaseModel):
    tnm_ticket_id: UUID
    description: str
    subcontractor_name: Optional[str] = None
    proposal_date: Optional[date] = None
    amount: Decimal = Field(..., ge=0)
    line_order: int = 0


class SubcontractorItemUpdate(BaseModel):
    description: Optional[str] = None
    subcontractor_name: Optional[str] = None
    proposal_date: Optional[date] = None
    amount: Optional[Decimal] = Field(None, ge=0)
    line_order: Optional[int] = None


class SubcontractorItemResponse(BaseModel):
    id: UUID
    tnm_ticket_id: UUID
    description: str
    subcontractor_name: Optional[str] = None
    proposal_date: Optional[date] = None
    amount: Decimal
    line_order: int

    class Config:
        from_attributes = True
