"""Redis queue service for email jobs"""
from typing import Optional, Dict, Any
from uuid import UUID
import redis
from rq import Queue
from rq.job import Job

from app.config import config
from app.utils.logger import setup_logger

logger = setup_logger(__name__)


class QueueService:
    """Redis queue service for managing email jobs"""

    def __init__(self):
        self.redis_url = config.REDIS_URL
        self.queue_name = config.QUEUE_NAME
        self.failed_queue_name = config.FAILED_QUEUE_NAME

        # Initialize Redis connection
        self.redis_conn = redis.from_url(self.redis_url, decode_responses=False)

        # Initialize queues
        self.email_queue = Queue(
            self.queue_name,
            connection=self.redis_conn,
            default_timeout='10m'
        )

        self.failed_queue = Queue(
            self.failed_queue_name,
            connection=self.redis_conn
        )

        logger.info(f"Initialized queue service with Redis at {self.redis_url}")

    def enqueue_rfco_email(
        self,
        tnm_ticket_id: str,
        to_email: str,
        approval_token: str,
        retry_count: int = 0
    ) -> Optional[Job]:
        """
        Enqueue an RFCO email job

        Args:
            tnm_ticket_id: TNM ticket UUID
            to_email: Recipient email
            approval_token: Approval token for link
            retry_count: Current retry count

        Returns:
            Job instance or None if failed
        """
        try:
            job = self.email_queue.enqueue(
                'app.worker.send_rfco_email',
                tnm_ticket_id=tnm_ticket_id,
                to_email=to_email,
                approval_token=approval_token,
                retry_count=retry_count,
                job_timeout='10m',
                result_ttl=86400,  # Keep results for 1 day
                failure_ttl=604800  # Keep failures for 7 days
            )

            logger.info(f"Enqueued RFCO email job {job.id} for ticket {tnm_ticket_id}")
            return job

        except Exception as e:
            logger.error(f"Failed to enqueue RFCO email: {str(e)}", exc_info=True)
            return None

    def enqueue_reminder_email(
        self,
        tnm_ticket_id: str,
        to_email: str,
        approval_token: str,
        reminder_number: int
    ) -> Optional[Job]:
        """
        Enqueue a reminder email job

        Args:
            tnm_ticket_id: TNM ticket UUID
            to_email: Recipient email
            approval_token: Approval token for link
            reminder_number: Which reminder this is

        Returns:
            Job instance or None if failed
        """
        try:
            job = self.email_queue.enqueue(
                'app.worker.send_reminder_email',
                tnm_ticket_id=tnm_ticket_id,
                to_email=to_email,
                approval_token=approval_token,
                reminder_number=reminder_number,
                job_timeout='10m',
                result_ttl=86400,
                failure_ttl=604800
            )

            logger.info(f"Enqueued reminder #{reminder_number} email job {job.id} for ticket {tnm_ticket_id}")
            return job

        except Exception as e:
            logger.error(f"Failed to enqueue reminder email: {str(e)}", exc_info=True)
            return None

    def enqueue_approval_confirmation_email(
        self,
        tnm_ticket_id: str,
        internal_emails: list[str]
    ) -> Optional[Job]:
        """
        Enqueue an approval confirmation email job (to internal team)

        Args:
            tnm_ticket_id: TNM ticket UUID
            internal_emails: List of internal team emails

        Returns:
            Job instance or None if failed
        """
        try:
            job = self.email_queue.enqueue(
                'app.worker.send_approval_confirmation_email',
                tnm_ticket_id=tnm_ticket_id,
                internal_emails=internal_emails,
                job_timeout='10m',
                result_ttl=86400,
                failure_ttl=604800
            )

            logger.info(f"Enqueued approval confirmation email job {job.id} for ticket {tnm_ticket_id}")
            return job

        except Exception as e:
            logger.error(f"Failed to enqueue approval confirmation email: {str(e)}", exc_info=True)
            return None

    def get_job(self, job_id: str) -> Optional[Job]:
        """
        Get a job by ID

        Args:
            job_id: Job ID

        Returns:
            Job instance or None if not found
        """
        try:
            return Job.fetch(job_id, connection=self.redis_conn)
        except Exception as e:
            logger.error(f"Failed to fetch job {job_id}: {str(e)}")
            return None

    def get_queue_length(self) -> int:
        """
        Get the number of jobs in the queue

        Returns:
            Number of jobs
        """
        try:
            return len(self.email_queue)
        except Exception as e:
            logger.error(f"Failed to get queue length: {str(e)}")
            return 0

    def get_failed_jobs(self, limit: int = 10) -> list[Job]:
        """
        Get failed jobs

        Args:
            limit: Maximum number of jobs to return

        Returns:
            List of failed jobs
        """
        try:
            failed_job_registry = self.email_queue.failed_job_registry
            job_ids = failed_job_registry.get_job_ids(0, limit - 1)
            jobs = []
            for job_id in job_ids:
                job = Job.fetch(job_id, connection=self.redis_conn)
                if job:
                    jobs.append(job)
            return jobs
        except Exception as e:
            logger.error(f"Failed to get failed jobs: {str(e)}", exc_info=True)
            return []

    def retry_failed_job(self, job_id: str) -> bool:
        """
        Retry a failed job

        Args:
            job_id: Job ID to retry

        Returns:
            True if successfully requeued, False otherwise
        """
        try:
            job = Job.fetch(job_id, connection=self.redis_conn)
            if job:
                self.email_queue.enqueue_job(job)
                logger.info(f"Requeued failed job {job_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to retry job {job_id}: {str(e)}", exc_info=True)
            return False

    def clear_failed_jobs(self) -> int:
        """
        Clear all failed jobs

        Returns:
            Number of jobs cleared
        """
        try:
            failed_job_registry = self.email_queue.failed_job_registry
            count = len(failed_job_registry)
            failed_job_registry.empty()
            logger.info(f"Cleared {count} failed jobs")
            return count
        except Exception as e:
            logger.error(f"Failed to clear failed jobs: {str(e)}", exc_info=True)
            return 0

    def health_check(self) -> Dict[str, Any]:
        """
        Check queue health

        Returns:
            Health check data
        """
        try:
            queue_length = len(self.email_queue)
            failed_count = len(self.email_queue.failed_job_registry)

            return {
                'healthy': True,
                'queue_length': queue_length,
                'failed_count': failed_count,
                'redis_connected': self.redis_conn.ping()
            }
        except Exception as e:
            logger.error(f"Queue health check failed: {str(e)}", exc_info=True)
            return {
                'healthy': False,
                'error': str(e)
            }


# Global queue service instance
queue_service = QueueService()
