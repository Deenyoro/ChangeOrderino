"""Email service health check endpoints"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone
import redis
from rq import Queue

from app.core.database import get_db
from app.core.auth import get_current_user, TokenData
from app.core.config import settings
from app.models.email_log import EmailLog

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/email-service/health")
async def email_service_health(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Check email service health

    Returns:
        Health status of email service components
    """
    health_data = {
        "healthy": True,
        "components": {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    # Check Redis connection
    try:
        redis_conn = redis.from_url(settings.REDIS_URL, decode_responses=False)
        redis_conn.ping()
        health_data["components"]["redis"] = {
            "status": "healthy",
            "connected": True
        }
    except Exception as e:
        health_data["healthy"] = False
        health_data["components"]["redis"] = {
            "status": "unhealthy",
            "connected": False,
            "error": str(e)
        }

    # Check queue
    try:
        redis_conn = redis.from_url(settings.REDIS_URL, decode_responses=False)
        queue = Queue("email_queue", connection=redis_conn)
        failed_queue = Queue("failed_email_queue", connection=redis_conn)

        health_data["components"]["queue"] = {
            "status": "healthy",
            "queue_length": len(queue),
            "failed_count": len(failed_queue.failed_job_registry) if hasattr(failed_queue, 'failed_job_registry') else 0
        }
    except Exception as e:
        health_data["healthy"] = False
        health_data["components"]["queue"] = {
            "status": "unhealthy",
            "error": str(e)
        }

    # Check recent email sends
    try:
        # Count emails sent in last 24 hours
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        result = await db.execute(
            select(func.count(EmailLog.id))
            .where(EmailLog.created_at >= since)
        )
        recent_count = result.scalar() or 0

        # Count successful vs failed
        success_result = await db.execute(
            select(func.count(EmailLog.id))
            .where(EmailLog.created_at >= since)
            .where(EmailLog.status == 'sent')
        )
        success_count = success_result.scalar() or 0

        failed_result = await db.execute(
            select(func.count(EmailLog.id))
            .where(EmailLog.created_at >= since)
            .where(EmailLog.status == 'failed')
        )
        failed_count = failed_result.scalar() or 0

        health_data["components"]["email_log"] = {
            "status": "healthy",
            "last_24h": {
                "total": recent_count,
                "sent": success_count,
                "failed": failed_count,
                "success_rate": f"{(success_count / recent_count * 100) if recent_count > 0 else 0:.1f}%"
            }
        }
    except Exception as e:
        logger.error(f"Failed to check email log: {str(e)}", exc_info=True)
        health_data["components"]["email_log"] = {
            "status": "error",
            "error": str(e)
        }

    # SMTP config status
    health_data["components"]["smtp"] = {
        "enabled": settings.SMTP_ENABLED,
        "host": settings.SMTP_HOST,
        "port": settings.SMTP_PORT,
        "configured": bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD)
    }

    # Reminder config status
    health_data["components"]["reminders"] = {
        "enabled": settings.REMINDER_ENABLED,
        "interval_days": settings.REMINDER_INTERVAL_DAYS,
        "max_retries": settings.REMINDER_MAX_RETRIES
    }

    return health_data


@router.get("/email-service/stats")
async def email_service_stats(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Get email service statistics

    Returns:
        Email service statistics
    """
    stats = {}

    try:
        # Total emails
        total_result = await db.execute(select(func.count(EmailLog.id)))
        stats["total_emails"] = total_result.scalar() or 0

        # By type
        type_result = await db.execute(
            select(EmailLog.email_type, func.count(EmailLog.id))
            .group_by(EmailLog.email_type)
        )
        stats["by_type"] = {row[0]: row[1] for row in type_result}

        # By status
        status_result = await db.execute(
            select(EmailLog.status, func.count(EmailLog.id))
            .group_by(EmailLog.status)
        )
        stats["by_status"] = {row[0]: row[1] for row in status_result}

        # Last 7 days
        since_week = datetime.now(timezone.utc) - timedelta(days=7)
        week_result = await db.execute(
            select(func.count(EmailLog.id))
            .where(EmailLog.created_at >= since_week)
        )
        stats["last_7_days"] = week_result.scalar() or 0

        # Last 30 days
        since_month = datetime.now(timezone.utc) - timedelta(days=30)
        month_result = await db.execute(
            select(func.count(EmailLog.id))
            .where(EmailLog.created_at >= since_month)
        )
        stats["last_30_days"] = month_result.scalar() or 0

        # Most recent email
        recent_result = await db.execute(
            select(EmailLog)
            .order_by(EmailLog.created_at.desc())
            .limit(1)
        )
        recent_email = recent_result.scalar_one_or_none()

        if recent_email:
            stats["most_recent"] = {
                "to_email": recent_email.to_email,
                "subject": recent_email.subject,
                "type": recent_email.email_type,
                "status": recent_email.status,
                "sent_at": recent_email.sent_at.isoformat() if recent_email.sent_at else None,
                "created_at": recent_email.created_at.isoformat()
            }

    except Exception as e:
        logger.error(f"Failed to get email stats: {str(e)}", exc_info=True)
        stats["error"] = str(e)

    return stats


@router.get("/email-service/recent-logs")
async def email_service_recent_logs(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Get recent email logs

    Args:
        limit: Number of logs to return (max 100)

    Returns:
        List of recent email logs
    """
    limit = min(limit, 100)  # Cap at 100

    try:
        result = await db.execute(
            select(EmailLog)
            .order_by(EmailLog.created_at.desc())
            .limit(limit)
        )
        logs = result.scalars().all()

        return {
            "count": len(logs),
            "logs": [
                {
                    "id": str(log.id),
                    "tnm_ticket_id": str(log.tnm_ticket_id) if log.tnm_ticket_id else None,
                    "to_email": log.to_email,
                    "subject": log.subject,
                    "email_type": log.email_type,
                    "status": log.status,
                    "error_message": log.error_message,
                    "sent_at": log.sent_at.isoformat() if log.sent_at else None,
                    "created_at": log.created_at.isoformat()
                }
                for log in logs
            ]
        }

    except Exception as e:
        logger.error(f"Failed to get recent logs: {str(e)}", exc_info=True)
        return {
            "error": str(e),
            "logs": []
        }
