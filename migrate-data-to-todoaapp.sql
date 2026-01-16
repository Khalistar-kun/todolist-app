-- =====================================================
-- DATA MIGRATION: public schema → TODOAAPP schema
-- Run this AFTER create-todoaapp-schema.sql
-- Run this BEFORE create-todoaapp-rls.sql
-- =====================================================

-- Set search path
SET search_path TO TODOAAPP, public;

-- =====================================================
-- 1. MIGRATE PROFILES
-- =====================================================

INSERT INTO TODOAAPP.profiles (
  id, email, full_name, avatar_url, bio, username, timezone, language,
  created_at, updated_at
)
SELECT
  id, email, full_name, avatar_url, bio, username,
  COALESCE(timezone, 'UTC'),
  COALESCE(language, 'en'),
  created_at, updated_at
FROM public.profiles
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio,
  username = EXCLUDED.username,
  timezone = EXCLUDED.timezone,
  language = EXCLUDED.language,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 2. MIGRATE ORGANIZATIONS
-- =====================================================

INSERT INTO TODOAAPP.organizations (
  id, name, slug, description, logo_url, image_url, created_by, created_at, updated_at
)
SELECT
  id, name, slug, description,
  logo_url, -- Copy logo_url as is
  COALESCE(image_url, logo_url), -- Use image_url if exists, otherwise logo_url
  created_by, created_at, updated_at
FROM public.organizations
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  logo_url = EXCLUDED.logo_url,
  image_url = EXCLUDED.image_url,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 3. MIGRATE ORGANIZATION MEMBERS
-- =====================================================

INSERT INTO TODOAAPP.organization_members (
  id, organization_id, user_id, role, invited_by, joined_at
)
SELECT
  id, organization_id, user_id,
  -- Map roles: reader/editor → member, keep owner/admin
  CASE
    WHEN role = 'reader' THEN 'member'
    WHEN role = 'editor' THEN 'member'
    WHEN role IN ('owner', 'admin') THEN role
    ELSE 'member'
  END,
  invited_by, joined_at
FROM public.organization_members
ON CONFLICT (organization_id, user_id) DO UPDATE SET
  role = EXCLUDED.role;

-- =====================================================
-- 4. MIGRATE TEAMS
-- =====================================================

INSERT INTO TODOAAPP.teams (
  id, organization_id, name, description, color, image_url, created_by, created_at, updated_at
)
SELECT
  id, organization_id, name, description,
  COALESCE(color, '#3B82F6'),
  NULL, -- image_url doesn't exist in public schema
  created_by, created_at, updated_at
FROM public.teams
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 5. MIGRATE TEAM MEMBERS
-- =====================================================

INSERT INTO TODOAAPP.team_members (
  id, team_id, user_id, role, joined_at
)
SELECT
  id, team_id, user_id,
  -- Map roles: reader/editor → member, keep owner/admin
  CASE
    WHEN role = 'reader' THEN 'member'
    WHEN role = 'editor' THEN 'member'
    WHEN role IN ('owner', 'admin') THEN role
    ELSE 'member'
  END,
  joined_at
FROM public.team_members
ON CONFLICT (team_id, user_id) DO UPDATE SET
  role = EXCLUDED.role;

-- =====================================================
-- 6. MIGRATE PROJECTS
-- =====================================================

INSERT INTO TODOAAPP.projects (
  id, name, description, organization_id, team_id, color, status,
  workflow_stages, image_url, created_by, created_at, updated_at
)
SELECT
  id, name, description, organization_id,
  NULL, -- team_id doesn't exist in public schema
  COALESCE(color, '#3B82F6'),
  COALESCE(status, 'active'),
  workflow_stages,
  NULL, -- image_url doesn't exist in public schema
  created_by, created_at, updated_at
FROM public.projects
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  status = EXCLUDED.status,
  workflow_stages = EXCLUDED.workflow_stages,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 7. MIGRATE PROJECT MEMBERS
-- =====================================================

INSERT INTO TODOAAPP.project_members (
  id, project_id, user_id, role, invited_by, joined_at
)
SELECT
  id, project_id, user_id,
  -- Map roles to match TODOAAPP.project_role enum
  CASE
    WHEN role = 'member' THEN 'editor'::TODOAAPP.project_role
    WHEN role IN ('owner', 'admin', 'editor', 'reader') THEN role::TODOAAPP.project_role
    ELSE 'reader'::TODOAAPP.project_role
  END,
  invited_by, -- Column already exists in public schema
  joined_at
FROM public.project_members
ON CONFLICT (project_id, user_id) DO UPDATE SET
  role = EXCLUDED.role;

-- =====================================================
-- 8. MIGRATE TASKS
-- =====================================================

INSERT INTO TODOAAPP.tasks (
  id, title, description, status, priority, project_id, assigned_to,
  created_by, updated_by, due_date, start_date, completed_at,
  created_at, updated_at, tags, estimated_hours, actual_hours,
  parent_task_id, position, stage_id, custom_fields, color, milestone_id,
  approval_status, approved_at, approved_by, rejection_reason,
  moved_to_done_at, moved_to_done_by,
  slack_thread_ts, slack_message_ts, slack_user_id, slack_user_name, created_by_slack
)
SELECT
  id, title, description,
  status::text::TODOAAPP.task_status,
  priority::text::TODOAAPP.task_priority,
  project_id,
  NULL, -- assigned_to (single user) - will be set from first task_assignment
  created_by, updated_by, due_date, start_date, completed_at,
  created_at, updated_at,
  COALESCE(tags, ARRAY[]::text[]),
  estimated_hours,
  NULL, -- actual_hours doesn't exist in public schema
  parent_task_id,
  COALESCE(position, 0),
  stage_id,
  COALESCE(custom_fields, '{}'::jsonb),
  color, milestone_id,
  COALESCE(approval_status, 'none'),
  approved_at, approved_by, rejection_reason,
  moved_to_done_at, moved_to_done_by,
  slack_thread_ts, slack_message_ts, slack_user_id, slack_user_name,
  COALESCE(created_by_slack, false)
FROM public.tasks
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  due_date = EXCLUDED.due_date,
  updated_by = EXCLUDED.updated_by,
  updated_at = EXCLUDED.updated_at;

-- Update assigned_to from first task_assignment for each task
UPDATE TODOAAPP.tasks t
SET assigned_to = (
  SELECT ta.user_id
  FROM public.task_assignments ta
  WHERE ta.task_id = t.id
  ORDER BY ta.assigned_at ASC
  LIMIT 1
)
WHERE assigned_to IS NULL;

-- =====================================================
-- 9. MIGRATE TASK ASSIGNMENTS
-- =====================================================

INSERT INTO TODOAAPP.task_assignments (
  id, task_id, user_id, assigned_by, assigned_at
)
SELECT
  id, task_id, user_id, assigned_by, assigned_at
FROM public.task_assignments
ON CONFLICT (task_id, user_id) DO NOTHING;

-- =====================================================
-- 10. MIGRATE SUBTASKS
-- =====================================================

INSERT INTO TODOAAPP.subtasks (
  id, task_id, title, completed, position, due_date, assigned_to, created_at, updated_at
)
SELECT
  id, task_id, title,
  COALESCE(completed, false),
  COALESCE(position, 0),
  NULL, -- due_date doesn't exist in public schema
  assigned_to, created_at, updated_at
FROM public.subtasks
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  completed = EXCLUDED.completed,
  position = EXCLUDED.position,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 11. MIGRATE COMMENTS
-- =====================================================

INSERT INTO TODOAAPP.comments (
  id, task_id, project_id, content, created_by, created_at, updated_at
)
SELECT
  id, task_id, project_id, content, created_by, created_at, updated_at
FROM public.comments
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 12. MIGRATE ATTACHMENTS
-- =====================================================

INSERT INTO TODOAAPP.attachments (
  id, task_id, comment_id, file_name, file_url, file_size, file_type, uploaded_by, created_at
)
SELECT
  id, task_id, comment_id, file_name,
  file_path, -- Map file_path to file_url
  file_size, file_type, uploaded_by, created_at
FROM public.attachments
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 13. MIGRATE TIME ENTRIES
-- =====================================================

INSERT INTO TODOAAPP.time_entries (
  id, task_id, user_id, start_time, end_time, duration, description, created_at
)
SELECT
  id, task_id, user_id,
  started_at, -- Map started_at to start_time
  ended_at,   -- Map ended_at to end_time
  duration, description, created_at
FROM public.time_entries
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 14. MIGRATE ACTIVITY LOGS (if columns exist)
-- =====================================================

DO $$
BEGIN
  -- Check if old_values and new_values columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name IN ('old_values', 'new_values', 'entity_type', 'entity_id')
    HAVING COUNT(*) = 4
  ) THEN
    INSERT INTO TODOAAPP.activity_logs (
      id, project_id, task_id, user_id, action, entity_type, entity_id, changes, created_at
    )
    SELECT
      al.id, al.project_id, al.task_id, al.user_id, al.action, al.entity_type, al.entity_id,
      -- Combine old_values and new_values into single changes jsonb
      jsonb_build_object(
        'old_values', al.old_values,
        'new_values', al.new_values
      ) as changes,
      al.created_at
    FROM public.activity_logs al
    ON CONFLICT (id) DO NOTHING;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'activity_logs'
  ) THEN
    -- Table exists but has different structure - skip with warning
    RAISE NOTICE '⚠️  Skipping activity_logs migration - table structure differs from expected';
  ELSE
    RAISE NOTICE 'ℹ️  No activity_logs table in public schema - skipping';
  END IF;
END $$;

-- =====================================================
-- 15. MIGRATE NOTIFICATIONS
-- =====================================================

INSERT INTO TODOAAPP.notifications (
  id, user_id, type, title, message, data, is_read, created_at
)
SELECT
  id, user_id,
  -- Map notification types to match TODOAAPP.notification_type enum
  CASE
    WHEN type = 'task_moved' THEN 'task_updated'::TODOAAPP.notification_type
    WHEN type = 'new_announcement' THEN 'task_updated'::TODOAAPP.notification_type
    WHEN type = 'new_meeting' THEN 'task_updated'::TODOAAPP.notification_type
    WHEN type IN ('task_assigned', 'task_updated', 'task_completed', 'comment_added', 'mention', 'project_invite', 'organization_invite')
      THEN type::TODOAAPP.notification_type
    ELSE 'task_updated'::TODOAAPP.notification_type
  END,
  title, message,
  COALESCE(data, '{}'::jsonb),
  COALESCE(is_read, false),
  created_at
FROM public.notifications
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 16. MIGRATE SLACK INTEGRATIONS (if table exists)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'slack_integrations') THEN
    INSERT INTO TODOAAPP.slack_integrations (
      id, project_id, webhook_url, channel_name, channel_id, access_token,
      notify_on_task_create, notify_on_task_update, notify_on_task_delete,
      notify_on_task_move, notify_on_task_complete, created_by, created_at, updated_at
    )
    SELECT
      id, project_id, webhook_url, channel_name, channel_id, access_token,
      COALESCE(notify_on_task_create, true),
      COALESCE(notify_on_task_update, true),
      COALESCE(notify_on_task_delete, true),
      COALESCE(notify_on_task_move, true),
      COALESCE(notify_on_task_complete, true),
      created_by, created_at, updated_at
    FROM public.slack_integrations
    WHERE webhook_url IS NOT NULL  -- Skip rows with NULL webhook_url
    ON CONFLICT (project_id) DO UPDATE SET
      webhook_url = EXCLUDED.webhook_url,
      channel_name = EXCLUDED.channel_name,
      channel_id = EXCLUDED.channel_id,
      access_token = EXCLUDED.access_token,
      updated_at = EXCLUDED.updated_at;
  END IF;
END $$;

-- =====================================================
-- 17. MIGRATE MENTIONS (if table exists)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mentions') THEN
    INSERT INTO TODOAAPP.mentions (
      id, mentioned_user_id, mentioner_user_id, task_id, comment_id,
      project_id, mention_context, created_at, read_at
    )
    SELECT
      id, mentioned_user_id, mentioner_user_id, task_id, comment_id,
      project_id, mention_context, created_at, read_at
    FROM public.mentions
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- 18. MIGRATE ATTENTION ITEMS (if table exists)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attention_items') THEN
    INSERT INTO TODOAAPP.attention_items (
      id, user_id, attention_type, priority, task_id, comment_id, mention_id,
      project_id, actor_user_id, title, body, read_at, dismissed_at, actioned_at,
      dedup_key, created_at, updated_at
    )
    SELECT
      id, user_id,
      attention_type::text::TODOAAPP.attention_type,
      priority::text::TODOAAPP.attention_priority,
      task_id, comment_id, mention_id, project_id, actor_user_id,
      title, body, read_at, dismissed_at, actioned_at, dedup_key,
      created_at, updated_at
    FROM public.attention_items
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

DO $$
DECLARE
  public_profiles_count INT;
  todoaapp_profiles_count INT;
  public_orgs_count INT;
  todoaapp_orgs_count INT;
  public_projects_count INT;
  todoaapp_projects_count INT;
  public_tasks_count INT;
  todoaapp_tasks_count INT;
BEGIN
  -- Count records
  SELECT COUNT(*) INTO public_profiles_count FROM public.profiles;
  SELECT COUNT(*) INTO todoaapp_profiles_count FROM TODOAAPP.profiles;
  SELECT COUNT(*) INTO public_orgs_count FROM public.organizations;
  SELECT COUNT(*) INTO todoaapp_orgs_count FROM TODOAAPP.organizations;
  SELECT COUNT(*) INTO public_projects_count FROM public.projects;
  SELECT COUNT(*) INTO todoaapp_projects_count FROM TODOAAPP.projects;
  SELECT COUNT(*) INTO public_tasks_count FROM public.tasks;
  SELECT COUNT(*) INTO todoaapp_tasks_count FROM TODOAAPP.tasks;

  -- Display results
  RAISE NOTICE '';
  RAISE NOTICE '✅ DATA MIGRATION COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Migration Summary:';
  RAISE NOTICE '   Profiles:      % → % migrated', public_profiles_count, todoaapp_profiles_count;
  RAISE NOTICE '   Organizations: % → % migrated', public_orgs_count, todoaapp_orgs_count;
  RAISE NOTICE '   Projects:      % → % migrated', public_projects_count, todoaapp_projects_count;
  RAISE NOTICE '   Tasks:         % → % migrated', public_tasks_count, todoaapp_tasks_count;
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NEXT STEPS:';
  RAISE NOTICE '   1. Run create-todoaapp-rls.sql to enable Row Level Security';
  RAISE NOTICE '   2. Update backend code to query TODOAAPP schema';
  RAISE NOTICE '   3. Test thoroughly before dropping public schema tables';
  RAISE NOTICE '   4. Use: node update-schema-references.js to update code';
  RAISE NOTICE '';
END $$;
