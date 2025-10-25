"""Helper functions for PDF generation"""
import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


def prepare_ticket_data_for_pdf(ticket: Any) -> Dict[str, Any]:
    """
    Convert TNM ticket model to dictionary for PDF template

    Args:
        ticket: TNMTicket model instance with loaded relationships

    Returns:
        Dictionary with ticket data ready for PDF template rendering
    """
    return {
        'tnm_number': ticket.tnm_number,
        'rfco_number': ticket.rfco_number or '',
        'title': ticket.title,
        'description': ticket.description or '',
        'proposal_date': ticket.proposal_date,
        'submitter_name': ticket.submitter_name,
        'submitter_email': ticket.submitter_email,
        'notes': ticket.notes or '',
        # Labor items
        'labor_items': [
            {
                'description': item.description,
                'hours': item.hours,
                'labor_type': item.labor_type.value if hasattr(item.labor_type, 'value') else str(item.labor_type),
                'rate_per_hour': item.rate_per_hour,
                'subtotal': item.subtotal if item.subtotal is not None else (item.hours * item.rate_per_hour),
            }
            for item in ticket.labor_items
        ],
        # Material items
        'material_items': [
            {
                'description': item.description,
                'quantity': item.quantity,
                'unit': item.unit or 'EA',
                'unit_price': item.unit_price,
                'subtotal': item.subtotal if item.subtotal is not None else (item.quantity * item.unit_price),
            }
            for item in ticket.material_items
        ],
        # Equipment items
        'equipment_items': [
            {
                'description': item.description,
                'quantity': item.quantity,
                'unit': item.unit or 'EA',
                'unit_price': item.unit_price,
                'subtotal': item.subtotal if item.subtotal is not None else (item.quantity * item.unit_price),
            }
            for item in ticket.equipment_items
        ],
        # Subcontractor items
        'subcontractor_items': [
            {
                'description': item.description,
                'subcontractor_name': item.subcontractor_name or 'N/A',
                'proposal_date': item.proposal_date,
                'amount': item.amount,
            }
            for item in ticket.subcontractor_items
        ],
        # Totals with safe defaults
        'labor_subtotal': ticket.labor_subtotal or 0,
        'labor_ohp_percent': ticket.labor_ohp_percent or 0,
        'labor_total': ticket.labor_total or 0,
        'material_subtotal': ticket.material_subtotal or 0,
        'material_ohp_percent': ticket.material_ohp_percent or 0,
        'material_total': ticket.material_total or 0,
        'equipment_subtotal': ticket.equipment_subtotal or 0,
        'equipment_ohp_percent': ticket.equipment_ohp_percent or 0,
        'equipment_total': ticket.equipment_total or 0,
        'subcontractor_subtotal': ticket.subcontractor_subtotal or 0,
        'subcontractor_ohp_percent': ticket.subcontractor_ohp_percent or 0,
        'subcontractor_total': ticket.subcontractor_total or 0,
        'proposal_amount': ticket.proposal_amount or 0,
    }


def prepare_project_data_for_pdf(project: Any) -> Dict[str, Any]:
    """
    Convert Project model to dictionary for PDF template

    Args:
        project: Project model instance

    Returns:
        Dictionary with project data ready for PDF template rendering
    """
    return {
        'name': project.name,
        'project_number': project.project_number,
    }


def sanitize_pdf_filename(filename: str) -> str:
    """
    Sanitize filename for PDF download

    Args:
        filename: Original filename

    Returns:
        Sanitized filename safe for use in HTTP headers
    """
    # Remove or replace problematic characters
    safe_filename = filename.replace('/', '-').replace('\\', '-')
    safe_filename = safe_filename.replace('"', '').replace("'", '')
    safe_filename = safe_filename.replace('\n', '').replace('\r', '')

    return safe_filename
