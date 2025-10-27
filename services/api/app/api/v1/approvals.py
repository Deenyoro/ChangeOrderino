"""Approval endpoints (for GC approval links)"""
import logging
import base64
import re
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.auth import verify_approval_token
from app.models.tnm_ticket import TNMTicket, TNMStatus
from app.models.approval import LineItemApproval, ApprovalStatus
from app.models.asset import Asset
from app.services.audit_service import audit_service
from app.services.email_service import email_service
from app.services.reminder_cancellation import cancel_reminders_for_ticket
from app.services.storage import storage_service
from app.services.settings_service import settings_service

router = APIRouter()


# ============ HELPER FUNCTIONS ============

def process_approval_signature(signature_data_url: str, ticket_id: str, signature_type: str, db: AsyncSession) -> str:
    """
    Convert base64 data URL to actual file in MinIO for approval signatures

    Args:
        signature_data_url: Base64 data URL or existing URL
        ticket_id: TNM ticket ID
        signature_type: Type of signature ('gc' or 'owner')
        db: Database session

    Returns:
        Public URL to the stored signature
    """
    if not signature_data_url or not signature_data_url.startswith('data:'):
        # Not a data URL, return as-is (might already be a URL)
        return signature_data_url

    try:
        # Parse data URL: data:image/png;base64,iVBORw0KG...
        match = re.match(r'data:([^;]+);base64,(.+)', signature_data_url)
        if not match:
            logger.warning(f"Invalid data URL format for {signature_type} signature")
            return signature_data_url

        mime_type = match.group(1)
        base64_data = match.group(2)

        # Decode base64
        file_bytes = base64.b64decode(base64_data)
        file_size = len(file_bytes)

        # Determine extension
        ext = 'png' if 'png' in mime_type else 'jpg'
        filename = f"{signature_type}_signature.{ext}"

        # Upload to MinIO
        storage_key, _ = storage_service.upload_file(
            file_data=BytesIO(file_bytes),
            filename=filename,
            content_type=mime_type,
            folder=f"tnm-tickets/{ticket_id}/approval_signatures",
        )

        # Create asset record (will be committed with ticket)
        asset = Asset(
            tnm_ticket_id=ticket_id,
            filename=filename,
            mime_type=mime_type,
            file_size=file_size,
            storage_key=storage_key,
            asset_type=f'{signature_type}_signature',
            uploaded_by=None,  # No user for GC approvals
        )
        db.add(asset)

        # Return public URL
        return f"/storage/{storage_key}"

    except Exception as e:
        logger.error(f"Failed to process {signature_type} signature: {str(e)}", exc_info=True)
        return signature_data_url


# ============ REQUEST SCHEMAS ============

class LineItemApprovalRequest(BaseModel):
    line_item_type: str  # 'labor', 'material', 'equipment', 'subcontractor'
    line_item_id: str
    status: str  # 'approved', 'denied'
    approved_amount: Optional[float] = None
    comment: Optional[str] = None


class ApprovalSubmitRequest(BaseModel):
    decision: str  # 'approve_all', 'deny_all', 'partial'
    line_item_approvals: List[LineItemApprovalRequest] = []
    gc_name: Optional[str] = None
    gc_comment: Optional[str] = None
    gc_signature: Optional[str] = None  # Base64 image


# ============ ENDPOINTS ============

@router.get("/{token}/")
async def verify_approval_link(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify approval token and return TNM ticket for GC review

    Public endpoint - no auth required
    """
    try:
        # Verify token and get ticket ID
        tnm_ticket_id = verify_approval_token(token)

        # Fetch ticket with all details
        result = await db.execute(
            select(TNMTicket)
            .where(TNMTicket.id == tnm_ticket_id)
            .options(
                selectinload(TNMTicket.project),
                selectinload(TNMTicket.labor_items),
                selectinload(TNMTicket.material_items),
                selectinload(TNMTicket.equipment_items),
                selectinload(TNMTicket.subcontractor_items),
                selectinload(TNMTicket.approvals),
            )
        )
        ticket = result.scalar_one_or_none()

        if not ticket:
            raise HTTPException(status_code=404, detail="TNM ticket not found")

        # Check if token matches
        if ticket.approval_token != token:
            raise HTTPException(status_code=400, detail="Invalid token")

        # Check if expired
        if ticket.approval_token_expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Token has expired")

        # Check if already responded
        already_responded = ticket.status in [
            TNMStatus.approved,
            TNMStatus.denied,
            TNMStatus.partially_approved
        ]

        # Record view
        if not ticket.viewed_at:
            old_status = ticket.status
            ticket.viewed_at = datetime.now(timezone.utc)
            ticket.status = TNMStatus.viewed

            # Log view action (no user_id for GC)
            await audit_service.log(
                db=db,
                entity_type='tnm_ticket',
                entity_id=ticket.id,
                action='view',
                user_id=None,  # GC is not a user
                changes={
                    'status': {'old': old_status.value, 'new': 'viewed'},
                    'viewed_at': {'old': None, 'new': ticket.viewed_at.isoformat()},
                },
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get('user-agent'),
            )

            await db.commit()

        # Build response
        return {
            "valid": True,
            "tnm_ticket": {
                "id": str(ticket.id),
                "tnm_number": ticket.tnm_number,
                "rfco_number": ticket.rfco_number,
                "title": ticket.title,
                "description": ticket.description,
                "proposal_date": ticket.proposal_date.isoformat(),
                "proposal_amount": float(ticket.proposal_amount),
                "labor_items": [
                    {
                        "id": str(item.id),
                        "description": item.description,
                        "hours": float(item.hours),
                        "labor_type": item.labor_type.value,
                        "rate_per_hour": float(item.rate_per_hour),
                        "subtotal": float(item.subtotal),
                    }
                    for item in ticket.labor_items
                ],
                "material_items": [
                    {
                        "id": str(item.id),
                        "description": item.description,
                        "quantity": float(item.quantity),
                        "unit": item.unit,
                        "unit_price": float(item.unit_price),
                        "subtotal": float(item.subtotal),
                    }
                    for item in ticket.material_items
                ],
                "equipment_items": [
                    {
                        "id": str(item.id),
                        "description": item.description,
                        "quantity": float(item.quantity),
                        "unit": item.unit,
                        "unit_price": float(item.unit_price),
                        "subtotal": float(item.subtotal),
                    }
                    for item in ticket.equipment_items
                ],
                "subcontractor_items": [
                    {
                        "id": str(item.id),
                        "description": item.description,
                        "subcontractor_name": item.subcontractor_name,
                        "amount": float(item.amount),
                    }
                    for item in ticket.subcontractor_items
                ],
                "labor_total": float(ticket.labor_total),
                "material_total": float(ticket.material_total),
                "equipment_total": float(ticket.equipment_total),
                "subcontractor_total": float(ticket.subcontractor_total),
            },
            "project": {
                "id": str(ticket.project.id),
                "name": ticket.project.name,
                "project_number": ticket.project.project_number,
                "customer_company": ticket.project.customer_company,
                "gc_company": ticket.project.gc_company,
            },
            "expires_at": ticket.approval_token_expires_at.isoformat(),
            "already_responded": already_responded,
        }

    except HTTPException:
        raise
    except Exception as e:
        return {
            "valid": False,
            "error": str(e)
        }


@router.post("/{token}/submit/")
async def submit_approval(
    token: str,
    approval: ApprovalSubmitRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit GC approval/denial for TNM ticket

    Public endpoint - no auth required
    """
    # Verify token
    tnm_ticket_id = verify_approval_token(token)

    # Fetch ticket
    result = await db.execute(
        select(TNMTicket)
        .where(TNMTicket.id == tnm_ticket_id)
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

    # Verify token matches
    if ticket.approval_token != token:
        raise HTTPException(status_code=400, detail="Invalid token")

    # Check if already responded
    if ticket.status in [TNMStatus.approved, TNMStatus.denied, TNMStatus.partially_approved]:
        raise HTTPException(
            status_code=400,
            detail="This RFCO has already been responded to"
        )

    # Check if GC signature is required
    require_gc_signature = await settings_service.get_setting(
        "REQUIRE_GC_SIGNATURE_ON_APPROVAL",
        db,
        project_id=ticket.project_id
    )

    # Validate GC signature if required
    if require_gc_signature and not approval.gc_signature:
        raise HTTPException(
            status_code=400,
            detail="General Contractor signature is required"
        )

    # Process GC signature
    if approval.gc_signature:
        try:
            ticket.gc_signature_url = process_approval_signature(
                approval.gc_signature,
                str(ticket.id),
                'gc',
                db
            )
            logger.info(f"Processed GC signature for ticket {ticket.id}")
        except Exception as e:
            logger.error(f"Failed to process GC signature: {str(e)}", exc_info=True)

    # Store old status for audit log
    old_status = ticket.status

    # Process approvals
    approved_count = 0
    denied_count = 0
    total_approved_amount = 0.0

    for item_approval in approval.line_item_approvals:
        # Create approval record
        approval_record = LineItemApproval(
            tnm_ticket_id=ticket.id,
            line_item_type=item_approval.line_item_type,
            line_item_id=item_approval.line_item_id,
            status=ApprovalStatus.approved if item_approval.status == 'approved' else ApprovalStatus.denied,
            approved_amount=item_approval.approved_amount,
            gc_comment=item_approval.comment,
            approved_at=datetime.now(timezone.utc),
            approved_by=approval.gc_name,
        )
        db.add(approval_record)

        if item_approval.status == 'approved':
            approved_count += 1
            total_approved_amount += (item_approval.approved_amount or 0)
        else:
            denied_count += 1

    # Update ticket
    ticket.response_date = datetime.now(timezone.utc).date()
    ticket.approved_amount = total_approved_amount

    # Determine final status
    if approval.decision == 'approve_all' or (approved_count > 0 and denied_count == 0):
        ticket.status = TNMStatus.approved
        action = 'approve'
    elif approval.decision == 'deny_all' or (denied_count > 0 and approved_count == 0):
        ticket.status = TNMStatus.denied
        action = 'deny'
    else:
        ticket.status = TNMStatus.partially_approved
        action = 'partial_approve'

    # Log approval/denial (no user_id for GC)
    await audit_service.log(
        db=db,
        entity_type='tnm_ticket',
        entity_id=ticket.id,
        action=action,
        user_id=None,  # GC is not a user
        changes={
            'status': {'old': old_status.value, 'new': ticket.status.value},
            'approved_by': approval.gc_name or 'Unknown GC',
            'approved_amount': str(total_approved_amount),
            'decision': approval.decision,
            'line_items_approved': str(approved_count),
            'line_items_denied': str(denied_count),
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    # Invalidate token (one-time use)
    ticket.approval_token = None

    await db.commit()

    # Cancel any scheduled reminders (ticket is now resolved)
    try:
        cancelled_count = await cancel_reminders_for_ticket(str(ticket.id))
        if cancelled_count > 0:
            logger.info(f"Cancelled {cancelled_count} reminders for ticket {ticket.id}")
    except Exception as e:
        logger.error(f"Failed to cancel reminders: {str(e)}", exc_info=True)

    # Send approval confirmation email to internal team
    try:
        await email_service.send_approval_confirmation(ticket)
        logger.info(f"Queued approval confirmation email for ticket {ticket.id}")
    except Exception as e:
        logger.error(f"Failed to queue approval confirmation email: {str(e)}", exc_info=True)

    return {
        "success": True,
        "tnm_ticket_id": str(ticket.id),
        "status": ticket.status.value,
        "approved_amount": total_approved_amount,
        "line_items_approved": approved_count,
        "line_items_denied": denied_count,
        "response_date": ticket.response_date.isoformat(),
    }
