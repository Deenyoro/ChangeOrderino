"""
ChangeOrderino API - Main FastAPI Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db, close_db, AsyncSessionLocal
from app.core.settings_init import initialize_settings_from_env
from app.api.v1 import (
    projects,
    tnm_tickets,
    approvals,
    assets,
    health,
    audit,
    dashboard,
    line_items,
    email_health,
    settings as settings_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print(f"🚀 Starting {settings.APP_NAME} v{settings.VERSION}")
    print(f"📝 Environment: {settings.ENVIRONMENT}")
    print(f"🔐 Auth Enabled: {settings.AUTH_ENABLED}")

    # Initialize database
    await init_db()
    print("✅ Database initialized")

    # Initialize settings from .env (first run only)
    async with AsyncSessionLocal() as db:
        await initialize_settings_from_env(db)

    # Check email service configuration
    print(f"📧 Email Service: {'Enabled' if settings.SMTP_ENABLED else 'Disabled'}")
    if settings.SMTP_ENABLED:
        print(f"   SMTP: {settings.SMTP_HOST}:{settings.SMTP_PORT}")
        print(f"   From: {settings.SMTP_FROM_EMAIL}")
    print(f"🔔 Reminders: {'Enabled' if settings.REMINDER_ENABLED else 'Disabled'}")
    if settings.REMINDER_ENABLED:
        print(f"   Interval: {settings.REMINDER_INTERVAL_DAYS} days")
        print(f"   Max: {settings.REMINDER_MAX_RETRIES} reminders")

    yield

    # Shutdown
    await close_db()
    print("👋 Shutting down")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Construction Change Order Management System",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

# ============ MIDDLEWARE ============

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ============ ROUTES ============

# Health check
app.include_router(health.router, tags=["Health"])

# API v1
app.include_router(projects.router, prefix="/v1/projects", tags=["Projects"])
app.include_router(tnm_tickets.router, prefix="/v1/tnm-tickets", tags=["TNM Tickets"])
app.include_router(line_items.router, prefix="/v1/line-items", tags=["Line Items"])
app.include_router(approvals.router, prefix="/v1/approvals", tags=["Approvals"])
app.include_router(assets.router, prefix="/v1/assets", tags=["Assets"])
app.include_router(audit.router, prefix="/v1/audit", tags=["Audit Logs"])
app.include_router(dashboard.router, prefix="/v1/dashboard", tags=["Dashboard"])
app.include_router(email_health.router, prefix="/v1", tags=["Email Service"])
app.include_router(settings_router.router, prefix="/v1", tags=["Settings"])


# ============ ERROR HANDLERS ============

@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"detail": "Resource not found"}
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# ============ ROOT ============

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if settings.ENVIRONMENT != "production" else None,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.ENVIRONMENT == "development",
    )
