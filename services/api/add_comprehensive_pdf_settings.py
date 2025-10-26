#!/usr/bin/env python3
"""Add comprehensive PDF settings to database"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
import os

# Add app to path
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "app"))

from app.models.app_settings import AppSettings
from app.core.config import settings

async def add_comprehensive_pdf_settings():
    """Add comprehensive PDF customization settings"""

    # Create engine
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
    )

    AsyncSessionLocal = async_sessionmaker(
        engine,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async with AsyncSessionLocal() as db:
        # Define comprehensive PDF settings
        new_settings = [
            # Header Settings
            {
                "key": "PDF_HEADER_SHOW_COMPANY_INFO",
                "value": "true",
                "category": "pdf",
                "data_type": "boolean",
                "description": "Show company name, email, and phone in PDF header"
            },
            {
                "key": "PDF_DOCUMENT_TITLE",
                "value": "REQUEST FOR CHANGE ORDER (RFCO)",
                "category": "pdf",
                "data_type": "string",
                "description": "Main document title displayed below header"
            },
            # Color Settings
            {
                "key": "PDF_PRIMARY_COLOR",
                "value": "#1d4ed8",
                "category": "pdf",
                "data_type": "string",
                "description": "Primary color for header border, section titles (hex color code)"
            },
            # Section Title Settings
            {
                "key": "PDF_SHOW_PROJECT_INFO_SECTION",
                "value": "true",
                "category": "pdf",
                "data_type": "boolean",
                "description": "Show 'Project Information' section"
            },
            {
                "key": "PDF_SHOW_NOTES_SECTION",
                "value": "true",
                "category": "pdf",
                "data_type": "boolean",
                "description": "Show 'Notes' section (if notes exist)"
            },
            {
                "key": "PDF_SHOW_SIGNATURE_SECTION",
                "value": "true",
                "category": "pdf",
                "data_type": "boolean",
                "description": "Show signature section at bottom"
            },
            {
                "key": "PDF_SIGNATURE_TITLE",
                "value": "General Contractor Approval:",
                "category": "pdf",
                "data_type": "string",
                "description": "Title for signature section"
            },
        ]

        added = 0
        updated = 0
        for setting_data in new_settings:
            # Check if setting already exists
            result = await db.execute(
                select(AppSettings).where(AppSettings.key == setting_data['key'])
            )
            existing = result.scalar_one_or_none()

            if not existing:
                setting = AppSettings(**setting_data)
                db.add(setting)
                added += 1
                print(f"✓ Added setting: {setting_data['key']}")
            else:
                print(f"  Setting already exists: {setting_data['key']}")

        if added > 0:
            await db.commit()
            print(f"\n✅ Added {added} new PDF settings")
        else:
            print("\n✅ All PDF settings already exist")

    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(add_comprehensive_pdf_settings())
