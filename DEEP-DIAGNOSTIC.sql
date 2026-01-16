-- =====================================================
-- DEEP DIAGNOSTIC - Find the REAL problem
-- This checks EVERYTHING that could cause 500 errors
-- =====================================================

-- User and Project IDs from your console
-- User: b5733666-7690-4b0a-a693-930d34bbeb58
-- Project: e8f4a29e-7967-4ad5-9ad0-271da779fa33

\echo '============================================================'
\echo '1. CHECK IF PROJECT EXISTS AND USER IS A MEMBER'
\echo '============================================================'

SELECT
  'Project Exists' as status,
  p.id,
  p.name,
  p.organization_id,
  p.created_by,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = p.id
      AND pm.user_id = 'b5733666-7690-4b0a-a693-930d34bbeb58'
    ) THEN 'YES - User is member'
    ELSE 'NO - User NOT a member'
  END as user_membership
FROM public.projects p
WHERE p.id = 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';

\echo ''
\echo '============================================================'
\echo '2. CHECK PROJECT_MEMBERS TABLE FOR THIS PROJECT'
\echo '============================================================'

SELECT
  'Project Members' as check_type,
  pm.id,
  pm.user_id,
  pm.role,
  pm.joined_at,
  prof.email,
  prof.full_name
FROM public.project_members pm
LEFT JOIN public.profiles prof ON prof.id = pm.user_id
WHERE pm.project_id = 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';

\echo ''
\echo '============================================================'
\echo '3. CHECK PROJECTS TABLE SCHEMA'
\echo '============================================================'

SELECT
  'Projects Schema' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
ORDER BY ordinal_position;

\echo ''
\echo '============================================================'
\echo '4. TEST RLS POLICY - Simulate user query'
\echo '============================================================'

-- This simulates what happens when the user queries projects
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "b5733666-7690-4b0a-a693-930d34bbeb58"}';

SELECT
  'RLS Test - Can user see project?' as test,
  COUNT(*) as project_count
FROM public.projects
WHERE id = 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';

RESET role;

\echo ''
\echo '============================================================'
\echo '5. CHECK ALL RLS POLICIES ON PROJECTS TABLE'
\echo '============================================================'

SELECT
  'Projects RLS Policies' as check_type,
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'projects';

\echo ''
\echo '============================================================'
\echo '6. CHECK ALL RLS POLICIES ON TASKS TABLE'
\echo '============================================================'

SELECT
  'Tasks RLS Policies' as check_type,
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tasks';

\echo ''
\echo '============================================================'
\echo '7. CHECK IF WORKFLOW_STAGES COLUMN EXISTS'
\echo '============================================================'

SELECT
  'Workflow Stages Column Check' as check_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'projects'
        AND column_name = 'workflow_stages'
    ) THEN 'EXISTS'
    ELSE 'MISSING - THIS IS THE PROBLEM!'
  END as status;

\echo ''
\echo '============================================================'
\echo '8. CHECK IF STAGE_ID COLUMN EXISTS IN TASKS'
\echo '============================================================'

SELECT
  'Stage ID Column Check' as check_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tasks'
        AND column_name = 'stage_id'
    ) THEN 'EXISTS'
    ELSE 'MISSING - THIS IS THE PROBLEM!'
  END as status;

\echo ''
\echo '============================================================'
\echo '9. LIST ALL TASKS TABLE COLUMNS'
\echo '============================================================'

SELECT
  'Tasks Schema' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasks'
ORDER BY ordinal_position;

\echo ''
\echo '============================================================'
\echo '10. CHECK SUPABASE LOGS FOR ACTUAL ERROR'
\echo '============================================================'

\echo 'Run this query to see recent errors:'
\echo 'Go to Supabase Dashboard > Logs > Database Logs'
\echo 'Or check PostgREST logs for the actual error message'
