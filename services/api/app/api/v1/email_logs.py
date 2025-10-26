"""Email logs endpoints"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.auth import get_current_user, TokenData
from app.models.email_log import EmailLog
from pydantic import BaseModel


router = APIRouter()


class EmailLogResponse(BaseModel):
    """Email log response schema"""
    id: str
    tnm_ticket_id: Optional[str]
    to_email: str
    from_email: str
    subject: str
    email_type: Optional[str]
    status: str
    error_message: Optional[str]
    sent_at: Optional[datetime]
    created_at: datetime

    model_config = {'from_attributes': True}


class FailedEmailsStats(BaseModel):
    """Failed emails statistics"""
    total_failed: int
    failed_last_24h: int
    failed_last_7d: int


@router.get("/failed", response_model=List[EmailLogResponse])
async def get_failed_emails(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get failed email logs"""

    query = (
        select(EmailLog)
        .where(EmailLog.status == 'failed')
        .order_by(desc(EmailLog.created_at))
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(query)
    emails = result.scalars().all()

    return emails


@router.get("/failed/stats", response_model=FailedEmailsStats)
async def get_failed_email_stats(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get statistics about failed emails"""

    # Total failed
    total_query = select(func.count(EmailLog.id)).where(EmailLog.status == 'failed')
    total_result = await db.execute(total_query)
    total_failed = total_result.scalar() or 0

    # Failed in last 24 hours
    yesterday = datetime.utcnow() - timedelta(days=1)
    last_24h_query = (
        select(func.count(EmailLog.id))
        .where(EmailLog.status == 'failed')
        .where(EmailLog.created_at >= yesterday)
    )
    last_24h_result = await db.execute(last_24h_query)
    failed_last_24h = last_24h_result.scalar() or 0

    # Failed in last 7 days
    last_week = datetime.utcnow() - timedelta(days=7)
    last_7d_query = (
        select(func.count(EmailLog.id))
        .where(EmailLog.status == 'failed')
        .where(EmailLog.created_at >= last_week)
    )
    last_7d_result = await db.execute(last_7d_query)
    failed_last_7d = last_7d_result.scalar() or 0

    return FailedEmailsStats(
        total_failed=total_failed,
        failed_last_24h=failed_last_24h,
        failed_last_7d=failed_last_7d
    )


@router.post("/{email_id}/retry")
async def retry_failed_email(
    email_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retry a failed email by re-queuing it"""

    query = select(EmailLog).where(EmailLog.id == email_id)
    result = await db.execute(query)
    email_log = result.scalar_one_or_none()

    if not email_log:
        raise HTTPException(status_code=404, detail="Email log not found")

    if email_log.status != 'failed':
        raise HTTPException(status_code=400, detail="Only failed emails can be retried")

    # Re-queue the email by updating status to 'queued'
    email_log.status = 'queued'
    email_log.error_message = None
    await db.commit()

    return {"success": True, "message": "Email re-queued for sending"}
