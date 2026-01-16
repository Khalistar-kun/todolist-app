-- Check tasks table schema to understand available columns
SELECT
  'Tasks Table Columns' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasks'
ORDER BY ordinal_position;
