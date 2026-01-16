-- =====================================================
-- DIAGNOSTIC SCRIPT - Check Database Issues
-- Run this to see what's wrong with your database
-- =====================================================

-- Check if tables exist
SELECT
  'Tables Check' as check_type,
  table_name,
  'EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'organizations', 'organization_members',
    'teams', 'team_members', 'projects', 'project_members',
    'tasks', 'task_assignments', 'subtasks', 'comments',
    'attachments', 'time_entries', 'activity_logs',
    'notifications', 'webhooks', 'slack_integrations',
    'mentions', 'attention_items', 'task_dependencies',
    'user_preferences', 'password_reset_pins', 'project_invitations',
    'org_slack_integrations', 'organization_announcements',
    'organization_meetings'
  )
ORDER BY table_name;

-- Check RLS status
SELECT
  'RLS Check' as check_type,
  tablename as table_name,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'organizations', 'organization_members',
    'teams', 'team_members', 'projects', 'project_members',
    'tasks', 'task_assignments', 'subtasks', 'comments',
    'attachments', 'time_entries', 'activity_logs',
    'notifications', 'webhooks', 'slack_integrations',
    'mentions', 'attention_items', 'task_dependencies'
  )
ORDER BY tablename;

-- Check RLS policies count
SELECT
  'Policy Count' as check_type,
  tablename as table_name,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Check for specific problematic policies
SELECT
  'Problematic Policies' as check_type,
  tablename as table_name,
  policyname as policy_name,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tasks', 'project_members', 'task_assignments', 'projects')
ORDER BY tablename, policyname;
