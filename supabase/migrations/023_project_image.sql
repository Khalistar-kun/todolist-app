-- Migration: Add image_url column to projects table
-- This allows projects to have a custom image/avatar

-- Add image_url column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN projects.image_url IS 'URL to the project image/avatar, can be a data URL or external URL';
