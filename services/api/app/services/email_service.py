"""Email service for API - enqueues email jobs to Redis"""
from typing import Optional, List
from uuid import UUID
import secrets
from datetime import datetime, timedelta, timezone
import redis
from rq import Queue

from app.core.config import settings
from app.models.tnm_ticket import TNMTicket


class EmailService:
    """Email service for enqueueing email jobs"""

    def __init__(self):
        self.redis_url = settings.REDIS_URL
        self.queue_name = "email_queue"

        # Initialize Redis connection
        self.redis_conn = redis.from_url(self.redis_url, decode_responses=False)

        # Initialize queue
        self.email_queue = Queue(
            self.queue_name,
            connection=self.redis_conn,
            default_timeout='10m'
        )

    def generate_approval_token(self) -> str:
        """Generate a secure approval token"""
        return secrets.token_urlsafe(32)

    async def send_rfco_email(
        self,
        tnm_ticket: TNMTicket,
        to_email: Optional[str] = None
    ) -> bool:
        """
        Enqueue RFCO email to be sent

        Args:
            tnm_ticket: TNM ticket to send
            to_email: Recipient email (defaults to project GC email)

        Returns:
            True if successfully enqueued
        """
        try:
            # Use project GC email if not specified
            if not to_email and tnm_ticket.project:
                to_email = tnm_ticket.project.gc_email

            if not to_email:
                raise ValueError("No recipient email specified")

            # Generate approval token if not exists
            if not tnm_ticket.approval_token:
                tnm_ticket.approval_token = self.generate_approval_token()
                # Set expiration (168 hours = 7 days by default)
                token_expiration_hours = int(settings.APPROVAL_TOKEN_EXPIRATION_HOURS or 168)
                tnm_ticket.approval_token_expires_at = datetime.now(timezone.utc) + timedelta(
                    hours=token_expiration_hours
                )

            # Enqueue the job
            job = self.email_queue.enqueue(
                'app.worker.send_rfco_email',
                tnm_ticket_id=str(tnm_ticket.id),
                to_email=to_email,
                approval_token=tnm_ticket.approval_token,
                retry_count=0,
                job_timeout='10m',
                result_ttl=86400,
                failure_ttl=604800
            )

            return job is not None

        except Exception as e:
            print(f"Failed to enqueue RFCO email: {str(e)}")
            return False

    async def send_approval_confirmation(
        self,
        tnm_ticket: TNMTicket,
        internal_emails: Optional[List[str]] = None
    ) -> bool:
        """
        Enqueue approval confirmation email to internal team

        Args:
            tnm_ticket: TNM ticket that was approved/denied
            internal_emails: List of internal team emails

        Returns:
            True if successfully enqueued
        """
        try:
            # Default internal emails if not specified
            if not internal_emails:
                internal_emails = [settings.COMPANY_EMAIL]

            # Enqueue the job
            job = self.email_queue.enqueue(
                'app.worker.send_approval_confirmation_email',
                tnm_ticket_id=str(tnm_ticket.id),
                internal_emails=internal_emails,
                job_timeout='10m',
                result_ttl=86400,
                failure_ttl=604800
            )

            return job is not None

        except Exception as e:
            print(f"Failed to enqueue approval confirmation email: {str(e)}")
            return False


# Global email service instance
email_service = EmailService()
