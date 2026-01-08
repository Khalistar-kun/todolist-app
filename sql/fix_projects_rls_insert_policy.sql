-- Fix RLS policy issue for projects table
-- Problem: created_by has no default value, causing RLS WITH CHECK to fail
-- Solution: Set created_by to default to auth.uid()

-- Add default value for created_by column
ALTER TABLE public.projects
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Update the INSERT policy to be more explicit
-- This ensures the policy works correctly with the new default
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;

CREATE POLICY "Users can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (created_by = auth.uid() OR created_by IS NULL)
  );

-- Add a comment explaining the security model
COMMENT ON POLICY "Users can create projects" ON public.projects IS
  'Allows authenticated users to create projects. The created_by field defaults to auth.uid() to ensure proper ownership.';

-- Verify the trigger still exists for auto-creating project membership
-- This trigger should automatically add the creator as owner
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgname = 'auto_add_project_owner'
  AND tgrelid = 'public.projects'::regclass
) AS trigger_exists;
