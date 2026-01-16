-- Query all tables and show their structure and sample data
-- Run this in Supabase SQL Editor to verify your database setup

-- =====================================================
-- INFORMATION SCHEMA QUERIES
-- =====================================================

-- List all tables in public schema
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =====================================================
-- TABLE 1: PROFILES
-- =====================================================
SELECT '=== PROFILES TABLE ===' as info;

-- Show columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Sample data
SELECT * FROM profiles LIMIT 2;

-- =====================================================
-- TABLE 2: ORGANIZATIONS
-- =====================================================
SELECT '=== ORGANIZATIONS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organizations'
ORDER BY ordinal_position;

SELECT id, name, slug, created_at FROM organizations LIMIT 2;

-- =====================================================
-- TABLE 3: ORGANIZATION_MEMBERS
-- =====================================================
SELECT '=== ORGANIZATION_MEMBERS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organization_members'
ORDER BY ordinal_position;

SELECT id, organization_id, user_id, role, joined_at FROM organization_members LIMIT 2;

-- =====================================================
-- TABLE 4: PROJECTS
-- =====================================================
SELECT '=== PROJECTS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'projects'
ORDER BY ordinal_position;

SELECT id, name, organization_id, team_id, created_by, created_at FROM projects LIMIT 2;

-- =====================================================
-- TABLE 5: PROJECT_MEMBERS
-- =====================================================
SELECT '=== PROJECT_MEMBERS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'project_members'
ORDER BY ordinal_position;

SELECT id, project_id, user_id, role, joined_at FROM project_members LIMIT 2;

-- =====================================================
-- TABLE 6: TASKS
-- =====================================================
SELECT '=== TASKS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tasks'
ORDER BY ordinal_position;

SELECT id, title, project_id, status, priority, assigned_to,
       approval_status, slack_user_id, created_at
FROM tasks LIMIT 2;

-- =====================================================
-- TABLE 7: TASK_ASSIGNMENTS
-- =====================================================
SELECT '=== TASK_ASSIGNMENTS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'task_assignments'
ORDER BY ordinal_position;

SELECT * FROM task_assignments LIMIT 2;

-- =====================================================
-- TABLE 8: SUBTASKS
-- =====================================================
SELECT '=== SUBTASKS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subtasks'
ORDER BY ordinal_position;

SELECT * FROM subtasks LIMIT 2;

-- =====================================================
-- TABLE 9: COMMENTS
-- =====================================================
SELECT '=== COMMENTS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'comments'
ORDER BY ordinal_position;

SELECT id, task_id, user_id, LEFT(content, 50) as content_preview, created_at FROM comments LIMIT 2;

-- =====================================================
-- TABLE 10: ATTACHMENTS
-- =====================================================
SELECT '=== ATTACHMENTS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attachments'
ORDER BY ordinal_position;

SELECT id, task_id, comment_id, file_name, file_size FROM attachments LIMIT 2;

-- =====================================================
-- TABLE 11: TIME_ENTRIES
-- =====================================================
SELECT '=== TIME_ENTRIES TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'time_entries'
ORDER BY ordinal_position;

SELECT id, task_id, user_id, duration, start_time FROM time_entries LIMIT 2;

-- =====================================================
-- TABLE 12: ACTIVITY_LOGS
-- =====================================================
SELECT '=== ACTIVITY_LOGS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'activity_logs'
ORDER BY ordinal_position;

SELECT id, project_id, task_id, user_id, action, entity_type, created_at FROM activity_logs LIMIT 2;

-- =====================================================
-- TABLE 13: NOTIFICATIONS
-- =====================================================
SELECT '=== NOTIFICATIONS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

SELECT id, user_id, type, title, is_read, created_at FROM notifications LIMIT 2;

-- =====================================================
-- TABLE 14: WEBHOOKS
-- =====================================================
SELECT '=== WEBHOOKS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'webhooks'
ORDER BY ordinal_position;

SELECT * FROM webhooks LIMIT 2;

-- =====================================================
-- TABLE 15: SLACK_INTEGRATIONS
-- =====================================================
SELECT '=== SLACK_INTEGRATIONS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'slack_integrations'
ORDER BY ordinal_position;

SELECT id, project_id, channel_name, notify_on_task_create,
       notify_on_task_update, created_at
FROM slack_integrations LIMIT 2;

-- =====================================================
-- TABLE 16: TEAMS
-- =====================================================
SELECT '=== TEAMS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'teams'
ORDER BY ordinal_position;

SELECT id, organization_id, name, description, created_by, created_at FROM teams LIMIT 2;

-- =====================================================
-- TABLE 17: TEAM_MEMBERS
-- =====================================================
SELECT '=== TEAM_MEMBERS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'team_members'
ORDER BY ordinal_position;

SELECT id, team_id, user_id, role, joined_at FROM team_members LIMIT 2;

-- =====================================================
-- TABLE 18: MENTIONS
-- =====================================================
SELECT '=== MENTIONS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'mentions'
ORDER BY ordinal_position;

SELECT id, mentioned_user_id, mentioner_user_id, task_id, comment_id, created_at FROM mentions LIMIT 2;

-- =====================================================
-- TABLE 19: ATTENTION_ITEMS
-- =====================================================
SELECT '=== ATTENTION_ITEMS TABLE ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attention_items'
ORDER BY ordinal_position;

SELECT id, user_id, attention_type, priority, title, read_at, created_at FROM attention_items LIMIT 2;

-- =====================================================
-- ENUM TYPES
-- =====================================================
SELECT '=== ENUM TYPES ===' as info;

SELECT n.nspname as schema,
       t.typname as enum_name,
       string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY n.nspname, t.typname
ORDER BY t.typname;

-- =====================================================
-- ROW COUNTS
-- =====================================================
SELECT '=== ROW COUNTS ===' as info;

SELECT
  'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'project_members', COUNT(*) FROM project_members
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'task_assignments', COUNT(*) FROM task_assignments
UNION ALL SELECT 'subtasks', COUNT(*) FROM subtasks
UNION ALL SELECT 'comments', COUNT(*) FROM comments
UNION ALL SELECT 'attachments', COUNT(*) FROM attachments
UNION ALL SELECT 'time_entries', COUNT(*) FROM time_entries
UNION ALL SELECT 'activity_logs', COUNT(*) FROM activity_logs
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'webhooks', COUNT(*) FROM webhooks
UNION ALL SELECT 'slack_integrations', COUNT(*) FROM slack_integrations
UNION ALL SELECT 'teams', COUNT(*) FROM teams
UNION ALL SELECT 'team_members', COUNT(*) FROM team_members
UNION ALL SELECT 'mentions', COUNT(*) FROM mentions
UNION ALL SELECT 'attention_items', COUNT(*) FROM attention_items
ORDER BY table_name;

-- =====================================================
-- RLS STATUS
-- =====================================================
SELECT '=== RLS STATUS ===' as info;

SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'organizations', 'organization_members',
    'projects', 'project_members', 'tasks', 'task_assignments',
    'subtasks', 'comments', 'attachments', 'time_entries',
    'activity_logs', 'notifications', 'webhooks',
    'slack_integrations', 'teams', 'team_members',
    'mentions', 'attention_items'
  )
ORDER BY tablename;

-- =====================================================
-- SUMMARY
-- =====================================================
SELECT '=== DATABASE SUMMARY ===' as info;

SELECT
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'public') as total_columns,
  (SELECT COUNT(*) FROM pg_type t
   JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public' AND t.typtype = 'e') as total_enums;
