-- Migration: Add pm_email column to projects table
-- Date: 2025-11-27
-- Description: Add Project Manager email field for TNM approval workflow

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS pm_email VARCHAR(255);

COMMENT ON COLUMN projects.pm_email IS 'Project Manager email for TNM ticket approvals';
