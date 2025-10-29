"""Line Items API endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.core.auth import get_current_user, TokenData
from app.core.config import settings
from app.models.tnm_ticket import TNMTicket
from app.models.labor_item import LaborItem, LaborType
from app.models.material_item import MaterialItem
from app.models.equipment_item import EquipmentItem
from app.models.subcontractor_item import SubcontractorItem
from app.schemas.line_items import (
    LaborItemCreate,
    LaborItemUpdate,
    LaborItemResponse,
    MaterialItemCreate,
    MaterialItemUpdate,
    MaterialItemResponse,
    EquipmentItemCreate,
    EquipmentItemUpdate,
    EquipmentItemResponse,
    SubcontractorItemCreate,
    SubcontractorItemUpdate,
    SubcontractorItemResponse,
)

router = APIRouter()


# ============ HELPER: RECALCULATE TICKET TOTALS ============

async def recalculate_ticket_totals(db: AsyncSession, ticket_id: UUID):
    """
    Recalculate all totals for a ticket after line item changes
    """
    # Fetch ticket with all items
    result = await db.execute(
        select(TNMTicket)
        .where(TNMTicket.id == ticket_id)
        .options(
            selectinload(TNMTicket.labor_items),
            selectinload(TNMTicket.material_items),
            selectinload(TNMTicket.equipment_items),
            selectinload(TNMTicket.subcontractor_items),
        )
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="TNM ticket not found")

    # Calculate labor subtotal and total hours
    ticket.labor_subtotal = sum(
        float(item.hours) * float(item.rate_per_hour)
        for item in ticket.labor_items
    )
    ticket.total_labor_hours = sum(
        float(item.hours)
        for item in ticket.labor_items
    )

    # Calculate material subtotal
    ticket.material_subtotal = sum(
        float(item.quantity) * float(item.unit_price)
        for item in ticket.material_items
    )

    # Calculate equipment subtotal
    ticket.equipment_subtotal = sum(
        float(item.quantity) * float(item.unit_price)
        for item in ticket.equipment_items
    )

    # Calculate subcontractor subtotal
    ticket.subcontractor_subtotal = sum(
        float(item.amount)
        for item in ticket.subcontractor_items
    )

    # Apply OH&P and calculate totals
    ticket.calculate_totals()

    await db.commit()
    await db.refresh(ticket)

    return ticket


# ============ LABOR ITEMS ============

@router.post("/labor", response_model=dict)
async def create_labor_item(
    item_data: LaborItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Add a labor line item to a TNM ticket"""
    # Validate labor type
    try:
        labor_type_enum = LaborType(item_data.labor_type)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid labor type. Must be one of: {', '.join([t.value for t in LaborType])}"
        )

    # Get rate based on labor type
    rate = settings.get_labor_rate(item_data.labor_type)

    item = LaborItem(
        tnm_ticket_id=item_data.tnm_ticket_id,
        description=item_data.description,
        hours=item_data.hours,
        labor_type=labor_type_enum,
        rate_per_hour=rate,
        line_order=item_data.line_order,
    )

    db.add(item)
    await db.flush()

    # Recalculate ticket totals
    ticket = await recalculate_ticket_totals(db, item_data.tnm_ticket_id)

    await db.refresh(item)

    return {
        "id": str(item.id),
        "description": item.description,
        "hours": float(item.hours),
        "labor_type": item.labor_type.value,
        "rate_per_hour": float(item.rate_per_hour),
        "subtotal": float(item.hours * item.rate_per_hour),
        "ticket_totals": {
            "labor_subtotal": float(ticket.labor_subtotal),
            "labor_total": float(ticket.labor_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }


@router.get("/labor/{item_id}", response_model=dict)
async def get_labor_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get a single labor item"""
    result = await db.execute(
        select(LaborItem).where(LaborItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Labor item not found")

    return {
        "id": str(item.id),
        "tnm_ticket_id": str(item.tnm_ticket_id),
        "description": item.description,
        "hours": float(item.hours),
        "labor_type": item.labor_type.value,
        "rate_per_hour": float(item.rate_per_hour),
        "subtotal": float(item.hours * item.rate_per_hour),
    }


@router.put("/labor/{item_id}", response_model=dict)
async def update_labor_item(
    item_id: UUID,
    item_data: LaborItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Update a labor line item"""
    result = await db.execute(
        select(LaborItem).where(LaborItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Labor item not found")

    # Update fields
    update_data = item_data.model_dump(exclude_unset=True)

    # If labor_type changed, update rate and validate
    if 'labor_type' in update_data:
        try:
            labor_type_enum = LaborType(update_data['labor_type'])
            update_data['labor_type'] = labor_type_enum
            update_data['rate_per_hour'] = settings.get_labor_rate(labor_type_enum.value)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid labor type. Must be one of: {', '.join([t.value for t in LaborType])}"
            )

    for field, value in update_data.items():
        setattr(item, field, value)

    # Recalculate totals
    ticket = await recalculate_ticket_totals(db, item.tnm_ticket_id)

    await db.refresh(item)

    return {
        "id": str(item.id),
        "description": item.description,
        "hours": float(item.hours),
        "labor_type": item.labor_type.value,
        "rate_per_hour": float(item.rate_per_hour),
        "subtotal": float(item.hours * item.rate_per_hour),
        "ticket_totals": {
            "labor_subtotal": float(ticket.labor_subtotal),
            "labor_total": float(ticket.labor_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }


@router.delete("/labor/{item_id}", response_model=dict)
async def delete_labor_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Delete a labor line item"""
    result = await db.execute(
        select(LaborItem).where(LaborItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Labor item not found")

    ticket_id = item.tnm_ticket_id

    await db.delete(item)

    # Recalculate totals
    ticket = await recalculate_ticket_totals(db, ticket_id)

    return {
        "success": True,
        "deleted_item_id": str(item_id),
        "ticket_totals": {
            "labor_subtotal": float(ticket.labor_subtotal),
            "labor_total": float(ticket.labor_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }


# ============ MATERIAL ITEMS ============

@router.post("/material", response_model=dict)
async def create_material_item(
    item_data: MaterialItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Add a material line item"""
    item = MaterialItem(
        tnm_ticket_id=item_data.tnm_ticket_id,
        description=item_data.description,
        quantity=item_data.quantity,
        unit=item_data.unit,
        unit_price=item_data.unit_price,
        line_order=item_data.line_order,
    )

    db.add(item)
    await db.flush()

    ticket = await recalculate_ticket_totals(db, item_data.tnm_ticket_id)
    await db.refresh(item)

    return {
        "id": str(item.id),
        "description": item.description,
        "quantity": float(item.quantity),
        "unit": item.unit,
        "unit_price": float(item.unit_price),
        "subtotal": float(item.quantity * item.unit_price),
        "ticket_totals": {
            "material_subtotal": float(ticket.material_subtotal),
            "material_total": float(ticket.material_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }


@router.get("/material/{item_id}", response_model=dict)
async def get_material_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get a single material item"""
    result = await db.execute(
        select(MaterialItem).where(MaterialItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Material item not found")

    return {
        "id": str(item.id),
        "tnm_ticket_id": str(item.tnm_ticket_id),
        "description": item.description,
        "quantity": float(item.quantity),
        "unit": item.unit,
        "unit_price": float(item.unit_price),
        "subtotal": float(item.quantity * item.unit_price),
    }


@router.put("/material/{item_id}", response_model=dict)
async def update_material_item(
    item_id: UUID,
    item_data: MaterialItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Update a material line item"""
    result = await db.execute(
        select(MaterialItem).where(MaterialItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Material item not found")

    # Update fields
    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    # Recalculate totals
    ticket = await recalculate_ticket_totals(db, item.tnm_ticket_id)

    await db.refresh(item)

    return {
        "id": str(item.id),
        "description": item.description,
        "quantity": float(item.quantity),
        "unit": item.unit,
        "unit_price": float(item.unit_price),
        "subtotal": float(item.quantity * item.unit_price),
        "ticket_totals": {
            "material_subtotal": float(ticket.material_subtotal),
            "material_total": float(ticket.material_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }


@router.delete("/material/{item_id}", response_model=dict)
async def delete_material_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Delete a material line item"""
    result = await db.execute(
        select(MaterialItem).where(MaterialItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Material item not found")

    ticket_id = item.tnm_ticket_id

    await db.delete(item)

    # Recalculate totals
    ticket = await recalculate_ticket_totals(db, ticket_id)

    return {
        "success": True,
        "deleted_item_id": str(item_id),
        "ticket_totals": {
            "material_subtotal": float(ticket.material_subtotal),
            "material_total": float(ticket.material_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }


# ============ EQUIPMENT ITEMS ============

@router.post("/equipment", response_model=dict)
async def create_equipment_item(
    item_data: EquipmentItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Add an equipment line item"""
    item = EquipmentItem(
        tnm_ticket_id=item_data.tnm_ticket_id,
        description=item_data.description,
        quantity=item_data.quantity,
        unit=item_data.unit,
        unit_price=item_data.unit_price,
        line_order=item_data.line_order,
    )

    db.add(item)
    await db.flush()

    ticket = await recalculate_ticket_totals(db, item_data.tnm_ticket_id)
    await db.refresh(item)

    return {
        "id": str(item.id),
        "description": item.description,
        "quantity": float(item.quantity),
        "unit": item.unit,
        "unit_price": float(item.unit_price),
        "subtotal": float(item.quantity * item.unit_price),
        "ticket_totals": {
            "equipment_subtotal": float(ticket.equipment_subtotal),
            "equipment_total": float(ticket.equipment_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }


@router.get("/equipment/{item_id}", response_model=dict)
async def get_equipment_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get a single equipment item"""
    result = await db.execute(
        select(EquipmentItem).where(EquipmentItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Equipment item not found")

    return {
        "id": str(item.id),
        "tnm_ticket_id": str(item.tnm_ticket_id),
        "description": item.description,
        "quantity": float(item.quantity),
        "unit": item.unit,
        "unit_price": float(item.unit_price),
        "subtotal": float(item.quantity * item.unit_price),
    }


@router.put("/equipment/{item_id}", response_model=dict)
async def update_equipment_item(
    item_id: UUID,
    item_data: EquipmentItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Update an equipment line item"""
    result = await db.execute(
        select(EquipmentItem).where(EquipmentItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Equipment item not found")

    # Update fields
    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    # Recalculate totals
    ticket = await recalculate_ticket_totals(db, item.tnm_ticket_id)

    await db.refresh(item)

    return {
        "id": str(item.id),
        "description": item.description,
        "quantity": float(item.quantity),
        "unit": item.unit,
        "unit_price": float(item.unit_price),
        "subtotal": float(item.quantity * item.unit_price),
        "ticket_totals": {
            "equipment_subtotal": float(ticket.equipment_subtotal),
            "equipment_total": float(ticket.equipment_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }


@router.delete("/equipment/{item_id}", response_model=dict)
async def delete_equipment_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Delete an equipment line item"""
    result = await db.execute(
        select(EquipmentItem).where(EquipmentItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Equipment item not found")

    ticket_id = item.tnm_ticket_id

    await db.delete(item)

    # Recalculate totals
    ticket = await recalculate_ticket_totals(db, ticket_id)

    return {
        "success": True,
        "deleted_item_id": str(item_id),
        "ticket_totals": {
            "equipment_subtotal": float(ticket.equipment_subtotal),
            "equipment_total": float(ticket.equipment_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }


# ============ SUBCONTRACTOR ITEMS ============

@router.post("/subcontractor", response_model=dict)
async def create_subcontractor_item(
    item_data: SubcontractorItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Add a subcontractor line item"""
    item = SubcontractorItem(
        tnm_ticket_id=item_data.tnm_ticket_id,
        description=item_data.description,
        subcontractor_name=item_data.subcontractor_name,
        proposal_date=item_data.proposal_date,
        amount=item_data.amount,
        line_order=item_data.line_order,
    )

    db.add(item)
    await db.flush()

    ticket = await recalculate_ticket_totals(db, item_data.tnm_ticket_id)
    await db.refresh(item)

    return {
        "id": str(item.id),
        "description": item.description,
        "subcontractor_name": item.subcontractor_name,
        "proposal_date": str(item.proposal_date) if item.proposal_date else None,
        "amount": float(item.amount),
        "ticket_totals": {
            "subcontractor_subtotal": float(ticket.subcontractor_subtotal),
            "subcontractor_total": float(ticket.subcontractor_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }


@router.get("/subcontractor/{item_id}", response_model=dict)
async def get_subcontractor_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get a single subcontractor item"""
    result = await db.execute(
        select(SubcontractorItem).where(SubcontractorItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Subcontractor item not found")

    return {
        "id": str(item.id),
        "tnm_ticket_id": str(item.tnm_ticket_id),
        "description": item.description,
        "subcontractor_name": item.subcontractor_name,
        "proposal_date": str(item.proposal_date) if item.proposal_date else None,
        "amount": float(item.amount),
    }


@router.put("/subcontractor/{item_id}", response_model=dict)
async def update_subcontractor_item(
    item_id: UUID,
    item_data: SubcontractorItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Update a subcontractor line item"""
    result = await db.execute(
        select(SubcontractorItem).where(SubcontractorItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Subcontractor item not found")

    # Update fields
    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    # Recalculate totals
    ticket = await recalculate_ticket_totals(db, item.tnm_ticket_id)

    await db.refresh(item)

    return {
        "id": str(item.id),
        "description": item.description,
        "subcontractor_name": item.subcontractor_name,
        "proposal_date": str(item.proposal_date) if item.proposal_date else None,
        "amount": float(item.amount),
        "ticket_totals": {
            "subcontractor_subtotal": float(ticket.subcontractor_subtotal),
            "subcontractor_total": float(ticket.subcontractor_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }


@router.delete("/subcontractor/{item_id}", response_model=dict)
async def delete_subcontractor_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Delete a subcontractor line item"""
    result = await db.execute(
        select(SubcontractorItem).where(SubcontractorItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Subcontractor item not found")

    ticket_id = item.tnm_ticket_id

    await db.delete(item)

    # Recalculate totals
    ticket = await recalculate_ticket_totals(db, ticket_id)

    return {
        "success": True,
        "deleted_item_id": str(item_id),
        "ticket_totals": {
            "subcontractor_subtotal": float(ticket.subcontractor_subtotal),
            "subcontractor_total": float(ticket.subcontractor_total),
            "proposal_amount": float(ticket.proposal_amount),
        }
    }
