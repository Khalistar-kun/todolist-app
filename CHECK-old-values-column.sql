-- Check if old_values column exists in activity_logs

SELECT
  'Checking for old_values column' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_logs'
  AND column_name = 'old_values';

-- If no rows returned, the column doesn't exist
-- Let's see all columns to be sure
SELECT
  'All activity_logs columns' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_logs'
ORDER BY ordinal_position;
