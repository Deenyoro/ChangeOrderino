"""Dashboard statistics endpoints"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, Date, case
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.auth import get_current_user, TokenData
from app.models.tnm_ticket import TNMTicket, TNMStatus
from app.models.project import Project

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(
    project_id: Optional[UUID] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Get dashboard statistics

    Provides:
    - Counts by status
    - Total amounts
    - Recent activity
    - Pending items
    - Performance metrics
    - Breakdown by project
    """
    # ============ COUNTS BY STATUS ============

    counts_by_status = {}
    for status in TNMStatus:
        # Build query with filters
        query = select(func.count(TNMTicket.id)).where(TNMTicket.status == status)

        if project_id:
            query = query.where(TNMTicket.project_id == project_id)
        if date_from:
            query = query.where(TNMTicket.created_at >= datetime.fromisoformat(date_from))
        if date_to:
            query = query.where(TNMTicket.created_at <= datetime.fromisoformat(date_to))

        count_result = await db.execute(query)
        counts_by_status[status.value] = count_result.scalar() or 0

    # ============ TOTALS ============

    # Build base query for all totals
    base_query_filters = []
    if project_id:
        base_query_filters.append(TNMTicket.project_id == project_id)
    if date_from:
        base_query_filters.append(TNMTicket.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        base_query_filters.append(TNMTicket.created_at <= datetime.fromisoformat(date_to))

    # Total tickets
    total_query = select(func.count(TNMTicket.id))
    if base_query_filters:
        total_query = total_query.where(*base_query_filters)
    total_result = await db.execute(total_query)
    total_tickets = total_result.scalar() or 0

    # Sum of proposal amounts
    proposal_query = select(func.sum(TNMTicket.proposal_amount))
    if base_query_filters:
        proposal_query = proposal_query.where(*base_query_filters)
    proposal_sum_result = await db.execute(proposal_query)
    total_proposal_amount = float(proposal_sum_result.scalar() or 0)

    # Sum of approved amounts
    approved_query = select(func.sum(TNMTicket.approved_amount)).where(
        TNMTicket.status.in_([TNMStatus.approved, TNMStatus.partially_approved])
    )
    if base_query_filters:
        approved_query = approved_query.where(*base_query_filters)
    approved_sum_result = await db.execute(approved_query)
    total_approved_amount = float(approved_sum_result.scalar() or 0)

    # Approval rate
    approval_rate = (
        (total_approved_amount / total_proposal_amount * 100)
        if total_proposal_amount > 0
        else 0
    )

    # ============ RECENT ACTIVITY ============

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Created this week
    created_week_query = select(func.count(TNMTicket.id)).where(
        TNMTicket.created_at >= week_ago
    )
    if project_id:
        created_week_query = created_week_query.where(TNMTicket.project_id == project_id)
    created_week_result = await db.execute(created_week_query)
    created_this_week = created_week_result.scalar() or 0

    # Created this month
    created_month_query = select(func.count(TNMTicket.id)).where(
        TNMTicket.created_at >= month_ago
    )
    if project_id:
        created_month_query = created_month_query.where(TNMTicket.project_id == project_id)
    created_month_result = await db.execute(created_month_query)
    created_this_month = created_month_result.scalar() or 0

    # Sent this week
    sent_week_query = select(func.count(TNMTicket.id)).where(
        TNMTicket.last_email_sent_at >= week_ago,
        TNMTicket.last_email_sent_at.isnot(None)
    )
    if project_id:
        sent_week_query = sent_week_query.where(TNMTicket.project_id == project_id)
    sent_week_result = await db.execute(sent_week_query)
    sent_this_week = sent_week_result.scalar() or 0

    # Approved this week
    approved_week_query = select(func.count(TNMTicket.id)).where(
        TNMTicket.status.in_([TNMStatus.approved, TNMStatus.partially_approved]),
        TNMTicket.response_date >= week_ago.date(),
        TNMTicket.response_date.isnot(None)
    )
    if project_id:
        approved_week_query = approved_week_query.where(TNMTicket.project_id == project_id)
    approved_week_result = await db.execute(approved_week_query)
    approved_this_week = approved_week_result.scalar() or 0

    # ============ PENDING ITEMS ============

    # Needs review
    needs_review = counts_by_status.get('pending_review', 0)

    # Awaiting GC response
    awaiting_response = (
        counts_by_status.get('sent', 0) +
        counts_by_status.get('viewed', 0)
    )

    # Overdue responses (sent > 14 days ago, no response)
    two_weeks_ago = now - timedelta(days=14)
    overdue_query = select(func.count(TNMTicket.id)).where(
        TNMTicket.status.in_([TNMStatus.sent, TNMStatus.viewed]),
        TNMTicket.last_email_sent_at <= two_weeks_ago,
        TNMTicket.last_email_sent_at.isnot(None)
    )
    if project_id:
        overdue_query = overdue_query.where(TNMTicket.project_id == project_id)
    overdue_result = await db.execute(overdue_query)
    overdue_responses = overdue_result.scalar() or 0

    # ============ PERFORMANCE METRICS ============

    # Average time from created to sent (review time)
    avg_review_query = select(
        func.avg(
            func.extract('epoch', TNMTicket.last_email_sent_at - TNMTicket.created_at) / 3600
        )
    ).where(
        TNMTicket.status != TNMStatus.draft,
        TNMTicket.last_email_sent_at.isnot(None)
    )
    if base_query_filters:
        avg_review_query = avg_review_query.where(*base_query_filters)
    avg_review_result = await db.execute(avg_review_query)
    avg_review_time_hours = float(avg_review_result.scalar() or 0)

    # Average time from sent to response (GC response time)
    # PostgreSQL: Date - Date::date returns integer days
    avg_response_query = select(
        func.avg(
            TNMTicket.response_date - func.cast(TNMTicket.last_email_sent_at, Date)
        )
    ).where(
        TNMTicket.response_date.isnot(None),
        TNMTicket.last_email_sent_at.isnot(None)
    )
    if base_query_filters:
        avg_response_query = avg_response_query.where(*base_query_filters)
    avg_response_result = await db.execute(avg_response_query)
    avg_response_time_days = float(avg_response_result.scalar() or 0)

    # Fastest approval
    fastest_query = select(
        func.min(
            TNMTicket.response_date - func.cast(TNMTicket.last_email_sent_at, Date)
        )
    ).where(
        TNMTicket.response_date.isnot(None),
        TNMTicket.last_email_sent_at.isnot(None),
        TNMTicket.status == TNMStatus.approved
    )
    if base_query_filters:
        fastest_query = fastest_query.where(*base_query_filters)
    fastest_result = await db.execute(fastest_query)
    fastest_value = fastest_result.scalar()
    fastest_approval_days = int(fastest_value) if fastest_value is not None else 0

    # Slowest approval
    slowest_query = select(
        func.max(
            TNMTicket.response_date - func.cast(TNMTicket.last_email_sent_at, Date)
        )
    ).where(
        TNMTicket.response_date.isnot(None),
        TNMTicket.last_email_sent_at.isnot(None),
        TNMTicket.status == TNMStatus.approved
    )
    if base_query_filters:
        slowest_query = slowest_query.where(*base_query_filters)
    slowest_result = await db.execute(slowest_query)
    slowest_value = slowest_result.scalar()
    slowest_approval_days = int(slowest_value) if slowest_value is not None else 0

    # ============ BY PROJECT ============

    # Group by project
    project_stats_query = (
        select(
            Project.id,
            Project.name,
            Project.project_number,
            func.count(TNMTicket.id).label('ticket_count'),
            func.sum(TNMTicket.proposal_amount).label('total_amount'),
            func.sum(
                case(
                    (TNMTicket.status.in_([TNMStatus.approved, TNMStatus.partially_approved]), TNMTicket.approved_amount),
                    else_=0
                )
            ).label('approved_amount'),
        )
        .join(TNMTicket, TNMTicket.project_id == Project.id)
        .group_by(Project.id, Project.name, Project.project_number)
        .order_by(func.count(TNMTicket.id).desc())
    )

    # Apply project filter if specified
    if project_id:
        project_stats_query = project_stats_query.where(Project.id == project_id)

    # Apply date filters to the join
    if date_from:
        project_stats_query = project_stats_query.where(
            TNMTicket.created_at >= datetime.fromisoformat(date_from)
        )
    if date_to:
        project_stats_query = project_stats_query.where(
            TNMTicket.created_at <= datetime.fromisoformat(date_to)
        )

    project_stats_result = await db.execute(project_stats_query)

    by_project = [
        {
            "project_id": str(row.id),
            "project_name": row.name,
            "project_number": row.project_number,
            "ticket_count": row.ticket_count,
            "total_amount": float(row.total_amount or 0),
            "approved_amount": float(row.approved_amount or 0),
        }
        for row in project_stats_result.all()
    ]

    # ============ RETURN RESPONSE ============

    return {
        "counts_by_status": counts_by_status,
        "totals": {
            "all_tickets": total_tickets,
            "total_proposal_amount": total_proposal_amount,
            "total_approved_amount": total_approved_amount,
            "approval_rate": round(approval_rate, 1),
        },
        "recent_activity": {
            "created_this_week": created_this_week,
            "created_this_month": created_this_month,
            "sent_this_week": sent_this_week,
            "approved_this_week": approved_this_week,
        },
        "pending": {
            "needs_review": needs_review,
            "awaiting_gc_response": awaiting_response,
            "overdue_responses": overdue_responses,
        },
        "performance": {
            "avg_review_time_hours": round(avg_review_time_hours, 1),
            "avg_response_time_days": round(avg_response_time_days, 1),
            "fastest_approval_days": fastest_approval_days,
            "slowest_approval_days": slowest_approval_days,
        },
        "by_project": by_project,
    }
