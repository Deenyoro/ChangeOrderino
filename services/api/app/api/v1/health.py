"""Health check endpoints"""
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings

router = APIRouter()


async def check_database_health(db: AsyncSession):
    """Check database connectivity"""
    try:
        result = await db.execute(text("SELECT version()"))
        version = result.scalar()
        return {
            "status": "healthy",
            "version": version.split()[1] if version else "unknown"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


async def check_redis_health():
    """Check Redis connectivity"""
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, decode_responses=True)
        r.ping()
        info = r.info('server')
        return {
            "status": "healthy",
            "version": info.get('redis_version', 'unknown')
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


async def check_minio_health():
    """Check MinIO connectivity"""
    try:
        from minio import Minio
        # Strip protocol from URL (Minio client expects just host:port)
        minio_endpoint = settings.MINIO_SERVER_URL.replace('http://', '').replace('https://', '')
        client = Minio(
            minio_endpoint,
            access_key=settings.MINIO_ROOT_USER,
            secret_key=settings.MINIO_ROOT_PASSWORD,
            secure=settings.MINIO_SECURE
        )
        # Check if bucket exists
        exists = client.bucket_exists(settings.MINIO_BUCKET_NAME)
        return {
            "status": "healthy" if exists else "warning",
            "bucket_exists": exists
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@router.get("/health")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    }


@router.get("/health/detailed")
async def detailed_health_check(db: AsyncSession = Depends(get_db)):
    """Detailed health check with service status"""
    db_health = await check_database_health(db)
    redis_health = await check_redis_health()
    minio_health = await check_minio_health()

    # Overall status is healthy only if all services are healthy
    all_healthy = all(
        service["status"] == "healthy"
        for service in [db_health, redis_health, minio_health]
    )

    return {
        "status": "healthy" if all_healthy else "unhealthy",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "services": {
            "database": db_health,
            "redis": redis_health,
            "minio": minio_health
        },
        "system_info": {
            "application": settings.APP_NAME,
            "database_version": f"PostgreSQL {db_health.get('version', 'unknown')}",
            "redis_version": f"Redis {redis_health.get('version', 'unknown')}"
        }
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
