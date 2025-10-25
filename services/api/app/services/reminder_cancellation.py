"""Reminder cancellation helper for API"""
import redis
from rq import Queue
from rq.job import Job
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


async def cancel_reminders_for_ticket(tnm_ticket_id: str) -> int:
    """
    Cancel all scheduled reminders for a ticket

    Args:
        tnm_ticket_id: TNM ticket UUID

    Returns:
        Number of reminders cancelled
    """
    try:
        # Connect to Redis
        redis_conn = redis.from_url(settings.REDIS_URL, decode_responses=False)

        # Get the queue
        queue = Queue("email_queue", connection=redis_conn)

        # Get scheduled jobs registry
        from rq.registry import ScheduledJobRegistry
        registry = ScheduledJobRegistry(queue=queue)

        cancelled_count = 0

        # Iterate through scheduled jobs
        for job_id in registry.get_job_ids():
            try:
                job = Job.fetch(job_id, connection=redis_conn)

                # Check if this is a reminder for this ticket
                if (hasattr(job, 'kwargs') and
                    job.kwargs.get('tnm_ticket_id') == tnm_ticket_id and
                    job.func_name == 'app.worker.send_reminder_email'):

                    # Cancel the job
                    job.cancel()
                    registry.remove(job)
                    cancelled_count += 1
                    logger.info(f"Cancelled reminder job {job_id} for ticket {tnm_ticket_id}")

            except Exception as e:
                logger.warning(f"Error checking job {job_id}: {str(e)}")
                continue

        return cancelled_count

    except Exception as e:
        logger.error(f"Failed to cancel reminders for ticket {tnm_ticket_id}: {str(e)}", exc_info=True)
        return 0
