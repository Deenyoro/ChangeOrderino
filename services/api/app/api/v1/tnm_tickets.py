"""TNM Ticket endpoints"""
import logging
from typing import List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user, TokenData, create_approval_token
from app.core.config import settings
from app.models.tnm_ticket import TNMTicket, TNMStatus
from app.models.project import Project
from app.models.labor_item import LaborItem
from app.models.material_item import MaterialItem
from app.models.equipment_item import EquipmentItem
from app.models.subcontractor_item import SubcontractorItem
from app.models.email_log import EmailLog
from app.schemas.tnm_ticket import (
    TNMTicketCreate,
    TNMTicketUpdate,
    TNMTicketResponse,
    SendRFCORequest,
    SendRFCOResponse,
    ManualApprovalRequest,
)
from app.services.pdf_generator import pdf_generator
from app.services.queue_service import queue_service
from app.services.audit_service import audit_service

logger = logging.getLogger(__name__)
router = APIRouter()


async def generate_tnm_number(db: AsyncSession, project_id: UUID) -> str:
    """Generate unique TNM number for a project"""
    # Get project
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Count existing TNM tickets for this project
    count_result = await db.execute(
        select(func.count(TNMTicket.id)).where(TNMTicket.project_id == project_id)
    )
    count = count_result.scalar() or 0

    # Generate number: PROJECT_NUMBER-TNM-001
    tnm_number = f"{project.project_number}-TNM-{str(count + 1).zfill(3)}"

    return tnm_number


@router.get("/", response_model=List[TNMTicketResponse])
async def list_tnm_tickets(
    skip: int = 0,
    limit: int = 100,
    project_id: UUID | None = None,
    status: TNMStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List all TNM tickets with filters"""
    query = select(TNMTicket).options(
        selectinload(TNMTicket.labor_items),
        selectinload(TNMTicket.material_items),
        selectinload(TNMTicket.equipment_items),
        selectinload(TNMTicket.subcontractor_items),
    )

    if project_id:
        query = query.where(TNMTicket.project_id == project_id)

    if status:
        query = query.where(TNMTicket.status == status)

    query = query.offset(skip).limit(limit).order_by(TNMTicket.created_at.desc())

    result = await db.execute(query)
    tickets = result.scalars().all()

    return tickets


@router.post("/", response_model=TNMTicketResponse, status_code=status.HTTP_201_CREATED)
async def create_tnm_ticket(
    ticket_data: TNMTicketCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Create a new TNM ticket with line items"""
    # Get project
    result = await db.execute(select(Project).where(Project.id == ticket_data.project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Generate TNM number
    tnm_number = await generate_tnm_number(db, ticket_data.project_id)

    # Create TNM ticket
    ticket = TNMTicket(
        tnm_number=tnm_number,
        project_id=ticket_data.project_id,
        project_number=project.project_number,
        title=ticket_data.title,
        description=ticket_data.description,
        submitter_name=ticket_data.submitter_name,
        submitter_email=ticket_data.submitter_email,
        submitter_id=UUID(current_user.sub) if current_user.sub else None,
        proposal_date=ticket_data.proposal_date,
        # Copy OH&P from project defaults
        labor_ohp_percent=project.labor_ohp_percent,
        material_ohp_percent=project.material_ohp_percent,
        equipment_ohp_percent=project.equipment_ohp_percent,
        subcontractor_ohp_percent=project.subcontractor_ohp_percent,
    )

    db.add(ticket)
    await db.flush()  # Get ticket ID

    # Add labor items
    labor_subtotal = Decimal('0')
    for item_data in ticket_data.labor_items:
        # Get rate from settings based on labor type
        rate = settings.get_labor_rate(item_data.labor_type)
        item = LaborItem(
            tnm_ticket_id=ticket.id,
            **item_data.model_dump(exclude={'rate_per_hour'}),
            rate_per_hour=rate
        )
        db.add(item)
        labor_subtotal += Decimal(str(item_data.hours)) * Decimal(str(rate))

    ticket.labor_subtotal = labor_subtotal

    # Add material items
    material_subtotal = sum(
        Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
        for item in ticket_data.material_items
    ) if ticket_data.material_items else Decimal('0')
    for item_data in ticket_data.material_items:
        item = MaterialItem(tnm_ticket_id=ticket.id, **item_data.model_dump())
        db.add(item)

    ticket.material_subtotal = material_subtotal

    # Add equipment items
    equipment_subtotal = sum(
        Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
        for item in ticket_data.equipment_items
    ) if ticket_data.equipment_items else Decimal('0')
    for item_data in ticket_data.equipment_items:
        item = EquipmentItem(tnm_ticket_id=ticket.id, **item_data.model_dump())
        db.add(item)

    ticket.equipment_subtotal = equipment_subtotal

    # Add subcontractor items
    subcontractor_subtotal = sum(
        Decimal(str(item.amount)) for item in ticket_data.subcontractor_items
    ) if ticket_data.subcontractor_items else Decimal('0')
    for item_data in ticket_data.subcontractor_items:
        item = SubcontractorItem(tnm_ticket_id=ticket.id, **item_data.model_dump())
        db.add(item)

    ticket.subcontractor_subtotal = subcontractor_subtotal

    # Calculate totals with OH&P
    ticket.calculate_totals()

    # Log creation
    await audit_service.log(
        db=db,
        entity_type='tnm_ticket',
        entity_id=ticket.id,
        action='create',
        user_id=UUID(current_user.sub),
        changes={
            'title': ticket.title,
            'tnm_number': ticket.tnm_number,
            'project_id': str(ticket.project_id),
            'proposal_amount': str(ticket.proposal_amount),
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    await db.commit()
    await db.refresh(ticket)

    # Load relationships
    await db.refresh(ticket, ["labor_items", "material_items", "equipment_items", "subcontractor_items"])

    return ticket


@router.get("/{ticket_id}", response_model=TNMTicketResponse)
async def get_tnm_ticket(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get a single TNM ticket with all line items"""
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

    return ticket


@router.put("/{ticket_id}", response_model=TNMTicketResponse)
async def update_tnm_ticket(
    ticket_id: UUID,
    ticket_data: TNMTicketUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Update a TNM ticket"""
    result = await db.execute(
        select(TNMTicket).where(TNMTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="TNM ticket not found")

    # Compute changes
    update_data = ticket_data.model_dump(exclude_unset=True)
    changes = audit_service.compute_changes(ticket, update_data)

    # Update fields
    for field, value in update_data.items():
        setattr(ticket, field, value)

    # Recalculate totals if OH&P changed
    if any(field.endswith('_ohp_percent') for field in update_data):
        ticket.calculate_totals()

    # Log update
    await audit_service.log(
        db=db,
        entity_type='tnm_ticket',
        entity_id=ticket_id,
        action='update',
        user_id=UUID(current_user.sub),
        changes=changes,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    await db.commit()
    await db.refresh(ticket)

    return ticket


@router.get("/{ticket_id}/pdf")
async def get_tnm_pdf(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Generate PDF for TNM ticket"""
    # Fetch ticket with all relationships
    result = await db.execute(
        select(TNMTicket)
        .where(TNMTicket.id == ticket_id)
        .options(
            selectinload(TNMTicket.project),
            selectinload(TNMTicket.labor_items),
            selectinload(TNMTicket.material_items),
            selectinload(TNMTicket.equipment_items),
            selectinload(TNMTicket.subcontractor_items),
        )
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="TNM ticket not found")

    # Convert to dict for template
    ticket_data = {
        'tnm_number': ticket.tnm_number,
        'rfco_number': ticket.rfco_number,
        'title': ticket.title,
        'description': ticket.description,
        'proposal_date': ticket.proposal_date,
        'submitter_name': ticket.submitter_name,
        'submitter_email': ticket.submitter_email,
        'notes': ticket.notes,
        'labor_items': [
            {
                'description': item.description,
                'hours': item.hours,
                'labor_type': item.labor_type.value if hasattr(item.labor_type, 'value') else str(item.labor_type),
                'rate_per_hour': item.rate_per_hour,
                'subtotal': item.subtotal,
            }
            for item in ticket.labor_items
        ],
        'material_items': [
            {
                'description': item.description,
                'quantity': item.quantity,
                'unit': item.unit,
                'unit_price': item.unit_price,
                'subtotal': item.subtotal,
            }
            for item in ticket.material_items
        ],
        'equipment_items': [
            {
                'description': item.description,
                'quantity': item.quantity,
                'unit': item.unit,
                'unit_price': item.unit_price,
                'subtotal': item.subtotal,
            }
            for item in ticket.equipment_items
        ],
        'subcontractor_items': [
            {
                'description': item.description,
                'subcontractor_name': item.subcontractor_name,
                'proposal_date': item.proposal_date,
                'amount': item.amount,
            }
            for item in ticket.subcontractor_items
        ],
        'labor_subtotal': ticket.labor_subtotal,
        'labor_ohp_percent': ticket.labor_ohp_percent,
        'labor_total': ticket.labor_total,
        'material_subtotal': ticket.material_subtotal,
        'material_ohp_percent': ticket.material_ohp_percent,
        'material_total': ticket.material_total,
        'equipment_subtotal': ticket.equipment_subtotal,
        'equipment_ohp_percent': ticket.equipment_ohp_percent,
        'equipment_total': ticket.equipment_total,
        'subcontractor_subtotal': ticket.subcontractor_subtotal,
        'subcontractor_ohp_percent': ticket.subcontractor_ohp_percent,
        'subcontractor_total': ticket.subcontractor_total,
        'proposal_amount': ticket.proposal_amount,
    }

    project_data = {
        'name': ticket.project.name,
        'project_number': ticket.project.project_number,
    }

    # Generate PDF
    pdf_content = pdf_generator.generate_rfco_pdf(ticket_data, project_data)

    # Return as download
    filename = f"RFCO-{ticket.tnm_number}.pdf"
    return Response(
        content=pdf_content,
        media_type='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    )


@router.post("/{ticket_id}/send", response_model=SendRFCOResponse)
async def send_rfco(
    ticket_id: UUID,
    request_data: SendRFCORequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Send RFCO to General Contractor

    This endpoint:
    - Generates JWT approval token (7-day expiration)
    - Updates ticket status to 'sent'
    - Records send metadata (email_sent_count, last_email_sent_at)
    - Creates email log entry
    - Queues email job in Redis for email-service worker
    - Logs audit trail
    """
    # Fetch ticket
    result = await db.execute(
        select(TNMTicket)
        .where(TNMTicket.id == ticket_id)
        .options(selectinload(TNMTicket.project))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="TNM ticket not found")

    # Verify ticket is ready to send
    if ticket.status not in [TNMStatus.ready_to_send, TNMStatus.pending_review]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot send ticket with status '{ticket.status.value}'. Must be 'ready_to_send' or 'pending_review'."
        )

    # Generate approval token
    token, expiration = create_approval_token(str(ticket_id))

    # Update ticket
    old_status = ticket.status
    ticket.status = TNMStatus.sent
    ticket.approval_token = token
    ticket.approval_token_expires_at = expiration
    ticket.email_sent_count += 1
    ticket.last_email_sent_at = datetime.utcnow()

    # Update project GC email if provided
    if request_data.gc_email and ticket.project:
        ticket.project.gc_email = request_data.gc_email
        if request_data.gc_name:
            ticket.project.gc_contact_name = request_data.gc_name

    # Create email log entry
    email_log = EmailLog(
        tnm_ticket_id=ticket_id,
        to_email=request_data.gc_email,
        from_email=settings.SMTP_FROM_EMAIL,
        subject=f"RFCO {ticket.tnm_number} - {ticket.project.name}",
        body_text=f"Request for Change Order: {ticket.title}",
        email_type='initial_send',
        status='queued',
    )
    db.add(email_log)

    # Log send action
    await audit_service.log(
        db=db,
        entity_type='tnm_ticket',
        entity_id=ticket_id,
        action='send',
        user_id=UUID(current_user.sub),
        changes={
            'status': {'old': old_status.value, 'new': 'sent'},
            'sent_to': request_data.gc_email,
            'email_sent_count': {'old': str(ticket.email_sent_count - 1), 'new': str(ticket.email_sent_count)},
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    # Commit database changes before queuing email job
    await db.commit()
    await db.refresh(ticket)

    # Queue email job in Redis for email-service worker to process
    job_id = queue_service.enqueue_rfco_email(
        tnm_ticket_id=str(ticket_id),
        to_email=request_data.gc_email,
        approval_token=token,
        retry_count=0
    )

    if not job_id:
        logger.error(f"Failed to enqueue RFCO email for ticket {ticket_id}")
        # Don't fail the request - ticket is already marked as sent
        # The email can be retried later if needed
    else:
        logger.info(f"Successfully enqueued RFCO email job {job_id} for ticket {ticket.tnm_number}")

    # Build approval link
    approval_link = f"https://changeorderino.com/approval/{token}"

    return SendRFCOResponse(
        success=True,
        tnm_ticket_id=str(ticket_id),
        tnm_number=ticket.tnm_number,
        status=ticket.status.value,
        approval_token=token,
        approval_link=approval_link,
        sent_at=ticket.last_email_sent_at,
        email_log_id=str(email_log.id),
    )


@router.post("/{ticket_id}/remind", response_model=SendRFCOResponse)
async def send_reminder(
    ticket_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Send reminder email for RFCO

    Manually trigger a reminder email to the GC.
    Can be used at any time after initial send.
    """
    # Fetch ticket
    result = await db.execute(
        select(TNMTicket)
        .where(TNMTicket.id == ticket_id)
        .options(selectinload(TNMTicket.project))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="TNM ticket not found")

    # Verify ticket has been sent at least once
    if ticket.status not in [TNMStatus.sent, TNMStatus.viewed, TNMStatus.partially_approved]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot send reminder for ticket with status '{ticket.status.value}'. Must be sent first."
        )

    # Verify we have approval token
    if not ticket.approval_token:
        raise HTTPException(
            status_code=400,
            detail="No approval token found. Please send the RFCO first."
        )

    # Get GC email from project
    if not ticket.project or not ticket.project.gc_email:
        raise HTTPException(
            status_code=400,
            detail="No GC email on file. Please update project settings."
        )

    # Update reminder tracking
    ticket.reminder_count += 1
    ticket.last_reminder_sent_at = datetime.utcnow()

    # Create email log entry
    email_log = EmailLog(
        tnm_ticket_id=ticket_id,
        to_email=ticket.project.gc_email,
        from_email=settings.SMTP_FROM_EMAIL,
        subject=f"REMINDER: RFCO {ticket.tnm_number} - {ticket.project.name}",
        body_text=f"Reminder: Request for Change Order: {ticket.title}",
        email_type='reminder',
        status='queued',
    )
    db.add(email_log)

    # Log reminder action
    await audit_service.log(
        db=db,
        entity_type='tnm_ticket',
        entity_id=ticket_id,
        action='send_reminder',
        user_id=UUID(current_user.sub),
        changes={
            'reminder_count': {'old': str(ticket.reminder_count - 1), 'new': str(ticket.reminder_count)},
            'sent_to': ticket.project.gc_email,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    # Commit before queuing
    await db.commit()
    await db.refresh(ticket)

    # Queue reminder email
    job_id = queue_service.enqueue_rfco_email(
        tnm_ticket_id=str(ticket_id),
        to_email=ticket.project.gc_email,
        approval_token=ticket.approval_token,
        retry_count=ticket.reminder_count
    )

    if not job_id:
        logger.error(f"Failed to enqueue reminder email for ticket {ticket_id}")
    else:
        logger.info(f"Successfully enqueued reminder email job {job_id} for ticket {ticket.tnm_number}")

    # Build approval link
    approval_link = f"https://changeorderino.com/approval/{ticket.approval_token}"

    return SendRFCOResponse(
        success=True,
        tnm_ticket_id=str(ticket_id),
        tnm_number=ticket.tnm_number,
        status=ticket.status.value,
        approval_token=ticket.approval_token,
        approval_link=approval_link,
        sent_at=ticket.last_reminder_sent_at,
        email_log_id=str(email_log.id),
    )


@router.patch("/{ticket_id}/manual-approval")
async def manual_approval_override(
    ticket_id: UUID,
    approval_data: ManualApprovalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Manually override approval status

    Allows admin to force approve/deny a ticket based on
    offline communication (phone, email, etc.)
    """
    # Fetch ticket
    result = await db.execute(
        select(TNMTicket).where(TNMTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="TNM ticket not found")

    # Store old status
    old_status = ticket.status

    # Update status
    if approval_data.status == 'approved':
        ticket.status = TNMStatus.approved
        ticket.approved_amount = approval_data.approved_amount or ticket.proposal_amount
    elif approval_data.status == 'denied':
        ticket.status = TNMStatus.denied
        ticket.approved_amount = 0
    elif approval_data.status == 'partially_approved':
        ticket.status = TNMStatus.partially_approved
        if approval_data.approved_amount is None:
            raise HTTPException(
                status_code=400,
                detail="approved_amount is required for partial approval"
            )
        ticket.approved_amount = approval_data.approved_amount
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status: {approval_data.status}"
        )

    # Update response date if not already set
    if not ticket.response_date:
        ticket.response_date = datetime.utcnow().date()

    # Update notes
    if approval_data.notes:
        if ticket.notes:
            ticket.notes += f"\n\n[Manual Override by {current_user.email}]: {approval_data.notes}"
        else:
            ticket.notes = f"[Manual Override by {current_user.email}]: {approval_data.notes}"

    # Log manual override
    await audit_service.log(
        db=db,
        entity_type='tnm_ticket',
        entity_id=ticket_id,
        action='manual_approval_override',
        user_id=UUID(current_user.sub),
        changes={
            'status': {'old': old_status.value, 'new': ticket.status.value},
            'approved_amount': {'old': '0', 'new': str(ticket.approved_amount)},
            'override_reason': approval_data.reason or 'No reason provided',
            'notes': approval_data.notes or '',
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    await db.commit()
    await db.refresh(ticket)

    logger.info(
        f"Manual approval override for ticket {ticket.tnm_number}: "
        f"{old_status.value} → {ticket.status.value} by {current_user.email}"
    )

    return {
        "success": True,
        "ticket_id": str(ticket_id),
        "tnm_number": ticket.tnm_number,
        "old_status": old_status.value,
        "new_status": ticket.status.value,
        "approved_amount": float(ticket.approved_amount),
        "response_date": ticket.response_date.isoformat() if ticket.response_date else None,
    }
