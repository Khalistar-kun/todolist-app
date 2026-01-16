-- =====================================================
-- FIX ACTIVITY LOGS TRIGGER
-- The trigger is failing because activity_logs table is missing entity_type column
-- =====================================================

-- STEP 1: Check current activity_logs schema
SELECT
  'Current activity_logs Schema' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_logs'
ORDER BY ordinal_position;

-- STEP 2: Add missing entity_type and entity_id columns if they don't exist
DO $$
BEGIN
  -- Add entity_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE public.activity_logs
    ADD COLUMN entity_type TEXT;
    RAISE NOTICE '✅ Added entity_type column';
  ELSE
    RAISE NOTICE '✓ entity_type column already exists';
  END IF;

  -- Add entity_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE public.activity_logs
    ADD COLUMN entity_id UUID;
    RAISE NOTICE '✅ Added entity_id column';
  ELSE
    RAISE NOTICE '✓ entity_id column already exists';
  END IF;

  -- Add new_values column (JSONB for storing changes)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name = 'new_values'
  ) THEN
    ALTER TABLE public.activity_logs
    ADD COLUMN new_values JSONB;
    RAISE NOTICE '✅ Added new_values column';
  ELSE
    RAISE NOTICE '✓ new_values column already exists';
  END IF;
END $$;

-- STEP 3: Verify the fix
SELECT
  'Updated activity_logs Schema' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_logs'
ORDER BY ordinal_position;

-- STEP 4: Show the trigger that was failing
SELECT
  'Activity Log Trigger' as info,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%activity%'
ORDER BY event_object_table, trigger_name;

-- SUCCESS MESSAGE
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ ACTIVITY LOGS TABLE FIXED';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'The activity_logs trigger should now work!';
  RAISE NOTICE 'Task creation and updates will now persist.';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run TEST-task-move-complete.sql again to verify';
  RAISE NOTICE '2. Try creating/moving tasks in the UI';
  RAISE NOTICE '';
END $$;
