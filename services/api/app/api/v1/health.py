"""Health check endpoints"""
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    }


@router.get("/health/db")
async def health_check_db(db: AsyncSession = Depends(get_db)):
    """Database health check"""
    try:
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }


@router.get("/health/pdf")
async def health_check_pdf():
    """PDF generation service health check"""
    try:
        from app.services.pdf_generator import pdf_generator
        from datetime import date

        # Check template directory exists
        template_dir = pdf_generator.template_dir
        if not template_dir.exists():
            return {
                "status": "unhealthy",
                "service": "pdf_generator",
                "error": f"Template directory not found: {template_dir}"
            }

        # Check template file exists
        template_file = template_dir / "rfco_pdf.html"
        if not template_file.exists():
            return {
                "status": "unhealthy",
                "service": "pdf_generator",
                "error": f"Template file not found: {template_file}"
            }

        # Try a minimal PDF generation
        minimal_ticket = {
            'tnm_number': 'HEALTH-CHECK',
            'title': 'Health Check',
            'proposal_amount': 0,
            'proposal_date': date.today(),
            'submitter_name': 'System',
            'submitter_email': 'system@example.com',
            'labor_items': [],
            'material_items': [],
            'equipment_items': [],
            'subcontractor_items': [],
            'labor_subtotal': 0,
            'labor_ohp_percent': 0,
            'labor_total': 0,
            'material_subtotal': 0,
            'material_ohp_percent': 0,
            'material_total': 0,
            'equipment_subtotal': 0,
            'equipment_ohp_percent': 0,
            'equipment_total': 0,
            'subcontractor_subtotal': 0,
            'subcontractor_ohp_percent': 0,
            'subcontractor_total': 0,
        }

        minimal_project = {
            'name': 'Health Check',
            'project_number': 'HEALTH-CHECK',
        }

        pdf_content = pdf_generator.generate_rfco_pdf(minimal_ticket, minimal_project)

        return {
            "status": "healthy",
            "service": "pdf_generator",
            "template_dir": str(template_dir),
            "template_file": str(template_file),
            "test_pdf_size": len(pdf_content)
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "pdf_generator",
            "error": str(e)
        }
