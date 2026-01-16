-- Quick check of all table columns
-- This will show the structure without querying data

-- =====================================================
-- ALL TABLES - COLUMN NAMES ONLY
-- =====================================================

-- PROFILES
SELECT 'PROFILES' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ORGANIZATIONS
SELECT 'ORGANIZATIONS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organizations'
ORDER BY ordinal_position;

-- ORGANIZATION_MEMBERS
SELECT 'ORGANIZATION_MEMBERS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organization_members'
ORDER BY ordinal_position;

-- PROJECTS
SELECT 'PROJECTS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'projects'
ORDER BY ordinal_position;

-- PROJECT_MEMBERS
SELECT 'PROJECT_MEMBERS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'project_members'
ORDER BY ordinal_position;

-- TASKS
SELECT 'TASKS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tasks'
ORDER BY ordinal_position;

-- TASK_ASSIGNMENTS
SELECT 'TASK_ASSIGNMENTS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'task_assignments'
ORDER BY ordinal_position;

-- SUBTASKS
SELECT 'SUBTASKS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subtasks'
ORDER BY ordinal_position;

-- COMMENTS
SELECT 'COMMENTS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'comments'
ORDER BY ordinal_position;

-- ATTACHMENTS
SELECT 'ATTACHMENTS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attachments'
ORDER BY ordinal_position;

-- TIME_ENTRIES
SELECT 'TIME_ENTRIES' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'time_entries'
ORDER BY ordinal_position;

-- ACTIVITY_LOGS
SELECT 'ACTIVITY_LOGS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'activity_logs'
ORDER BY ordinal_position;

-- NOTIFICATIONS
SELECT 'NOTIFICATIONS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

-- WEBHOOKS
SELECT 'WEBHOOKS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'webhooks'
ORDER BY ordinal_position;

-- SLACK_INTEGRATIONS
SELECT 'SLACK_INTEGRATIONS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'slack_integrations'
ORDER BY ordinal_position;

-- TEAMS
SELECT 'TEAMS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'teams'
ORDER BY ordinal_position;

-- TEAM_MEMBERS
SELECT 'TEAM_MEMBERS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'team_members'
ORDER BY ordinal_position;

-- MENTIONS
SELECT 'MENTIONS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'mentions'
ORDER BY ordinal_position;

-- ATTENTION_ITEMS
SELECT 'ATTENTION_ITEMS' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attention_items'
ORDER BY ordinal_position;
