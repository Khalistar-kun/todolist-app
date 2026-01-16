-- =====================================================
-- FIX ACTIVITY LOGS - ADD MISSING COLUMNS ONLY
-- This ONLY adds columns, no testing
-- =====================================================

-- Add all missing columns to activity_logs table
ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS entity_type TEXT;

ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS entity_id UUID;

ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS old_values JSONB;

ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS new_values JSONB;

-- Verify columns were added
SELECT
  'activity_logs columns' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_logs'
ORDER BY ordinal_position;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ All columns added to activity_logs table';
  RAISE NOTICE '';
  RAISE NOTICE 'Columns added:';
  RAISE NOTICE '  - entity_type (TEXT)';
  RAISE NOTICE '  - entity_id (UUID)';
  RAISE NOTICE '  - old_values (JSONB)';
  RAISE NOTICE '  - new_values (JSONB)';
  RAISE NOTICE '';
  RAISE NOTICE 'Now you can run TEST-task-move-complete.sql';
END $$;
