"""Email service main entry point"""
import sys
import signal
import time
from rq import Worker
from rq.command import send_stop_job_command

from app.config import config
from app.utils.logger import setup_logger
from app.services.queue_service import queue_service
from app.services.reminder_scheduler import reminder_scheduler
from app.services.smtp_service import smtp_service

logger = setup_logger(__name__)


class EmailWorker:
    """Email worker service"""

    def __init__(self):
        self.worker = None
        self.should_stop = False

    def signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        self.should_stop = True

        if self.worker:
            logger.info("Stopping worker...")
            send_stop_job_command(queue_service.redis_conn, self.worker.name)

    def run(self):
        """Run the email worker"""
        logger.info("=" * 60)
        logger.info("Email Service Starting")
        logger.info("=" * 60)
        logger.info(f"Environment: {config.ENVIRONMENT}")
        logger.info(f"Redis URL: {config.REDIS_URL}")
        logger.info(f"SMTP Enabled: {config.SMTP_ENABLED}")
        logger.info(f"SMTP Host: {config.SMTP_HOST}")
        logger.info(f"Reminder Enabled: {config.REMINDER_ENABLED}")
        logger.info(f"Reminder Interval: {config.REMINDER_INTERVAL_DAYS} days")
        logger.info(f"Max Reminders: {config.REMINDER_MAX_RETRIES}")
        logger.info("=" * 60)

        # Register signal handlers
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)

        # Test SMTP connection
        if config.SMTP_ENABLED:
            logger.info("Testing SMTP connection...")
            try:
                import asyncio
                result = asyncio.run(smtp_service.test_connection())
                if result:
                    logger.info("✓ SMTP connection successful")
                else:
                    logger.warning("✗ SMTP connection failed - check credentials")
            except Exception as e:
                logger.error(f"✗ SMTP connection test error: {str(e)}")

        # Initialize reminder scheduler
        try:
            reminder_scheduler.start()
            logger.info("✓ Reminder scheduler initialized")
        except Exception as e:
            logger.error(f"✗ Failed to initialize reminder scheduler: {str(e)}")

        # Check queue health
        health = queue_service.health_check()
        logger.info(f"Queue health: {health}")

        # Create worker
        logger.info("Creating RQ worker...")
        self.worker = Worker(
            queues=[queue_service.email_queue],
            connection=queue_service.redis_conn,
            name=f"email-worker-{time.time()}",
            log_job_description=True,
            disable_default_exception_handler=False
        )

        logger.info("=" * 60)
        logger.info("Email Worker Started - Waiting for jobs...")
        logger.info("=" * 60)

        # Start worker
        try:
            self.worker.work(
                with_scheduler=True,  # Enable scheduler support
                burst=False,          # Keep running (don't stop after queue is empty)
                logging_level=config.LOG_LEVEL
            )
        except Exception as e:
            logger.error(f"Worker error: {str(e)}", exc_info=True)
            sys.exit(1)

        logger.info("=" * 60)
        logger.info("Email Worker Stopped")
        logger.info("=" * 60)


def main():
    """Main entry point"""
    worker = EmailWorker()
    worker.run()


if __name__ == "__main__":
    main()
