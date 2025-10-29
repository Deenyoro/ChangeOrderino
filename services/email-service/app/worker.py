"""Email worker job processors"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import selectinload
import asyncio

from app.config import config
from app.utils.logger import setup_logger
from app.services.smtp_service import smtp_service
from app.services.template_service import template_service
from app.services.reminder_scheduler import reminder_scheduler
from app.models import TNMTicket, Project, EmailLog, TNMStatus, AppSettings

logger = setup_logger(__name__)

# Create async engine for database access
engine = create_async_engine(
    config.DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_setting_value(session: AsyncSession, key: str, default: str = "") -> str:
    """
    Fetch a setting value from app_settings

    Args:
        session: Database session
        key: Setting key
        default: Default value if not found

    Returns:
        Setting value or default
    """
    try:
        stmt = select(AppSettings).where(AppSettings.key == key)
        result = await session.execute(stmt)
        setting = result.scalar_one_or_none()

        if setting and setting.value:
            return setting.value
        return default

    except Exception as e:
        logger.error(f"Failed to fetch setting {key}: {str(e)}", exc_info=True)
        return default


async def get_company_logo_url(session: AsyncSession) -> Optional[str]:
    """
    Fetch company logo URL from app_settings and convert to absolute URL

    Args:
        session: Database session

    Returns:
        Absolute logo URL or None if not set
    """
    value = await get_setting_value(session, 'COMPANY_LOGO_URL')
    if not value:
        return None

    # Convert relative URL to absolute URL for email compatibility
    if value.startswith('/'):
        # Remove trailing slash from FRONTEND_URL if present
        base_url = config.FRONTEND_URL.rstrip('/')
        return f"{base_url}{value}"

    # Already absolute URL
    return value


async def get_company_settings(session: AsyncSession) -> Dict[str, str]:
    """
    Fetch company settings from app_settings

    Args:
        session: Database session

    Returns:
        Dictionary of company settings
    """
    return {
        'company_name': await get_setting_value(session, 'COMPANY_NAME', config.COMPANY_NAME),
        'company_email': await get_setting_value(session, 'COMPANY_EMAIL', config.COMPANY_EMAIL),
        'company_phone': await get_setting_value(session, 'COMPANY_PHONE', config.COMPANY_PHONE),
    }


async def get_email_template_settings(session: AsyncSession, email_type: str) -> Dict[str, str]:
    """
    Fetch email template settings from app_settings

    Args:
        session: Database session
        email_type: Type of email ('rfco', 'reminder', 'approval')

    Returns:
        Dictionary of template settings
    """
    # Common settings for all email types
    common_settings = {
        'show_due_date': await get_setting_value(session, 'EMAIL_SHOW_DUE_DATE', 'true'),
        'due_date_label': await get_setting_value(session, 'EMAIL_DUE_DATE_LABEL', 'Response Due Date:'),
    }

    if email_type == 'rfco':
        settings = {
            'subject': await get_setting_value(session, 'EMAIL_RFCO_SUBJECT', 'RFCO {tnm_number} - {project_name}'),
            'greeting': await get_setting_value(session, 'EMAIL_RFCO_GREETING', 'Dear General Contractor,'),
            'intro': await get_setting_value(session, 'EMAIL_RFCO_INTRO',
                'Please review the following Request for Change Order (RFCO) for your approval.'),
            'button_text': await get_setting_value(session, 'EMAIL_RFCO_BUTTON_TEXT', 'Review & Approve RFCO'),
            'footer_text': await get_setting_value(session, 'EMAIL_RFCO_FOOTER_TEXT',
                'If you have any questions about this change order, please contact us at {company_email} or {company_phone}.'),
        }
        settings.update(common_settings)
        return settings
    elif email_type == 'reminder':
        settings = {
            'subject': await get_setting_value(session, 'EMAIL_REMINDER_SUBJECT',
                'REMINDER #{reminder_number}: RFCO {tnm_number} - {project_name}'),
            'greeting': await get_setting_value(session, 'EMAIL_REMINDER_GREETING', 'Dear General Contractor,'),
            'intro': await get_setting_value(session, 'EMAIL_REMINDER_INTRO',
                'This is a friendly reminder that the following Request for Change Order (RFCO) is still pending your review and approval.'),
            'button_text': await get_setting_value(session, 'EMAIL_REMINDER_BUTTON_TEXT', 'Review & Approve RFCO'),
            'footer_text': await get_setting_value(session, 'EMAIL_REMINDER_FOOTER_TEXT',
                'If you need additional details or have questions about this change order, please contact us immediately.'),
        }
        settings.update(common_settings)
        return settings
    elif email_type == 'approval':
        return {
            'subject': await get_setting_value(session, 'EMAIL_APPROVAL_SUBJECT',
                'Change Order {status}: {tnm_number} - {project_name}'),
            'intro': await get_setting_value(session, 'EMAIL_APPROVAL_INTRO',
                'A decision has been made on the following change order.'),
        }
    return {}


async def get_tnm_ticket_with_project(
    session: AsyncSession,
    tnm_ticket_id: str
) -> Optional[Tuple[TNMTicket, Project]]:
    """
    Fetch TNM ticket with related project data

    Args:
        session: Database session
        tnm_ticket_id: TNM ticket UUID

    Returns:
        Tuple of (tnm_ticket, project) or None if not found
    """
    try:
        stmt = (
            select(TNMTicket)
            .options(selectinload(TNMTicket.project))
            .where(TNMTicket.id == UUID(tnm_ticket_id))
        )
        result = await session.execute(stmt)
        ticket = result.scalar_one_or_none()

        if not ticket or not ticket.project:
            logger.error(f"Ticket {tnm_ticket_id} or its project not found")
            return None

        return ticket, ticket.project

    except Exception as e:
        logger.error(f"Failed to fetch ticket {tnm_ticket_id}: {str(e)}", exc_info=True)
        return None


def model_to_dict(obj: Any) -> Dict[str, Any]:
    """Convert SQLAlchemy model to dictionary"""
    if obj is None:
        return {}

    result = {}
    for column in obj.__table__.columns:
        value = getattr(obj, column.name)
        # Convert enums to their value
        if hasattr(value, 'value'):
            value = value.value
        result[column.name] = value
    return result


async def log_email_to_db(
    session: AsyncSession,
    tnm_ticket_id: str,
    to_email: str,
    subject: str,
    html_body: str,
    email_type: str,
    status: str,
    error_message: Optional[str] = None
) -> bool:
    """
    Log email to database

    Args:
        session: Database session
        tnm_ticket_id: TNM ticket UUID
        to_email: Recipient email
        subject: Email subject
        html_body: HTML body
        email_type: Type of email
        status: Email status
        error_message: Error message if failed

    Returns:
        True if logged successfully
    """
    try:
        email_log = EmailLog(
            tnm_ticket_id=UUID(tnm_ticket_id),
            to_email=to_email,
            from_email=config.SMTP_FROM_EMAIL,
            subject=subject,
            body_html=html_body,
            email_type=email_type,
            status=status,
            error_message=error_message,
            sent_at=datetime.now(timezone.utc) if status == 'sent' else None
        )

        session.add(email_log)
        await session.commit()

        logger.info(f"Logged {email_type} email to {to_email} with status {status}")
        return True

    except Exception as e:
        logger.error(f"Failed to log email: {str(e)}", exc_info=True)
        await session.rollback()
        return False


async def update_ticket_email_tracking(
    session: AsyncSession,
    tnm_ticket_id: str,
    is_reminder: bool = False
) -> bool:
    """
    Update email tracking fields on TNM ticket

    Args:
        session: Database session
        tnm_ticket_id: TNM ticket UUID
        is_reminder: Whether this was a reminder email

    Returns:
        True if updated successfully
    """
    try:
        stmt = select(TNMTicket).where(TNMTicket.id == UUID(tnm_ticket_id))
        result = await session.execute(stmt)
        ticket = result.scalar_one_or_none()

        if not ticket:
            logger.error(f"Ticket {tnm_ticket_id} not found for tracking update")
            return False

        current_time = datetime.now(timezone.utc)

        if is_reminder:
            ticket.reminder_count = (ticket.reminder_count or 0) + 1
            ticket.last_reminder_sent_at = current_time
        else:
            ticket.email_sent_count = (ticket.email_sent_count or 0) + 1
            ticket.last_email_sent_at = current_time
            # Update status from ready_to_send to sent
            if ticket.status == TNMStatus.ready_to_send:
                ticket.status = TNMStatus.sent

        ticket.updated_at = current_time

        await session.commit()
        logger.info(f"Updated tracking for ticket {tnm_ticket_id}, is_reminder={is_reminder}")
        return True

    except Exception as e:
        logger.error(f"Failed to update ticket tracking: {str(e)}", exc_info=True)
        await session.rollback()
        return False


def send_rfco_email(
    tnm_ticket_id: str,
    to_email: str,
    approval_token: str,
    retry_count: int = 0,
    pdf_base64: str = None
) -> bool:
    """
    Send RFCO email (job function - must be synchronous for RQ)

    Args:
        tnm_ticket_id: TNM ticket UUID
        to_email: Recipient email
        approval_token: Approval token for link
        retry_count: Current retry count
        pdf_base64: Base64-encoded PDF bytes to attach

    Returns:
        True if sent successfully
    """
    return asyncio.run(_send_rfco_email_async(tnm_ticket_id, to_email, approval_token, retry_count, pdf_base64))


async def _send_rfco_email_async(
    tnm_ticket_id: str,
    to_email: str,
    approval_token: str,
    retry_count: int,
    pdf_base64: str = None
) -> bool:
    """Async implementation of send_rfco_email"""
    logger.info(f"Processing RFCO email job for ticket {tnm_ticket_id}")

    async with AsyncSessionLocal() as session:
        try:
            # Fetch ticket and project data
            data = await get_tnm_ticket_with_project(session, tnm_ticket_id)
            if not data:
                logger.error(f"Ticket {tnm_ticket_id} not found")
                return False

            ticket, project = data

            # Convert to dicts for template
            ticket_dict = model_to_dict(ticket)
            project_dict = model_to_dict(project)

            # Build approval link
            approval_link = f"{config.FRONTEND_URL}/approve/{approval_token}"

            # Fetch company logo URL
            company_logo_url = await get_company_logo_url(session)

            # Fetch company settings from database
            company_settings = await get_company_settings(session)

            # Fetch email template settings
            template_settings = await get_email_template_settings(session, 'rfco')

            # Render email
            html_body, subject = template_service.render_rfco_email(
                tnm_ticket=ticket_dict,
                project=project_dict,
                approval_link=approval_link,
                company_logo_url=company_logo_url,
                template_settings=template_settings,
                company_settings=company_settings
            )

            # Prepare PDF attachment if provided
            attachments = None
            if pdf_base64:
                try:
                    import base64
                    pdf_bytes = base64.b64decode(pdf_base64)
                    tnm_number = ticket_dict.get('tnm_number', 'RFCO')
                    filename = f"RFCO-{tnm_number}.pdf"
                    attachments = [(filename, pdf_bytes)]
                    logger.info(f"PDF attachment prepared: {filename} ({len(pdf_bytes)} bytes)")
                except Exception as e:
                    logger.error(f"Failed to decode PDF attachment: {str(e)}")
                    # Continue without attachment

            # Send email
            success = await smtp_service.send_email(
                to_email=to_email,
                subject=subject,
                html_body=html_body,
                attachments=attachments
            )

            # Log to database
            await log_email_to_db(
                session=session,
                tnm_ticket_id=tnm_ticket_id,
                to_email=to_email,
                subject=subject,
                html_body=html_body,
                email_type='initial_send',
                status='sent' if success else 'failed',
                error_message=None if success else 'SMTP send failed'
            )

            if success:
                # Update ticket tracking
                await update_ticket_email_tracking(session, tnm_ticket_id, is_reminder=False)

                # Schedule first reminder if enabled
                if config.REMINDER_ENABLED:
                    reminder_scheduler.schedule_first_reminder(
                        tnm_ticket_id=tnm_ticket_id,
                        to_email=to_email,
                        approval_token=approval_token
                    )

                logger.info(f"✓ Successfully sent RFCO email for ticket {tnm_ticket_id}")
                return True
            else:
                # FAILED - Retry up to 3 times with exponential backoff
                logger.error(f"✗ Failed to send RFCO email for ticket {tnm_ticket_id} (attempt {retry_count + 1})")

                if retry_count < 3:
                    # Exponential backoff: 5 min, 15 min, 30 min
                    delay_minutes = [5, 15, 30][retry_count]
                    retry_time = datetime.now(timezone.utc) + timedelta(minutes=delay_minutes)

                    # Schedule retry
                    reminder_scheduler.scheduler.enqueue_at(
                        retry_time,
                        'app.worker.send_rfco_email',
                        tnm_ticket_id=tnm_ticket_id,
                        to_email=to_email,
                        approval_token=approval_token,
                        retry_count=retry_count + 1,
                        pdf_base64=pdf_base64,
                        timeout='10m'
                    )
                    logger.warning(f"Scheduled RFCO email retry #{retry_count + 1} in {delay_minutes} minutes")
                else:
                    logger.error(f"Maximum retries reached for RFCO email {tnm_ticket_id} - FAILED PERMANENTLY")

                return False

        except Exception as e:
            logger.error(f"Error processing RFCO email job: {str(e)}", exc_info=True)
            return False


def send_reminder_email(
    tnm_ticket_id: str,
    to_email: str,
    approval_token: str,
    reminder_number: int
) -> bool:
    """
    Send reminder email (job function - must be synchronous for RQ)

    Args:
        tnm_ticket_id: TNM ticket UUID
        to_email: Recipient email
        approval_token: Approval token for link
        reminder_number: Which reminder this is

    Returns:
        True if sent successfully
    """
    return asyncio.run(_send_reminder_email_async(tnm_ticket_id, to_email, approval_token, reminder_number))


async def _send_reminder_email_async(
    tnm_ticket_id: str,
    to_email: str,
    approval_token: str,
    reminder_number: int
) -> bool:
    """Async implementation of send_reminder_email"""
    logger.info(f"Processing reminder #{reminder_number} email job for ticket {tnm_ticket_id}")

    async with AsyncSessionLocal() as session:
        try:
            # Fetch ticket and project data
            data = await get_tnm_ticket_with_project(session, tnm_ticket_id)
            if not data:
                logger.error(f"Ticket {tnm_ticket_id} not found")
                return False

            ticket, project = data

            # Determine if we should send reminder based on flags and status
            should_send = False
            stop_reason = None

            # If send_reminders_until_paid is enabled
            if ticket.send_reminders_until_paid:
                if ticket.paid_date is not None:
                    stop_reason = "ticket is paid"
                else:
                    should_send = True
            # If send_reminders_until_accepted is enabled (but not until paid)
            elif ticket.send_reminders_until_accepted:
                if ticket.status in [TNMStatus.approved, TNMStatus.partially_approved]:
                    stop_reason = "ticket is accepted"
                elif ticket.status in [TNMStatus.denied, TNMStatus.cancelled]:
                    stop_reason = f"ticket is {ticket.status.value}"
                else:
                    should_send = True
            # Default behavior: only send if still pending (sent/viewed status)
            else:
                if ticket.status in [TNMStatus.sent, TNMStatus.viewed]:
                    should_send = True
                else:
                    stop_reason = f"ticket status is {ticket.status.value} (already resolved)"

            # If we shouldn't send, log and return
            if not should_send:
                logger.info(
                    f"Skipping reminder #{reminder_number} for ticket {tnm_ticket_id}: {stop_reason}"
                )
                return True

            # Convert to dicts for template
            ticket_dict = model_to_dict(ticket)
            project_dict = model_to_dict(project)

            # Calculate days pending
            created_at = ticket.created_at
            days_pending = (datetime.now(timezone.utc) - created_at).days

            # Build approval link
            approval_link = f"{config.FRONTEND_URL}/approve/{approval_token}"

            # Fetch company logo URL
            company_logo_url = await get_company_logo_url(session)

            # Fetch company settings from database
            company_settings = await get_company_settings(session)

            # Fetch email template settings
            template_settings = await get_email_template_settings(session, 'reminder')

            # Render email
            html_body, subject = template_service.render_reminder_email(
                tnm_ticket=ticket_dict,
                project=project_dict,
                approval_link=approval_link,
                reminder_number=reminder_number,
                days_pending=days_pending,
                company_logo_url=company_logo_url,
                template_settings=template_settings,
                company_settings=company_settings
            )

            # Send email
            success = await smtp_service.send_email(
                to_email=to_email,
                subject=subject,
                html_body=html_body
            )

            # Log to database
            await log_email_to_db(
                session=session,
                tnm_ticket_id=tnm_ticket_id,
                to_email=to_email,
                subject=subject,
                html_body=html_body,
                email_type='reminder',
                status='sent' if success else 'failed',
                error_message=None if success else 'SMTP send failed'
            )

            if success:
                # Update ticket tracking
                await update_ticket_email_tracking(session, tnm_ticket_id, is_reminder=True)

                # Schedule next reminder if not at max (or if auto-reminders are enabled)
                should_schedule_next = False

                # If auto-reminder flags are set, ignore max retries limit
                if ticket.send_reminders_until_accepted or ticket.send_reminders_until_paid:
                    should_schedule_next = True
                    logger.info(f"Auto-reminders enabled for ticket {tnm_ticket_id}, scheduling next reminder")
                # Otherwise, respect max retries limit (0 means infinite)
                elif config.REMINDER_MAX_RETRIES == 0 or reminder_number < config.REMINDER_MAX_RETRIES:
                    should_schedule_next = True

                if should_schedule_next:
                    # Bypass max check if auto-reminders are enabled
                    bypass_max = ticket.send_reminders_until_accepted or ticket.send_reminders_until_paid
                    reminder_scheduler.schedule_reminder(
                        tnm_ticket_id=tnm_ticket_id,
                        to_email=to_email,
                        approval_token=approval_token,
                        reminder_number=reminder_number + 1,
                        bypass_max_check=bypass_max
                    )
                    logger.info(f"Scheduled reminder #{reminder_number + 1} for ticket {tnm_ticket_id} (bypass_max={bypass_max})")
                else:
                    logger.info(f"Max reminders ({config.REMINDER_MAX_RETRIES}) reached for ticket {tnm_ticket_id}")

                logger.info(f"✓ Successfully sent reminder #{reminder_number} for ticket {tnm_ticket_id}")
                return True
            else:
                # FAILED - Retry the same reminder after 1 hour (up to 3 attempts)
                logger.error(f"✗ Failed to send reminder #{reminder_number} for ticket {tnm_ticket_id}")

                # For critical reminders (auto-reminders), retry after 1 hour
                if (ticket.send_reminders_until_accepted or ticket.send_reminders_until_paid) and reminder_number <= 100:
                    retry_time = datetime.now(timezone.utc) + timedelta(hours=1)
                    reminder_scheduler.schedule_reminder(
                        tnm_ticket_id=tnm_ticket_id,
                        to_email=to_email,
                        approval_token=approval_token,
                        reminder_number=reminder_number,  # Same number = retry
                        schedule_time=retry_time,
                        bypass_max_check=True
                    )
                    logger.warning(f"Scheduled retry for failed reminder #{reminder_number} in 1 hour")

                return False

        except Exception as e:
            logger.error(f"Error processing reminder email job: {str(e)}", exc_info=True)
            return False


def send_approval_confirmation_email(
    tnm_ticket_id: str,
    internal_emails: list[str]
) -> bool:
    """
    Send approval confirmation email to internal team (job function - must be synchronous for RQ)

    Args:
        tnm_ticket_id: TNM ticket UUID
        internal_emails: List of internal team emails

    Returns:
        True if sent successfully
    """
    return asyncio.run(_send_approval_confirmation_email_async(tnm_ticket_id, internal_emails))


async def _send_approval_confirmation_email_async(
    tnm_ticket_id: str,
    internal_emails: list[str]
) -> bool:
    """Async implementation of send_approval_confirmation_email"""
    logger.info(f"Processing approval confirmation email job for ticket {tnm_ticket_id}")

    async with AsyncSessionLocal() as session:
        try:
            # Fetch ticket and project data
            data = await get_tnm_ticket_with_project(session, tnm_ticket_id)
            if not data:
                logger.error(f"Ticket {tnm_ticket_id} not found")
                return False

            ticket, project = data

            # Convert to dicts for template
            ticket_dict = model_to_dict(ticket)
            project_dict = model_to_dict(project)

            # Build ticket link
            ticket_link = f"{config.API_BASE_URL}/tickets/{tnm_ticket_id}"

            # Fetch company logo URL
            company_logo_url = await get_company_logo_url(session)

            # Fetch company settings from database
            company_settings = await get_company_settings(session)

            # Fetch email template settings
            template_settings = await get_email_template_settings(session, 'approval')

            # Render email
            html_body, subject = template_service.render_approval_confirmation_email(
                tnm_ticket=ticket_dict,
                project=project_dict,
                ticket_link=ticket_link,
                company_logo_url=company_logo_url,
                template_settings=template_settings,
                company_settings=company_settings
            )

            # Send to each internal email
            all_success = True
            for email in internal_emails:
                success = await smtp_service.send_email(
                    to_email=email,
                    subject=subject,
                    html_body=html_body
                )

                # Log to database
                await log_email_to_db(
                    session=session,
                    tnm_ticket_id=tnm_ticket_id,
                    to_email=email,
                    subject=subject,
                    html_body=html_body,
                    email_type='approval_confirmation',
                    status='sent' if success else 'failed',
                    error_message=None if success else 'SMTP send failed'
                )

                if not success:
                    all_success = False

            if all_success:
                logger.info(f"✓ Successfully sent approval confirmation emails for ticket {tnm_ticket_id}")
            else:
                logger.warning(f"⚠ Some approval confirmation emails failed for ticket {tnm_ticket_id}")

            return all_success

        except Exception as e:
            logger.error(f"Error processing approval confirmation email job: {str(e)}", exc_info=True)
            return False
