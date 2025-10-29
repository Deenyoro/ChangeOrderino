#!/usr/bin/env python3
"""Add total_labor_hours field to TNM tickets"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
import os

# Add app to path
import sys
from pathlib import Path
sys.path.insert(0, "/app")

from app.core.config import settings

async def add_total_labor_hours_field():
    """Add total_labor_hours field to tnm_tickets table"""

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
        try:
            # Check if column already exists
            result = await db.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'tnm_tickets'
                AND column_name = 'total_labor_hours'
            """))
            existing_columns = [row[0] for row in result.fetchall()]

            if 'total_labor_hours' in existing_columns:
                print("  total_labor_hours column already exists")
                return

            print("Adding total_labor_hours column to tnm_tickets...")

            # Add total_labor_hours column
            await db.execute(text("""
                ALTER TABLE tnm_tickets
                ADD COLUMN total_labor_hours NUMERIC(10, 2) DEFAULT 0.00
            """))
            print("  ✓ Added total_labor_hours column")

            # Calculate and populate total_labor_hours for existing tickets
            await db.execute(text("""
                UPDATE tnm_tickets
                SET total_labor_hours = (
                    SELECT COALESCE(SUM(hours), 0)
                    FROM labor_items
                    WHERE labor_items.tnm_ticket_id = tnm_tickets.id
                )
            """))
            print("  ✓ Populated total_labor_hours for existing tickets")

            await db.commit()
            print("\n✅ Successfully added total_labor_hours field to tnm_tickets table")

        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error adding total_labor_hours field: {str(e)}")
            raise

    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(add_total_labor_hours_field())
