-- Migration: Database fixes for auth flow, comments, and performance
-- Required for: OAuth signup flow, QuickCommentPanel joins, subtask ordering
-- Safe to run: Yes (additive changes only)

-- ============================================
-- PART 1: Add profile_completed column
-- ============================================

-- Add column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'profile_completed'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN profile_completed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Backfill existing profiles as completed (they existed before this feature)
UPDATE profiles
SET profile_completed = true
WHERE profile_completed IS NULL;

-- Add partial index for efficiently finding incomplete profiles (onboarding reminders)
CREATE INDEX IF NOT EXISTS idx_profiles_incomplete
ON profiles(id)
WHERE profile_completed = false;

-- ============================================
-- PART 2: Comments FK constraint
-- NOTE: comments_created_by_fkey already exists (verified)
-- ============================================

-- No action needed - constraint exists with correct name

-- ============================================
-- PART 3: Performance indexes
-- ============================================

-- Index for faster author-based task queries
CREATE INDEX IF NOT EXISTS idx_tasks_created_by
ON tasks(created_by);

-- Index for faster comment lookups by task
CREATE INDEX IF NOT EXISTS idx_comments_created_by
ON comments(created_by);

-- Index for subtask ordering (position-based queries)
CREATE INDEX IF NOT EXISTS idx_subtasks_task_position
ON subtasks(task_id, position);

-- ============================================
-- PART 4: Ensure subtasks have proper ordering support
-- ============================================

-- Add position column if it doesn't exist (should exist from schema, but ensure)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'subtasks'
    AND column_name = 'position'
  ) THEN
    ALTER TABLE public.subtasks ADD COLUMN position INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- ROLLBACK INSTRUCTIONS
-- ============================================
--
-- To rollback:
--   ALTER TABLE profiles DROP COLUMN IF EXISTS profile_completed;
--   DROP INDEX IF EXISTS idx_profiles_incomplete;
--   DROP INDEX IF EXISTS idx_tasks_created_by;
--   DROP INDEX IF EXISTS idx_comments_created_by;
--   DROP INDEX IF EXISTS idx_subtasks_task_position;
