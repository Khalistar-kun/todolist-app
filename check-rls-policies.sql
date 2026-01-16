-- Query to check all RLS policies and identify potential circular references

-- Check policies on project_members table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('project_members', 'organization_members', 'tasks', 'projects', 'organizations')
ORDER BY tablename, policyname;

-- Check if RLS is enabled on these tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('project_members', 'organization_members', 'tasks', 'projects', 'organizations')
ORDER BY tablename;
