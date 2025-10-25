-- ==========================================
-- Migration: Add project_manager and office_staff roles to user_role enum
-- Date: 2025-10-25
-- Purpose: Align database enum with frontend TypeScript UserRole
-- ==========================================

-- Add new enum values to user_role type
-- Note: PostgreSQL allows adding enum values without recreating the type

-- Add 'project_manager' if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'project_manager'
        AND enumtypid = 'user_role'::regtype
    ) THEN
        ALTER TYPE user_role ADD VALUE 'project_manager';
        RAISE NOTICE 'Added project_manager to user_role enum';
    ELSE
        RAISE NOTICE 'project_manager already exists in user_role enum';
    END IF;
END$$;

-- Add 'office_staff' if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'office_staff'
        AND enumtypid = 'user_role'::regtype
    ) THEN
        ALTER TYPE user_role ADD VALUE 'office_staff';
        RAISE NOTICE 'Added office_staff to user_role enum';
    ELSE
        RAISE NOTICE 'office_staff already exists in user_role enum';
    END IF;
END$$;

-- Verify the enum values
SELECT 'Current user_role enum values:' AS info;
SELECT unnest(enum_range(NULL::user_role)) AS user_role_values;

-- ==========================================
-- Migration complete
-- ==========================================
