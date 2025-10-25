"""PDF Generation Service for RFCO Documents"""
import logging
from weasyprint import HTML, CSS
from jinja2 import Environment, FileSystemLoader
from pathlib import Path
from decimal import Decimal
from datetime import date, datetime
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class PDFGenerator:
    """Generate PDF documents for RFCOs"""

    def __init__(self):
        template_dir = Path(__file__).parent.parent / "templates"

        # Ensure template directory exists
        if not template_dir.exists():
            logger.warning(f"Templates directory does not exist: {template_dir}")
            template_dir.mkdir(parents=True, exist_ok=True)

        self.template_dir = template_dir
        self.env = Environment(loader=FileSystemLoader(str(template_dir)))

        # Custom filters
        self.env.filters['currency'] = self._currency_filter
        self.env.filters['date'] = self._date_filter

        logger.info(f"PDFGenerator initialized with template dir: {template_dir}")

    @staticmethod
    def _currency_filter(value: Decimal | float | int | None) -> str:
        """Format as currency"""
        if value is None:
            return "$0.00"
        return f"${float(value):,.2f}"

    @staticmethod
    def _date_filter(value: date | str | datetime | None) -> str:
        """Format date"""
        if value is None:
            return ""
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value.replace('Z', '+00:00')).date()
            except ValueError:
                return value
        if isinstance(value, datetime):
            value = value.date()
        return value.strftime("%B %d, %Y")

    def generate_rfco_pdf(
        self,
        tnm_ticket: dict,
        project: dict,
        output_path: Optional[str] = None,
    ) -> bytes:
        """
        Generate RFCO PDF

        Args:
            tnm_ticket: TNM ticket data (dict)
            project: Project data (dict)
            output_path: Optional file path to save PDF

        Returns:
            bytes: PDF content

        Raises:
            ValueError: If required data is missing
            RuntimeError: If PDF generation fails
        """
        try:
            # Validate required fields
            if not tnm_ticket:
                raise ValueError("TNM ticket data is required")
            if not project:
                raise ValueError("Project data is required")

            required_ticket_fields = ['tnm_number', 'title', 'proposal_amount']
            for field in required_ticket_fields:
                if field not in tnm_ticket:
                    raise ValueError(f"Missing required ticket field: {field}")

            required_project_fields = ['name', 'project_number']
            for field in required_project_fields:
                if field not in project:
                    raise ValueError(f"Missing required project field: {field}")

            logger.info(f"Generating PDF for TNM ticket: {tnm_ticket.get('tnm_number')}")

            # Render HTML template
            template = self.env.get_template('rfco_pdf.html')

            # Add current date/time for footer
            now = datetime.now()

            html_content = template.render(
                company_name=settings.COMPANY_NAME,
                company_email=settings.COMPANY_EMAIL,
                company_phone=settings.COMPANY_PHONE,
                tnm_ticket=tnm_ticket,
                project=project,
                now=now,
            )

            logger.debug(f"Rendered HTML template, length: {len(html_content)} chars")

            # Generate PDF
            pdf = HTML(string=html_content).write_pdf()

            logger.info(f"PDF generated successfully, size: {len(pdf)} bytes")

            # Optionally save to file
            if output_path:
                output_file = Path(output_path)
                output_file.parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, 'wb') as f:
                    f.write(pdf)
                logger.info(f"PDF saved to: {output_path}")

            return pdf

        except Exception as e:
            logger.error(f"Error generating PDF: {str(e)}", exc_info=True)
            raise RuntimeError(f"Failed to generate PDF: {str(e)}") from e


# Singleton instance
pdf_generator = PDFGenerator()
