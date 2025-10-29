"""Reminder scheduler service"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import redis
from rq_scheduler import Scheduler

from app.config import config
from app.utils.logger import setup_logger

logger = setup_logger(__name__)


class ReminderScheduler:
    """Scheduler for automatic email reminders"""

    def __init__(self):
        self.redis_conn = redis.from_url(config.REDIS_URL, decode_responses=False)
        self.scheduler = Scheduler(
            queue_name=config.QUEUE_NAME,
            connection=self.redis_conn
        )
        self.reminder_interval_days = config.REMINDER_INTERVAL_DAYS
        self.reminder_max_retries = config.REMINDER_MAX_RETRIES
        self.reminder_enabled = config.REMINDER_ENABLED

        logger.info(f"Initialized reminder scheduler (enabled: {self.reminder_enabled})")

    def schedule_reminder(
        self,
        tnm_ticket_id: str,
        to_email: str,
        approval_token: str,
        reminder_number: int,
        schedule_time: Optional[datetime] = None,
        bypass_max_check: bool = False
    ) -> Optional[str]:
        """
        Schedule a reminder email

        Args:
            tnm_ticket_id: TNM ticket UUID
            to_email: Recipient email
            approval_token: Approval token for link
            reminder_number: Which reminder this is (1, 2, 3, etc.)
            schedule_time: When to send (defaults to N days from now)
            bypass_max_check: If True, ignore max retries limit (for auto-reminders)

        Returns:
            Job ID or None if failed
        """
        if not self.reminder_enabled:
            logger.info("Reminders are disabled")
            return None

        # Only check max retries if not bypassed (auto-reminders bypass this)
        # Treat 0 as infinite retries
        if not bypass_max_check and self.reminder_max_retries > 0 and reminder_number > self.reminder_max_retries:
            logger.info(f"Max reminders ({self.reminder_max_retries}) reached for ticket {tnm_ticket_id}")
            return None

        try:
            # Calculate schedule time if not provided
            if schedule_time is None:
                schedule_time = datetime.now(timezone.utc) + timedelta(days=self.reminder_interval_days)

            # Schedule the job
            job = self.scheduler.enqueue_at(
                schedule_time,
                'app.worker.send_reminder_email',
                tnm_ticket_id=tnm_ticket_id,
                to_email=to_email,
                approval_token=approval_token,
                reminder_number=reminder_number,
                timeout='10m'
            )

            logger.info(
                f"Scheduled reminder #{reminder_number} for ticket {tnm_ticket_id} "
                f"at {schedule_time.isoformat()}"
            )

            return job.id

        except Exception as e:
            logger.error(f"Failed to schedule reminder: {str(e)}", exc_info=True)
            return None

    def schedule_first_reminder(
        self,
        tnm_ticket_id: str,
        to_email: str,
        approval_token: str
    ) -> Optional[str]:
        """
        Schedule the first reminder after initial RFCO send

        Args:
            tnm_ticket_id: TNM ticket UUID
            to_email: Recipient email
            approval_token: Approval token for link

        Returns:
            Job ID or None if failed
        """
        return self.schedule_reminder(
            tnm_ticket_id=tnm_ticket_id,
            to_email=to_email,
            approval_token=approval_token,
            reminder_number=1
        )

    def cancel_reminders_for_ticket(self, tnm_ticket_id: str) -> int:
        """
        Cancel all scheduled reminders for a ticket

        Args:
            tnm_ticket_id: TNM ticket UUID

        Returns:
            Number of reminders cancelled
        """
        try:
            cancelled_count = 0

            # Get all scheduled jobs
            for job in self.scheduler.get_jobs():
                # Check if this job is a reminder for this ticket
                if (hasattr(job, 'kwargs') and
                    job.kwargs.get('tnm_ticket_id') == tnm_ticket_id and
                    job.func_name == 'app.worker.send_reminder_email'):

                    self.scheduler.cancel(job)
                    cancelled_count += 1

            if cancelled_count > 0:
                logger.info(f"Cancelled {cancelled_count} reminders for ticket {tnm_ticket_id}")

            return cancelled_count

        except Exception as e:
            logger.error(f"Failed to cancel reminders for ticket {tnm_ticket_id}: {str(e)}", exc_info=True)
            return 0

    def get_scheduled_reminders_count(self, tnm_ticket_id: str) -> int:
        """
        Get count of scheduled reminders for a ticket

        Args:
            tnm_ticket_id: TNM ticket UUID

        Returns:
            Number of scheduled reminders
        """
        try:
            count = 0
            for job in self.scheduler.get_jobs():
                if (hasattr(job, 'kwargs') and
                    job.kwargs.get('tnm_ticket_id') == tnm_ticket_id and
                    job.func_name == 'app.worker.send_reminder_email'):
                    count += 1

            return count

        except Exception as e:
            logger.error(f"Failed to get scheduled reminders count: {str(e)}", exc_info=True)
            return 0

    def start(self):
        """Start the scheduler (processes scheduled jobs)"""
        if not self.reminder_enabled:
            logger.info("Reminder scheduler is disabled")
            return

        try:
            logger.info("Starting reminder scheduler...")
            # The scheduler runs in the background as part of RQ worker
            # This method is mainly for initialization
            logger.info("Reminder scheduler started successfully")

        except Exception as e:
            logger.error(f"Failed to start reminder scheduler: {str(e)}", exc_info=True)
            raise

    def health_check(self) -> dict:
        """
        Check scheduler health

        Returns:
            Health check data
        """
        try:
            scheduled_count = len(self.scheduler.get_jobs())

            return {
                'healthy': True,
                'enabled': self.reminder_enabled,
                'scheduled_jobs': scheduled_count,
                'interval_days': self.reminder_interval_days,
                'max_retries': self.reminder_max_retries,
                'redis_connected': self.redis_conn.ping()
            }

        except Exception as e:
            logger.error(f"Scheduler health check failed: {str(e)}", exc_info=True)
            return {
                'healthy': False,
                'error': str(e)
            }


# Global reminder scheduler instance
reminder_scheduler = ReminderScheduler()
