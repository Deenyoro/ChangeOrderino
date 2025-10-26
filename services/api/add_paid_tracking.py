#!/usr/bin/env python3
"""Add payment tracking fields to TNM tickets"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
import os

# Add app to path
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "app"))

from app.core.config import settings

async def add_paid_tracking_fields():
    """Add payment tracking fields to tnm_tickets table"""

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
            # Check if columns already exist
            result = await db.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'tnm_tickets'
                AND column_name IN ('is_paid', 'paid_date', 'paid_by')
            """))
            existing_columns = [row[0] for row in result.fetchall()]

            if 'is_paid' in existing_columns:
                print("  Payment tracking columns already exist")
                return

            print("Adding payment tracking columns to tnm_tickets...")

            # Add is_paid column
            await db.execute(text("""
                ALTER TABLE tnm_tickets
                ADD COLUMN is_paid INTEGER DEFAULT 0 NOT NULL
            """))
            print("  ✓ Added is_paid column")

            # Add paid_date column
            await db.execute(text("""
                ALTER TABLE tnm_tickets
                ADD COLUMN paid_date TIMESTAMP WITH TIME ZONE
            """))
            print("  ✓ Added paid_date column")

            # Add paid_by column
            await db.execute(text("""
                ALTER TABLE tnm_tickets
                ADD COLUMN paid_by UUID REFERENCES users(id) ON DELETE SET NULL
            """))
            print("  ✓ Added paid_by column")

            # Create index on is_paid for faster queries
            await db.execute(text("""
                CREATE INDEX idx_tnm_tickets_is_paid ON tnm_tickets(is_paid)
            """))
            print("  ✓ Created index on is_paid")

            await db.commit()
            print("\n✅ Successfully added payment tracking fields to tnm_tickets table")

        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error adding payment tracking fields: {str(e)}")
            raise

    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(add_paid_tracking_fields())
