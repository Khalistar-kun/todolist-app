-- =====================================================
-- CHECK TODOAAPP SCHEMA TABLES
-- Run this in Supabase SQL Editor to see all tables
-- =====================================================

-- List all tables in TODOAAPP schema with row counts
SELECT
  t.table_name,
  (
    SELECT COUNT(*)
    FROM information_schema.columns c
    WHERE c.table_schema = 'TODOAAPP'
      AND c.table_name = t.table_name
  ) as column_count,
  pg_size_pretty(pg_total_relation_size('TODOAAPP.' || quote_ident(t.table_name))) as size
FROM information_schema.tables t
WHERE t.table_schema = 'TODOAAPP'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'TODOAAPP'
ORDER BY tablename;

-- Count rows in each table (if data has been migrated)
DO $$
DECLARE
  r RECORD;
  row_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 Row Counts in TODOAAPP Tables:';
  RAISE NOTICE '════════════════════════════════════';

  FOR r IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'TODOAAPP'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM TODOAAPP.%I', r.table_name) INTO row_count;
    RAISE NOTICE '  % : % rows', rpad(r.table_name, 25), row_count;
  END LOOP;

  RAISE NOTICE '';
END $$;
