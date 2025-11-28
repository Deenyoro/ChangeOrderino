"""Redis queue service for enqueuing email jobs from API"""
from typing import Optional
import logging
import redis
from rq import Queue
from rq.job import Job

from app.core.config import settings

logger = logging.getLogger(__name__)


class QueueService:
    """Redis queue service for managing email jobs"""

    def __init__(self):
        self.redis_url = settings.REDIS_URL
        self.queue_name = "email_queue"
        self.failed_queue_name = "failed_queue"

        self._redis_conn = None
        self._email_queue = None
        self._failed_queue = None
        self._initialized = False
        self._init_error = None

    def _ensure_connection(self) -> bool:
        """
        Ensure Redis connection is established (lazy initialization)

        Returns:
            True if connection is ready, False otherwise
        """
        if self._initialized:
            return True

        try:
            # Initialize Redis connection
            self._redis_conn = redis.from_url(
                self.redis_url,
                decode_responses=False,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )

            # Test connection
            self._redis_conn.ping()
            logger.info(f"✓ Connected to Redis at {self.redis_url}")

            # Initialize queues
            self._email_queue = Queue(
                self.queue_name,
                connection=self._redis_conn,
                default_timeout='10m'
            )

            self._failed_queue = Queue(
                self.failed_queue_name,
                connection=self._redis_conn
            )

            self._initialized = True
            self._init_error = None
            logger.info(f"✓ Initialized queue service - Queue: {self.queue_name}")
            return True

        except Exception as e:
            self._init_error = str(e)
            logger.error(f"✗ Failed to connect to Redis: {str(e)}")
            return False

    @property
    def redis_conn(self):
        """Get Redis connection (ensures initialization)"""
        if not self._ensure_connection():
            raise ConnectionError(f"Redis connection failed: {self._init_error}")
        return self._redis_conn

    @property
    def email_queue(self):
        """Get email queue (ensures initialization)"""
        if not self._ensure_connection():
            raise ConnectionError(f"Redis connection failed: {self._init_error}")
        return self._email_queue

    def enqueue_rfco_email(
        self,
        tnm_ticket_id: str,
        to_email: str,
        approval_token: str,
        retry_count: int = 0,
        pdf_bytes: Optional[bytes] = None
    ) -> Optional[str]:
        """
        Enqueue an RFCO email job to be processed by email-service worker

        Args:
            tnm_ticket_id: TNM ticket UUID
            to_email: Recipient email
            approval_token: JWT approval token for link
            retry_count: Current retry count
            pdf_bytes: Optional PDF bytes to attach to email

        Returns:
            Job ID if enqueued successfully, None otherwise
        """
        try:
            # Ensure connection is ready
            if not self._ensure_connection():
                logger.error(f"Cannot enqueue RFCO email: Redis not connected")
                return None

            # Convert PDF bytes to base64 if provided (for JSON serialization)
            import base64
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8') if pdf_bytes else None

            job = self.email_queue.enqueue(
                'app.worker.send_rfco_email',  # This function exists in email-service
                tnm_ticket_id=tnm_ticket_id,
                to_email=to_email,
                approval_token=approval_token,
                retry_count=retry_count,
                pdf_base64=pdf_base64,
                job_timeout='10m',
                result_ttl=86400,  # Keep results for 1 day
                failure_ttl=604800  # Keep failures for 7 days
            )

            pdf_info = f" with PDF ({len(pdf_bytes)} bytes)" if pdf_bytes else ""
            logger.info(
                f"✓ Enqueued RFCO email job {job.id} for ticket {tnm_ticket_id} "
                f"to {to_email}{pdf_info}"
            )
            return str(job.id)

        except ConnectionError as e:
            logger.error(f"✗ Redis connection error while enqueueing RFCO email: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"✗ Failed to enqueue RFCO email: {str(e)}", exc_info=True)
            return None

    def enqueue_reminder_email(
        self,
        tnm_ticket_id: str,
        to_email: str,
        approval_token: str,
        reminder_number: int
    ) -> Optional[str]:
        """
        Enqueue a reminder email job

        Args:
            tnm_ticket_id: TNM ticket UUID
            to_email: Recipient email
            approval_token: JWT approval token for link
            reminder_number: Which reminder this is (1, 2, 3, etc.)

        Returns:
            Job ID if enqueued successfully, None otherwise
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

            logger.info(
                f"✓ Enqueued reminder #{reminder_number} email job {job.id} "
                f"for ticket {tnm_ticket_id}"
            )
            return str(job.id)

        except Exception as e:
            logger.error(f"✗ Failed to enqueue reminder email: {str(e)}", exc_info=True)
            return None

    def enqueue_approval_confirmation_email(
        self,
        tnm_ticket_id: str,
        internal_emails: list[str]
    ) -> Optional[str]:
        """
        Enqueue an approval confirmation email job (to internal team)

        Args:
            tnm_ticket_id: TNM ticket UUID
            internal_emails: List of internal team emails to notify

        Returns:
            Job ID if enqueued successfully, None otherwise
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

            logger.info(
                f"✓ Enqueued approval confirmation email job {job.id} "
                f"for ticket {tnm_ticket_id}"
            )
            return str(job.id)

        except Exception as e:
            logger.error(f"✗ Failed to enqueue approval confirmation email: {str(e)}", exc_info=True)
            return None

    def enqueue_pm_review_email(
        self,
        tnm_ticket_id: str,
        recipient_emails: list[str]
    ) -> Optional[str]:
        """
        Enqueue a PM review email job (to PM approvers)

        Args:
            tnm_ticket_id: TNM ticket UUID
            recipient_emails: List of PM emails to notify

        Returns:
            Job ID if enqueued successfully, None otherwise
        """
        try:
            job = self.email_queue.enqueue(
                'app.worker.send_pm_review_email',
                tnm_ticket_id=tnm_ticket_id,
                recipient_emails=recipient_emails,
                job_timeout='10m',
                result_ttl=86400,
                failure_ttl=604800
            )

            logger.info(
                f"✓ Enqueued PM review email job {job.id} "
                f"for ticket {tnm_ticket_id} to {len(recipient_emails)} recipients"
            )
            return str(job.id)

        except Exception as e:
            logger.error(f"✗ Failed to enqueue PM review email: {str(e)}", exc_info=True)
            return None

    def get_job_status(self, job_id: str) -> Optional[dict]:
        """
        Get the status of a job

        Args:
            job_id: Job ID

        Returns:
            Job status dict or None if not found
        """
        try:
            job = Job.fetch(job_id, connection=self.redis_conn)
            return {
                'id': job.id,
                'status': job.get_status(),
                'created_at': job.created_at,
                'enqueued_at': job.enqueued_at,
                'started_at': job.started_at,
                'ended_at': job.ended_at,
                'result': job.result,
                'exc_info': job.exc_info
            }
        except Exception as e:
            logger.error(f"Failed to fetch job {job_id}: {str(e)}")
            return None

    def get_queue_info(self) -> dict:
        """
        Get queue statistics

        Returns:
            Queue info dict
        """
        try:
            return {
                'queue_name': self.queue_name,
                'queued_jobs': len(self.email_queue),
                'failed_jobs': len(self.email_queue.failed_job_registry),
                'redis_connected': self.redis_conn.ping()
            }
        except Exception as e:
            logger.error(f"Failed to get queue info: {str(e)}")
            return {
                'queue_name': self.queue_name,
                'error': str(e),
                'redis_connected': False
            }

    def health_check(self) -> dict:
        """
        Check queue health

        Returns:
            Health check data
        """
        try:
            # Try to ensure connection
            if not self._ensure_connection():
                return {
                    'healthy': False,
                    'redis_connected': False,
                    'error': self._init_error or 'Redis connection failed'
                }

            queue_length = len(self.email_queue)
            failed_count = len(self.email_queue.failed_job_registry)
            redis_ping = self.redis_conn.ping()

            healthy = redis_ping and queue_length < 1000  # Consider unhealthy if queue is too long

            return {
                'healthy': healthy,
                'queue_length': queue_length,
                'failed_count': failed_count,
                'redis_connected': redis_ping
            }
        except Exception as e:
            logger.error(f"Queue health check failed: {str(e)}", exc_info=True)
            return {
                'healthy': False,
                'redis_connected': False,
                'error': str(e)
            }


# Global queue service instance
queue_service = QueueService()
