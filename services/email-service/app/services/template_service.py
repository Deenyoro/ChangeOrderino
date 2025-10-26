"""Email template rendering service"""
from typing import Dict, Any, Optional
from pathlib import Path
from datetime import datetime, timezone
from jinja2 import Environment, FileSystemLoader, select_autoescape
import premailer

from app.config import config
from app.utils.logger import setup_logger

logger = setup_logger(__name__)


class TemplateService:
    """Email template rendering service using Jinja2"""

    def __init__(self):
        template_dir = Path(__file__).parent.parent / "templates"
        self.env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(['html', 'xml'])
        )

        # Add custom filters
        self.env.filters['format_currency'] = self._format_currency
        self.env.filters['format_date'] = self._format_date

    @staticmethod
    def _format_currency(value: float) -> str:
        """Format currency values"""
        return f"${value:,.2f}"

    @staticmethod
    def _format_date(value: Any) -> str:
        """Format date values"""
        if isinstance(value, str):
            return value
        if isinstance(value, datetime):
            return value.strftime("%B %d, %Y")
        return str(value)

    def render_rfco_email(
        self,
        tnm_ticket: Dict[str, Any],
        project: Dict[str, Any],
        approval_link: str,
        company_logo_url: Optional[str] = None,
        template_settings: Optional[Dict[str, str]] = None,
        company_settings: Optional[Dict[str, str]] = None
    ) -> tuple[str, str]:
        """
        Render initial RFCO send email

        Args:
            tnm_ticket: TNM ticket data
            project: Project data
            approval_link: Approval URL
            company_logo_url: Company logo URL (optional)
            template_settings: Email template text overrides (optional)

        Returns:
            Tuple of (html_body, subject)
        """
        try:
            # Use template settings or defaults
            settings = template_settings or {}
            # Use company settings from database or fallback to config
            company = company_settings or {
                'company_name': config.COMPANY_NAME,
                'company_email': config.COMPANY_EMAIL,
                'company_phone': config.COMPANY_PHONE
            }

            subject_template = settings.get('subject', 'RFCO {tnm_number} - {project_name}')

            # Replace variables in subject
            subject = subject_template.format(
                tnm_number=tnm_ticket['tnm_number'],
                project_name=project['name']
            )

            # Replace variables in footer text
            footer_template = settings.get('footer_text',
                'If you have any questions about this change order, please contact us at {company_email} or {company_phone}.')
            footer_text = footer_template.format(
                company_email=company['company_email'],
                company_phone=company['company_phone']
            )

            context = {
                'subject': subject,
                'company_name': company['company_name'],
                'company_email': company['company_email'],
                'company_phone': company['company_phone'],
                'company_logo_url': company_logo_url,
                'tnm_number': tnm_ticket['tnm_number'],
                'rfco_number': tnm_ticket.get('rfco_number'),
                'project_name': project['name'],
                'project_number': project['project_number'],
                'title': tnm_ticket['title'],
                'description': tnm_ticket.get('description'),
                'proposal_date': self._format_date(tnm_ticket['proposal_date']),
                'submitter_name': tnm_ticket['submitter_name'],
                'submitter_email': tnm_ticket['submitter_email'],
                'labor_subtotal': float(tnm_ticket.get('labor_subtotal', 0)),
                'labor_ohp_percent': float(tnm_ticket.get('labor_ohp_percent', 0)),
                'labor_total': float(tnm_ticket.get('labor_total', 0)),
                'material_subtotal': float(tnm_ticket.get('material_subtotal', 0)),
                'material_ohp_percent': float(tnm_ticket.get('material_ohp_percent', 0)),
                'material_total': float(tnm_ticket.get('material_total', 0)),
                'equipment_subtotal': float(tnm_ticket.get('equipment_subtotal', 0)),
                'equipment_ohp_percent': float(tnm_ticket.get('equipment_ohp_percent', 0)),
                'equipment_total': float(tnm_ticket.get('equipment_total', 0)),
                'subcontractor_subtotal': float(tnm_ticket.get('subcontractor_subtotal', 0)),
                'subcontractor_ohp_percent': float(tnm_ticket.get('subcontractor_ohp_percent', 0)),
                'subcontractor_total': float(tnm_ticket.get('subcontractor_total', 0)),
                'proposal_amount': float(tnm_ticket.get('proposal_amount', 0)),
                'approval_link': approval_link,
                # Template settings
                'email_greeting': settings.get('greeting', 'Dear General Contractor,'),
                'email_intro': settings.get('intro', 'Please review the following Request for Change Order (RFCO) for your approval.'),
                'email_button_text': settings.get('button_text', 'Review & Approve RFCO'),
                'email_footer_text': footer_text,
                # Due date (conditional)
                'due_date': self._format_date(tnm_ticket.get('due_date')) if tnm_ticket.get('due_date') else None,
                'show_due_date': settings.get('show_due_date', 'true').lower() == 'true',
                'due_date_label': settings.get('due_date_label', 'Response Due Date:'),
            }

            template = self.env.get_template('rfco_send.html')
            html = template.render(**context)

            # Inline CSS for better email client compatibility
            html = premailer.transform(html)

            logger.info(f"Rendered RFCO email for {tnm_ticket['tnm_number']}")
            return html, subject

        except Exception as e:
            logger.error(f"Failed to render RFCO email: {str(e)}", exc_info=True)
            raise

    def render_reminder_email(
        self,
        tnm_ticket: Dict[str, Any],
        project: Dict[str, Any],
        approval_link: str,
        reminder_number: int,
        days_pending: int,
        company_logo_url: Optional[str] = None,
        template_settings: Optional[Dict[str, str]] = None,
        company_settings: Optional[Dict[str, str]] = None
    ) -> tuple[str, str]:
        """
        Render reminder email

        Args:
            tnm_ticket: TNM ticket data
            project: Project data
            approval_link: Approval URL
            reminder_number: Which reminder this is (1, 2, 3, etc.)
            days_pending: Number of days since initial send
            company_logo_url: Company logo URL (optional)
            template_settings: Email template text overrides (optional)

        Returns:
            Tuple of (html_body, subject)
        """
        try:
            # Use template settings or defaults
            settings = template_settings or {}
            # Use company settings from database or fallback to config
            company = company_settings or {
                'company_name': config.COMPANY_NAME,
                'company_email': config.COMPANY_EMAIL,
                'company_phone': config.COMPANY_PHONE
            }

            subject_template = settings.get('subject', 'REMINDER #{reminder_number}: RFCO {tnm_number} - {project_name}')

            # Replace variables in subject
            subject = subject_template.format(
                reminder_number=reminder_number,
                tnm_number=tnm_ticket['tnm_number'],
                project_name=project['name']
            )

            context = {
                'subject': subject,
                'company_name': company['company_name'],
                'company_email': company['company_email'],
                'company_phone': company['company_phone'],
                'company_logo_url': company_logo_url,
                'tnm_number': tnm_ticket['tnm_number'],
                'rfco_number': tnm_ticket.get('rfco_number'),
                'project_name': project['name'],
                'project_number': project['project_number'],
                'title': tnm_ticket['title'],
                'proposal_date': self._format_date(tnm_ticket['proposal_date']),
                'proposal_amount': float(tnm_ticket.get('proposal_amount', 0)),
                'approval_link': approval_link,
                'reminder_number': reminder_number,
                'days_pending': days_pending,
                # Template settings
                'email_greeting': settings.get('greeting', 'Dear General Contractor,'),
                'email_intro': settings.get('intro', 'This is a friendly reminder that the following Request for Change Order (RFCO) is still pending your review and approval.'),
                'email_button_text': settings.get('button_text', 'Review & Approve RFCO'),
                'email_footer_text': settings.get('footer_text', 'If you need additional details or have questions about this change order, please contact us immediately.'),
                # Due date (conditional)
                'due_date': self._format_date(tnm_ticket.get('due_date')) if tnm_ticket.get('due_date') else None,
                'show_due_date': settings.get('show_due_date', 'true').lower() == 'true',
                'due_date_label': settings.get('due_date_label', 'Response Due Date:'),
            }

            template = self.env.get_template('reminder.html')
            html = template.render(**context)

            # Inline CSS
            html = premailer.transform(html)

            logger.info(f"Rendered reminder #{reminder_number} email for {tnm_ticket['tnm_number']}")
            return html, subject

        except Exception as e:
            logger.error(f"Failed to render reminder email: {str(e)}", exc_info=True)
            raise

    def render_approval_confirmation_email(
        self,
        tnm_ticket: Dict[str, Any],
        project: Dict[str, Any],
        ticket_link: str,
        line_items: Optional[list[Dict[str, Any]]] = None,
        gc_notes: Optional[str] = None,
        company_logo_url: Optional[str] = None,
        template_settings: Optional[Dict[str, str]] = None,
        company_settings: Optional[Dict[str, str]] = None
    ) -> tuple[str, str]:
        """
        Render approval confirmation email (sent to internal team)

        Args:
            tnm_ticket: TNM ticket data
            project: Project data
            ticket_link: URL to view ticket in system
            line_items: List of line item approvals
            gc_notes: Notes from GC
            company_logo_url: Company logo URL (optional)
            template_settings: Email template text overrides (optional)

        Returns:
            Tuple of (html_body, subject)
        """
        try:
            # Use template settings or defaults
            settings = template_settings or {}
            # Use company settings from database or fallback to config
            company = company_settings or {
                'company_name': config.COMPANY_NAME,
                'company_email': config.COMPANY_EMAIL,
                'company_phone': config.COMPANY_PHONE
            }

            status = tnm_ticket.get('status', 'unknown')
            status_label = status.replace('_', ' ').title()

            subject_template = settings.get('subject', 'Change Order {status}: {tnm_number} - {project_name}')
            subject = subject_template.format(
                status=status_label,
                tnm_number=tnm_ticket['tnm_number'],
                project_name=project['name']
            )

            context = {
                'subject': subject,
                'company_name': company['company_name'],
                'company_email': company['company_email'],
                'company_phone': company['company_phone'],
                'company_logo_url': company_logo_url,
                'tnm_number': tnm_ticket['tnm_number'],
                'rfco_number': tnm_ticket.get('rfco_number'),
                'project_name': project['name'],
                'project_number': project['project_number'],
                'title': tnm_ticket['title'],
                'status': status,
                'proposal_amount': float(tnm_ticket.get('proposal_amount', 0)),
                'approved_amount': float(tnm_ticket.get('approved_amount', 0)),
                'response_date': self._format_date(tnm_ticket.get('response_date', datetime.now(timezone.utc))),
                'ticket_link': ticket_link,
                'line_items': line_items or [],
                'gc_notes': gc_notes,
                # Template settings
                'email_intro': settings.get('intro', 'A decision has been made on the following change order.'),
            }

            template = self.env.get_template('approval_confirmation.html')
            html = template.render(**context)

            # Inline CSS
            html = premailer.transform(html)

            logger.info(f"Rendered approval confirmation email for {tnm_ticket['tnm_number']}")
            return html, subject

        except Exception as e:
            logger.error(f"Failed to render approval confirmation email: {str(e)}", exc_info=True)
            raise


# Global template service instance
template_service = TemplateService()
