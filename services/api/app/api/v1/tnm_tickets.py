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
    MarkAsPaidRequest,
    BulkApprovalRequest,
    BulkMarkAsPaidRequest,
    BulkActionResponse,
    BulkActionResult,
)
from app.services.pdf_generator import pdf_generator
from app.services.queue_service import queue_service
from app.services.audit_service import audit_service
from app.utils.pdf_helpers import prepare_ticket_data_for_pdf, prepare_project_data_for_pdf

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


# ============ SPECIFIC ROUTES (must come before generic /{ticket_id}/) ============

@router.get("/number/{tnm_number}/", response_model=TNMTicketResponse)
async def get_tnm_ticket_by_number(
    tnm_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get a TNM ticket by its TNM number"""
    result = await db.execute(
        select(TNMTicket)
        .where(TNMTicket.tnm_number == tnm_number)
        .options(
            selectinload(TNMTicket.labor_items),
            selectinload(TNMTicket.material_items),
            selectinload(TNMTicket.equipment_items),
            selectinload(TNMTicket.subcontractor_items),
        )
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail=f"TNM ticket {tnm_number} not found")

    return ticket


# NOTE: All /{ticket_id}/xxx/ specific routes are defined later in the file
# They must stay after the /number/ route but their current position works
# because FastAPI matches the most specific path first

# ============ GENERIC ROUTES (for /{ticket_id}/) ============

@router.get("/{ticket_id}/", response_model=TNMTicketResponse)
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


@router.put("/{ticket_id}/", response_model=TNMTicketResponse)
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


@router.delete("/{ticket_id}/")
async def delete_tnm_ticket(
    ticket_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Delete a TNM ticket"""
    result = await db.execute(
        select(TNMTicket).where(TNMTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="TNM ticket not found")

    # Log deletion before deleting
    await audit_service.log(
        db=db,
        entity_type='tnm_ticket',
        entity_id=ticket_id,
        action='delete',
        user_id=UUID(current_user.sub),
        changes={
            'tnm_number': ticket.tnm_number,
            'title': ticket.title,
            'status': ticket.status.value,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    # Delete the ticket (cascade will delete line items)
    await db.delete(ticket)
    await db.commit()

    logger.info(f"Deleted TNM ticket {ticket.tnm_number} by {current_user.email}")

    return {"success": True, "message": f"TNM ticket {ticket.tnm_number} deleted"}


@router.get("/{ticket_id}/pdf/")
async def get_tnm_pdf(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Generate PDF for TNM ticket"""
    try:
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

        if not ticket.project:
            raise HTTPException(status_code=404, detail="Project not found for this ticket")

        logger.info(f"Generating PDF for TNM ticket {ticket.tnm_number}")

        # Fetch settings from database
        from app.models.app_settings import AppSettings
        settings_result = await db.execute(
            select(AppSettings).where(
                AppSettings.key.in_([
                    'COMPANY_NAME', 'COMPANY_EMAIL', 'COMPANY_PHONE',
                    'PDF_HEADER_SHOW_COMPANY_INFO', 'PDF_DOCUMENT_TITLE', 'PDF_PRIMARY_COLOR',
                    'PDF_SHOW_PROJECT_INFO_SECTION', 'PDF_SHOW_NOTES_SECTION',
                    'PDF_SHOW_SIGNATURE_SECTION', 'PDF_SIGNATURE_TITLE',
                    'PDF_FOOTER_TEXT', 'PDF_SHOW_COMPANY_INFO_IN_FOOTER'
                ])
            )
        )
        settings_dict = {s.key: s.get_typed_value() for s in settings_result.scalars().all()}

        # Use helper functions to prepare data
        ticket_data = prepare_ticket_data_for_pdf(ticket)
        project_data = prepare_project_data_for_pdf(ticket.project)

        # Generate PDF with settings
        pdf_content = pdf_generator.generate_rfco_pdf(
            ticket_data,
            project_data,
            settings=settings_dict
        )

        logger.info(f"PDF generated successfully for {ticket.tnm_number}, size: {len(pdf_content)} bytes")

        # Return as download
        filename = f"RFCO-{ticket.tnm_number}.pdf"
        return Response(
            content=pdf_content,
            media_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating PDF for ticket {ticket_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


@router.post("/{ticket_id}/send/", response_model=SendRFCOResponse)
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

    # Generate PDF for email attachment
    pdf_bytes = None
    try:
        logger.info(f"Generating PDF for email attachment: {ticket.tnm_number}")

        # Fetch settings from database
        from app.models.app_settings import AppSettings
        settings_result = await db.execute(
            select(AppSettings).where(
                AppSettings.key.in_([
                    'COMPANY_NAME', 'COMPANY_EMAIL', 'COMPANY_PHONE',
                    'PDF_HEADER_SHOW_COMPANY_INFO', 'PDF_DOCUMENT_TITLE', 'PDF_PRIMARY_COLOR',
                    'PDF_SHOW_PROJECT_INFO_SECTION', 'PDF_SHOW_NOTES_SECTION',
                    'PDF_SHOW_SIGNATURE_SECTION', 'PDF_SIGNATURE_TITLE',
                    'PDF_FOOTER_TEXT', 'PDF_SHOW_COMPANY_INFO_IN_FOOTER'
                ])
            )
        )
        settings_dict = {s.key: s.get_typed_value() for s in settings_result.scalars().all()}

        ticket_data = prepare_ticket_data_for_pdf(ticket)
        project_data = prepare_project_data_for_pdf(ticket.project)
        pdf_bytes = pdf_generator.generate_rfco_pdf(ticket_data, project_data, settings=settings_dict)
        logger.info(f"PDF generated successfully for email: {len(pdf_bytes)} bytes")
    except Exception as e:
        logger.error(f"Failed to generate PDF for email attachment: {str(e)}", exc_info=True)
        # Continue without PDF - email will still be sent

    # Queue email job in Redis for email-service worker to process
    job_id = queue_service.enqueue_rfco_email(
        tnm_ticket_id=str(ticket_id),
        to_email=request_data.gc_email,
        approval_token=token,
        retry_count=0,
        pdf_bytes=pdf_bytes
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


@router.post("/{ticket_id}/remind/", response_model=SendRFCOResponse)
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

    # Generate PDF for email attachment
    pdf_bytes = None
    try:
        logger.info(f"Generating PDF for reminder email attachment: {ticket.tnm_number}")

        # Fetch settings from database
        from app.models.app_settings import AppSettings
        settings_result = await db.execute(
            select(AppSettings).where(
                AppSettings.key.in_([
                    'COMPANY_NAME', 'COMPANY_EMAIL', 'COMPANY_PHONE',
                    'PDF_HEADER_SHOW_COMPANY_INFO', 'PDF_DOCUMENT_TITLE', 'PDF_PRIMARY_COLOR',
                    'PDF_SHOW_PROJECT_INFO_SECTION', 'PDF_SHOW_NOTES_SECTION',
                    'PDF_SHOW_SIGNATURE_SECTION', 'PDF_SIGNATURE_TITLE',
                    'PDF_FOOTER_TEXT', 'PDF_SHOW_COMPANY_INFO_IN_FOOTER'
                ])
            )
        )
        settings_dict = {s.key: s.get_typed_value() for s in settings_result.scalars().all()}

        ticket_data = prepare_ticket_data_for_pdf(ticket)
        project_data = prepare_project_data_for_pdf(ticket.project)
        pdf_bytes = pdf_generator.generate_rfco_pdf(ticket_data, project_data, settings=settings_dict)
        logger.info(f"PDF generated successfully for reminder: {len(pdf_bytes)} bytes")
    except Exception as e:
        logger.error(f"Failed to generate PDF for reminder attachment: {str(e)}", exc_info=True)
        # Continue without PDF - email will still be sent

    # Queue reminder email
    job_id = queue_service.enqueue_rfco_email(
        tnm_ticket_id=str(ticket_id),
        to_email=ticket.project.gc_email,
        approval_token=ticket.approval_token,
        retry_count=ticket.reminder_count,
        pdf_bytes=pdf_bytes
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


@router.patch("/{ticket_id}/status/")
async def update_ticket_status(
    ticket_id: UUID,
    status_data: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Update TNM ticket status

    Simple endpoint to update just the status field.
    Used for workflow transitions like DRAFT -> PENDING_REVIEW -> READY_TO_SEND.
    """
    # Fetch ticket
    result = await db.execute(
        select(TNMTicket).where(TNMTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="TNM ticket not found")

    # Get new status
    new_status_value = status_data.get('status')
    if not new_status_value:
        raise HTTPException(status_code=400, detail="Status field is required")

    # Convert string to enum
    try:
        new_status = TNMStatus(new_status_value)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status: {new_status_value}. Must be one of: {[s.value for s in TNMStatus]}"
        )

    # Store old status
    old_status = ticket.status

    # Update status
    ticket.status = new_status

    # Log status change
    await audit_service.log(
        db=db,
        entity_type='tnm_ticket',
        entity_id=ticket_id,
        action='status_change',
        user_id=UUID(current_user.sub),
        changes={
            'status': {'old': old_status.value, 'new': new_status.value},
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    await db.commit()
    await db.refresh(ticket)

    # Load relationships for response
    await db.refresh(ticket, ["labor_items", "material_items", "equipment_items", "subcontractor_items"])

    logger.info(
        f"Status updated for ticket {ticket.tnm_number}: "
        f"{old_status.value} → {new_status.value} by {current_user.email}"
    )

    return ticket


@router.patch("/{ticket_id}/manual-approval/")
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
    elif approval_data.status == 'sent':
        # Undo approval - reset to sent status
        ticket.status = TNMStatus.sent
        ticket.approved_amount = 0
        ticket.response_date = None
        # Also unmark as paid if it was paid
        if ticket.is_paid:
            ticket.is_paid = 0
            ticket.paid_date = None
            ticket.paid_by = None
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status: {approval_data.status}"
        )

    # Update response date if not already set (skip for 'sent' status as we're undoing)
    if approval_data.status != 'sent' and not ticket.response_date:
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


@router.patch("/{ticket_id}/mark-paid/")
async def mark_ticket_as_paid(
    ticket_id: UUID,
    payment_data: MarkAsPaidRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Mark a ticket as paid or unpaid

    Only approved or partially_approved tickets can be marked as paid.
    Requires admin privileges.
    """
    # Fetch ticket
    result = await db.execute(
        select(TNMTicket).where(TNMTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="TNM ticket not found")

    # Check if ticket is approved
    if ticket.status not in [TNMStatus.approved, TNMStatus.partially_approved]:
        raise HTTPException(
            status_code=400,
            detail=f"Can only mark approved or partially approved tickets as paid. Current status: {ticket.status.value}"
        )

    old_paid_status = bool(ticket.is_paid)

    # Update paid status
    if payment_data.is_paid:
        ticket.is_paid = 1
        if not ticket.paid_date:  # Only set date if not already set
            ticket.paid_date = datetime.utcnow()
        if not ticket.paid_by:  # Only set user if not already set
            ticket.paid_by = UUID(current_user.sub)
    else:
        # Mark as unpaid
        ticket.is_paid = 0
        ticket.paid_date = None
        ticket.paid_by = None

    # Update notes if provided
    if payment_data.notes:
        paid_status_str = "PAID" if payment_data.is_paid else "UNPAID"
        note_entry = f"[{paid_status_str} by {current_user.email} on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}]: {payment_data.notes}"
        if ticket.notes:
            ticket.notes += f"\n\n{note_entry}"
        else:
            ticket.notes = note_entry

    # Log payment status change
    await audit_service.log(
        db=db,
        entity_type='tnm_ticket',
        entity_id=ticket_id,
        action='mark_as_paid' if payment_data.is_paid else 'mark_as_unpaid',
        user_id=UUID(current_user.sub),
        changes={
            'is_paid': {'old': old_paid_status, 'new': payment_data.is_paid},
            'paid_date': {
                'old': ticket.paid_date.isoformat() if old_paid_status and ticket.paid_date else None,
                'new': datetime.utcnow().isoformat() if payment_data.is_paid else None
            },
            'notes': payment_data.notes or '',
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    await db.commit()
    await db.refresh(ticket)

    logger.info(
        f"Payment status updated for ticket {ticket.tnm_number}: "
        f"{'Unpaid' if old_paid_status else 'Paid'} → {'Paid' if payment_data.is_paid else 'Unpaid'} by {current_user.email}"
    )

    return {
        "success": True,
        "ticket_id": str(ticket_id),
        "tnm_number": ticket.tnm_number,
        "is_paid": bool(ticket.is_paid),
        "paid_date": ticket.paid_date.isoformat() if ticket.paid_date else None,
        "paid_by": str(ticket.paid_by) if ticket.paid_by else None,
    }


# ============ BULK ACTION ENDPOINTS ============

@router.post("/bulk/approve/", response_model=BulkActionResponse)
async def bulk_approve_tickets(
    bulk_data: BulkApprovalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Bulk approve multiple tickets

    Allows admin to approve/deny multiple tickets at once.
    Each ticket is processed independently - failures don't stop other tickets.
    """
    results = []
    successful = 0
    failed = 0

    for ticket_id in bulk_data.ticket_ids:
        try:
            # Fetch ticket
            result = await db.execute(
                select(TNMTicket).where(TNMTicket.id == ticket_id)
            )
            ticket = result.scalar_one_or_none()

            if not ticket:
                results.append(BulkActionResult(
                    ticket_id=str(ticket_id),
                    tnm_number="Unknown",
                    success=False,
                    error="Ticket not found"
                ))
                failed += 1
                continue

            # Store old status
            old_status = ticket.status

            # Update status
            if bulk_data.status == 'approved':
                ticket.status = TNMStatus.approved
                ticket.approved_amount = bulk_data.approved_amount or ticket.proposal_amount
            elif bulk_data.status == 'denied':
                ticket.status = TNMStatus.denied
                ticket.approved_amount = 0
            elif bulk_data.status == 'partially_approved':
                ticket.status = TNMStatus.partially_approved
                if bulk_data.approved_amount is None:
                    results.append(BulkActionResult(
                        ticket_id=str(ticket_id),
                        tnm_number=ticket.tnm_number,
                        success=False,
                        error="approved_amount is required for partial approval"
                    ))
                    failed += 1
                    continue
                ticket.approved_amount = bulk_data.approved_amount
            elif bulk_data.status == 'sent':
                # Undo approval - reset to sent status
                ticket.status = TNMStatus.sent
                ticket.approved_amount = 0
                ticket.response_date = None
                # Also unmark as paid if it was paid
                if ticket.is_paid:
                    ticket.is_paid = 0
                    ticket.paid_date = None
                    ticket.paid_by = None

            # Update response date if not already set (skip for 'sent' status as we're undoing)
            if bulk_data.status != 'sent' and not ticket.response_date:
                ticket.response_date = datetime.utcnow().date()

            # Update notes
            if bulk_data.notes:
                note_text = f"[Bulk Override by {current_user.email}]: {bulk_data.notes}"
                if ticket.notes:
                    ticket.notes += f"\n\n{note_text}"
                else:
                    ticket.notes = note_text

            # Log bulk approval
            await audit_service.log(
                db=db,
                entity_type='tnm_ticket',
                entity_id=ticket_id,
                action='bulk_approval_override',
                user_id=UUID(current_user.sub),
                changes={
                    'status': {'old': old_status.value, 'new': ticket.status.value},
                    'approved_amount': {'old': '0', 'new': str(ticket.approved_amount)},
                    'override_reason': bulk_data.reason or 'Bulk approval - no reason provided',
                    'notes': bulk_data.notes or '',
                },
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get('user-agent'),
            )

            results.append(BulkActionResult(
                ticket_id=str(ticket_id),
                tnm_number=ticket.tnm_number,
                success=True
            ))
            successful += 1

            logger.info(
                f"Bulk approval for ticket {ticket.tnm_number}: "
                f"{old_status.value} → {ticket.status.value} by {current_user.email}"
            )

        except Exception as e:
            logger.error(f"Error bulk approving ticket {ticket_id}: {str(e)}", exc_info=True)
            results.append(BulkActionResult(
                ticket_id=str(ticket_id),
                tnm_number="Unknown",
                success=False,
                error=str(e)
            ))
            failed += 1

    # Commit all changes
    await db.commit()

    return BulkActionResponse(
        total=len(bulk_data.ticket_ids),
        successful=successful,
        failed=failed,
        results=results
    )


@router.post("/bulk/mark-paid/", response_model=BulkActionResponse)
async def bulk_mark_tickets_as_paid(
    bulk_data: BulkMarkAsPaidRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Bulk mark multiple tickets as paid or unpaid

    Only approved or partially_approved tickets can be marked as paid.
    Each ticket is processed independently - failures don't stop other tickets.
    """
    results = []
    successful = 0
    failed = 0

    for ticket_id in bulk_data.ticket_ids:
        try:
            # Fetch ticket
            result = await db.execute(
                select(TNMTicket).where(TNMTicket.id == ticket_id)
            )
            ticket = result.scalar_one_or_none()

            if not ticket:
                results.append(BulkActionResult(
                    ticket_id=str(ticket_id),
                    tnm_number="Unknown",
                    success=False,
                    error="Ticket not found"
                ))
                failed += 1
                continue

            # Check if ticket is approved
            if ticket.status not in [TNMStatus.approved, TNMStatus.partially_approved]:
                results.append(BulkActionResult(
                    ticket_id=str(ticket_id),
                    tnm_number=ticket.tnm_number,
                    success=False,
                    error=f"Can only mark approved or partially approved tickets as paid. Current status: {ticket.status.value}"
                ))
                failed += 1
                continue

            old_paid_status = bool(ticket.is_paid)

            # Update paid status
            if bulk_data.is_paid:
                ticket.is_paid = 1
                if not ticket.paid_date:
                    ticket.paid_date = datetime.utcnow()
                if not ticket.paid_by:
                    ticket.paid_by = UUID(current_user.sub)
            else:
                ticket.is_paid = 0
                ticket.paid_date = None
                ticket.paid_by = None

            # Update notes if provided
            if bulk_data.notes:
                paid_status_str = "PAID" if bulk_data.is_paid else "UNPAID"
                note_entry = f"[Bulk {paid_status_str} by {current_user.email} on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}]: {bulk_data.notes}"
                if ticket.notes:
                    ticket.notes += f"\n\n{note_entry}"
                else:
                    ticket.notes = note_entry

            # Log bulk payment status change
            await audit_service.log(
                db=db,
                entity_type='tnm_ticket',
                entity_id=ticket_id,
                action='bulk_mark_as_paid' if bulk_data.is_paid else 'bulk_mark_as_unpaid',
                user_id=UUID(current_user.sub),
                changes={
                    'is_paid': {'old': old_paid_status, 'new': bulk_data.is_paid},
                    'paid_date': {
                        'old': ticket.paid_date.isoformat() if old_paid_status and ticket.paid_date else None,
                        'new': datetime.utcnow().isoformat() if bulk_data.is_paid else None
                    },
                    'notes': bulk_data.notes or '',
                },
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get('user-agent'),
            )

            results.append(BulkActionResult(
                ticket_id=str(ticket_id),
                tnm_number=ticket.tnm_number,
                success=True
            ))
            successful += 1

            logger.info(
                f"Bulk payment status update for ticket {ticket.tnm_number}: "
                f"{'Unpaid' if old_paid_status else 'Paid'} → {'Paid' if bulk_data.is_paid else 'Unpaid'} by {current_user.email}"
            )

        except Exception as e:
            logger.error(f"Error bulk marking ticket {ticket_id} as paid: {str(e)}", exc_info=True)
            results.append(BulkActionResult(
                ticket_id=str(ticket_id),
                tnm_number="Unknown",
                success=False,
                error=str(e)
            ))
            failed += 1

    # Commit all changes
    await db.commit()

    return BulkActionResponse(
        total=len(bulk_data.ticket_ids),
        successful=successful,
        failed=failed,
        results=results
    )
