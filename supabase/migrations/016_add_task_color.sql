-- Migration: Add color field to tasks
-- This allows users to assign a color to tasks for visual organization

-- Add color column to tasks table
-- Using VARCHAR(7) for hex colors like #EF4444
-- NULL means default (no color)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS color VARCHAR(7);

-- Add constraint to enforce valid color values (controlled palette)
-- Allowed colors: red, orange, yellow, green, blue, purple, pink, or NULL (default)
ALTER TABLE tasks ADD CONSTRAINT tasks_color_check
  CHECK (color IS NULL OR color IN (
    '#EF4444',  -- Red
    '#F97316',  -- Orange
    '#EAB308',  -- Yellow
    '#22C55E',  -- Green
    '#3B82F6',  -- Blue
    '#8B5CF6',  -- Purple
    '#EC4899'   -- Pink
  ));

-- Add comment explaining the column
COMMENT ON COLUMN tasks.color IS 'Optional color label for task visual identification. Must be one of the predefined hex colors or NULL for default.';
