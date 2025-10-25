"""SMTP email sending service"""
import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, List
from pathlib import Path

from app.config import config
from app.utils.logger import setup_logger

logger = setup_logger(__name__)


class SMTPService:
    """SMTP email sending service using Office 365"""

    def __init__(self):
        self.smtp_host = config.SMTP_HOST
        self.smtp_port = config.SMTP_PORT
        self.smtp_username = config.SMTP_USERNAME
        self.smtp_password = config.SMTP_PASSWORD
        self.smtp_from_email = config.SMTP_FROM_EMAIL
        self.smtp_from_name = config.SMTP_FROM_NAME
        self.smtp_use_tls = config.SMTP_USE_TLS
        self.smtp_enabled = config.SMTP_ENABLED

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        attachments: Optional[List[tuple[str, bytes]]] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> bool:
        """
        Send an email via SMTP

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text email body (optional)
            attachments: List of (filename, file_bytes) tuples
            cc: CC email addresses
            bcc: BCC email addresses

        Returns:
            True if email sent successfully, False otherwise
        """
        if not self.smtp_enabled:
            logger.warning(f"SMTP disabled - would send email to {to_email}: {subject}")
            return True

        if not self.smtp_password:
            logger.error("SMTP password not configured")
            return False

        try:
            # Run the blocking SMTP operation in a thread pool
            result = await asyncio.to_thread(
                self._send_email_sync,
                to_email,
                subject,
                html_body,
                text_body,
                attachments,
                cc,
                bcc
            )
            return result
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}", exc_info=True)
            return False

    def _send_email_sync(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str],
        attachments: Optional[List[tuple[str, bytes]]],
        cc: Optional[List[str]],
        bcc: Optional[List[str]]
    ) -> bool:
        """Synchronous email sending (runs in thread pool)"""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.smtp_from_name} <{self.smtp_from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject

            if cc:
                msg['Cc'] = ', '.join(cc)

            # Add plain text and HTML parts
            if text_body:
                msg.attach(MIMEText(text_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))

            # Add attachments
            if attachments:
                for filename, file_bytes in attachments:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(file_bytes)
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename={filename}'
                    )
                    msg.attach(part)

            # Build recipient list
            recipients = [to_email]
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)

            # Connect and send
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.smtp_use_tls:
                    server.starttls()

                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg, to_addrs=recipients)

            logger.info(f"Email sent successfully to {to_email}: {subject}")
            return True

        except Exception as e:
            logger.error(f"SMTP error sending to {to_email}: {str(e)}", exc_info=True)
            return False

    async def test_connection(self) -> bool:
        """
        Test SMTP connection

        Returns:
            True if connection successful, False otherwise
        """
        if not self.smtp_enabled:
            logger.info("SMTP is disabled")
            return False

        try:
            result = await asyncio.to_thread(self._test_connection_sync)
            return result
        except Exception as e:
            logger.error(f"Failed to test SMTP connection: {str(e)}", exc_info=True)
            return False

    def _test_connection_sync(self) -> bool:
        """Synchronous connection test (runs in thread pool)"""
        try:
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                if self.smtp_use_tls:
                    server.starttls()
                server.login(self.smtp_username, self.smtp_password)

            logger.info("SMTP connection test successful")
            return True

        except Exception as e:
            logger.error(f"SMTP connection test failed: {str(e)}")
            return False


# Global SMTP service instance
smtp_service = SMTPService()
