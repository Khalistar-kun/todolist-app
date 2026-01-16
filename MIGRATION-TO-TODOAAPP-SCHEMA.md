# Migration Guide: Public Schema → TODOAAPP Schema

## Overview
This guide outlines the steps to migrate your application from using the `public` schema to the new `TODOAAPP` schema in Supabase.

## Current State
- ✅ Database has tables in `public` schema (already populated with data)
- ✅ Created `create-todoaapp-schema.sql` - schema creation script
- ✅ Created `create-todoaapp-rls.sql` - RLS policies script
- ⚠️ Backend code still queries `public` schema
- ⚠️ Need to decide: **migrate data** OR **start fresh**

## Migration Options

### Option 1: Start Fresh (Recommended for Development)
**When to use:** Development environment, no production data to preserve

**Steps:**
1. Run `create-todoaapp-schema.sql` in Supabase SQL Editor
2. Run `create-todoaapp-rls.sql` in Supabase SQL Editor
3. Update all backend queries to use schema prefix (see below)
4. Clear any local storage/cookies
5. Create new test organizations and projects

**Pros:**
- Clean slate
- No data migration complexity
- Faster

**Cons:**
- Lose existing test data

### Option 2: Migrate Existing Data
**When to use:** Production environment, need to preserve existing data

**Steps:**
1. Run `create-todoaapp-schema.sql` to create new schema
2. Run data migration script (see `migrate-data-to-todoaapp.sql` below)
3. Run `create-todoaapp-rls.sql` for RLS policies
4. Update backend code
5. Test thoroughly
6. Optional: Drop old public schema tables

**Pros:**
- Preserve all existing data
- No data loss

**Cons:**
- More complex
- Requires careful testing

## Backend Code Changes Required

### 1. Update Supabase Queries
All Supabase queries need to specify the schema. There are two approaches:

#### Approach A: Set Default Schema (Easiest)
Add schema to connection string or use `search_path`:

```typescript
// In lib/supabase.ts or at the start of each API route
await supabase.rpc('exec', {
  sql: 'SET search_path TO TODOAAPP, public'
})
```

#### Approach B: Prefix All Table Names (Recommended)
Update all queries to use schema prefix:

```typescript
// Before:
.from('tasks')
.from('projects')
.from('organizations')

// After:
.from('TODOAAPP.tasks')
.from('TODOAAPP.projects')
.from('TODOAAPP.organizations')
```

### 2. Files That Need Updates

#### Core Files:
- ✅ `lib/supabase.ts` - Database types
- ✅ All API routes in `app/api/` directory

#### API Routes to Update:
1. `app/api/tasks/route.ts`
2. `app/api/projects/route.ts`
3. `app/api/projects/[id]/route.ts`
4. `app/api/projects/[id]/members/route.ts`
5. `app/api/projects/[id]/slack/route.ts`
6. `app/api/organizations/route.ts`
7. `app/api/organizations/[id]/route.ts`
8. `app/api/organizations/[id]/members/route.ts`
9. `app/api/organizations/[id]/slack/route.ts`
10. `app/api/teams/route.ts`
11. `app/api/teams/[id]/route.ts`
12. `app/api/teams/[id]/members/route.ts`
13. `app/api/comments/route.ts`
14. `app/api/profile/route.ts`
15. `app/api/inbox/route.ts`
16. `app/api/mentions/users/route.ts`
17. `app/api/settings/route.ts`
18. `app/api/health/route.ts`

### 3. Schema Differences to Address

The new TODOAAPP schema has some differences from your current public schema:

#### Removed Fields (Not in TODOAAPP schema):
- `organizations.avatar_url` → Use `image_url` instead
- `organizations.settings` → Not in new schema
- `organizations.subscription_tier` → Not in new schema
- `organizations.max_members` → Not in new schema
- `projects.visibility` → Not in new schema
- `projects.settings` → Not in new schema
- `task_dependencies` table → Not in new schema
- `milestones` table → Not in new schema
- `portfolios` table → Not in new schema
- `task_recurrences` table → Not in new schema
- `time_entries.is_running` → Not in new schema
- `time_entries.started_at` → Use `start_time` instead
- `time_entries.ended_at` → Use `end_time` instead

#### Added Fields (New in TODOAAPP schema):
- `profiles.profile_completed`
- `profiles.is_online`
- `profiles.last_seen_at`
- `organizations.logo_url` (in addition to image_url)
- `projects.team_id`
- `tasks.assigned_to` (single user instead of array)
- `subtasks.due_date`
- Various Slack integration fields in tasks table

#### Role Changes:
- `organization_members.role`: Changed from `('owner', 'admin', 'editor', 'reader')` to `('owner', 'admin', 'member')`
- `team_members.role`: `('owner', 'admin', 'member')`
- `project_members.role`: Remains `('owner', 'admin', 'editor', 'reader')`

## Data Migration Script

If you choose Option 2 (migrate existing data), use this script:

```sql
-- Save this as: migrate-data-to-todoaapp.sql
-- Run AFTER create-todoaapp-schema.sql but BEFORE create-todoaapp-rls.sql

SET search_path TO TODOAAPP, public;

-- 1. Migrate Profiles
INSERT INTO TODOAAPP.profiles (id, email, full_name, avatar_url, bio, username, timezone, language, created_at, updated_at)
SELECT id, email, full_name, avatar_url, bio, username, timezone, language, created_at, updated_at
FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- 2. Migrate Organizations
INSERT INTO TODOAAPP.organizations (id, name, slug, description, logo_url, image_url, created_by, created_at, updated_at)
SELECT id, name, slug, description, avatar_url, avatar_url, created_by, created_at, updated_at
FROM public.organizations
ON CONFLICT (id) DO NOTHING;

-- 3. Migrate Organization Members
INSERT INTO TODOAAPP.organization_members (id, organization_id, user_id, role, invited_by, joined_at)
SELECT
  id,
  organization_id,
  user_id,
  CASE
    WHEN role = 'reader' THEN 'member'
    WHEN role = 'editor' THEN 'member'
    ELSE role
  END,
  invited_by,
  joined_at
FROM public.organization_members
ON CONFLICT (id) DO NOTHING;

-- 4. Migrate Teams
INSERT INTO TODOAAPP.teams (id, organization_id, name, description, color, image_url, created_by, created_at, updated_at)
SELECT id, organization_id, name, description, color, NULL, created_by, created_at, updated_at
FROM public.teams
ON CONFLICT (id) DO NOTHING;

-- 5. Migrate Team Members
INSERT INTO TODOAAPP.team_members (id, team_id, user_id, role, joined_at)
SELECT
  id,
  team_id,
  user_id,
  CASE
    WHEN role = 'reader' THEN 'member'
    WHEN role = 'editor' THEN 'member'
    ELSE role
  END,
  joined_at
FROM public.team_members
ON CONFLICT (id) DO NOTHING;

-- 6. Migrate Projects
INSERT INTO TODOAAPP.projects (id, name, description, organization_id, team_id, color, status, workflow_stages, created_by, created_at, updated_at)
SELECT id, name, description, organization_id, NULL, color, status, workflow_stages, created_by, created_at, updated_at
FROM public.projects
ON CONFLICT (id) DO NOTHING;

-- 7. Migrate Project Members
INSERT INTO TODOAAPP.project_members (id, project_id, user_id, role, invited_by, joined_at)
SELECT id, project_id, user_id, role, assigned_by, joined_at
FROM public.project_members
ON CONFLICT (id) DO NOTHING;

-- 8. Migrate Tasks
INSERT INTO TODOAAPP.tasks (
  id, title, description, status, priority, project_id, assigned_to, created_by, updated_by,
  due_date, start_date, completed_at, created_at, updated_at, tags, estimated_hours, actual_hours,
  parent_task_id, position, stage_id, custom_fields, color, milestone_id,
  approval_status, approved_at, approved_by, rejection_reason, moved_to_done_at, moved_to_done_by
)
SELECT
  id, title, description, status, priority, project_id,
  NULL, -- assigned_to (will be populated from task_assignments)
  created_by, updated_by, due_date, start_date, completed_at, created_at, updated_at,
  tags, estimated_hours, NULL, parent_task_id, position, stage_id, custom_fields, color, milestone_id,
  approval_status, approved_at, approved_by, rejection_reason, moved_to_done_at, moved_to_done_by
FROM public.tasks
ON CONFLICT (id) DO NOTHING;

-- 9. Migrate Task Assignments
INSERT INTO TODOAAPP.task_assignments (id, task_id, user_id, assigned_by, assigned_at)
SELECT id, task_id, user_id, assigned_by, assigned_at
FROM public.task_assignments
ON CONFLICT (id) DO NOTHING;

-- 10. Migrate Subtasks
INSERT INTO TODOAAPP.subtasks (id, task_id, title, completed, position, assigned_to, created_at, updated_at)
SELECT id, task_id, title, completed, position, assigned_to, created_at, updated_at
FROM public.subtasks
ON CONFLICT (id) DO NOTHING;

-- 11. Migrate Comments
INSERT INTO TODOAAPP.comments (id, task_id, project_id, content, created_by, created_at, updated_at)
SELECT id, task_id, project_id, content, created_by, created_at, updated_at
FROM public.comments
ON CONFLICT (id) DO NOTHING;

-- 12. Migrate Attachments
INSERT INTO TODOAAPP.attachments (id, task_id, comment_id, file_name, file_url, file_size, file_type, uploaded_by, created_at)
SELECT id, task_id, comment_id, file_name, file_path, file_size, file_type, uploaded_by, created_at
FROM public.attachments
ON CONFLICT (id) DO NOTHING;

-- 13. Migrate Time Entries
INSERT INTO TODOAAPP.time_entries (id, task_id, user_id, start_time, end_time, duration, description, created_at)
SELECT id, task_id, user_id, started_at, ended_at, duration, description, created_at
FROM public.time_entries
ON CONFLICT (id) DO NOTHING;

-- 14. Migrate Activity Logs
INSERT INTO TODOAAPP.activity_logs (id, project_id, task_id, user_id, action, entity_type, entity_id, changes, created_at)
SELECT id, project_id, task_id, user_id, action, entity_type, entity_id,
  jsonb_build_object('old_values', old_values, 'new_values', new_values),
  created_at
FROM public.activity_logs
ON CONFLICT (id) DO NOTHING;

-- 15. Migrate Notifications
INSERT INTO TODOAAPP.notifications (id, user_id, type, title, message, data, is_read, created_at)
SELECT id, user_id, type, title, message, data, is_read, created_at
FROM public.notifications
ON CONFLICT (id) DO NOTHING;

-- 16. Slack Integrations (if exists)
INSERT INTO TODOAAPP.slack_integrations (
  id, project_id, webhook_url, channel_name, channel_id, access_token,
  notify_on_task_create, notify_on_task_update, notify_on_task_delete,
  notify_on_task_move, notify_on_task_complete, created_by, created_at, updated_at
)
SELECT
  id, project_id, webhook_url, channel_name, channel_id, access_token,
  notify_on_task_create, notify_on_task_update, notify_on_task_delete,
  notify_on_task_move, notify_on_task_complete, created_by, created_at, updated_at
FROM public.slack_integrations
ON CONFLICT (id) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Data migration completed successfully!';
  RAISE NOTICE '📊 All tables migrated from public to TODOAAPP schema';
  RAISE NOTICE '⚠️  Next steps:';
  RAISE NOTICE '   1. Run create-todoaapp-rls.sql to enable RLS';
  RAISE NOTICE '   2. Update backend code to query TODOAAPP schema';
  RAISE NOTICE '   3. Test thoroughly before dropping public schema tables';
END $$;
```

## Step-by-Step Implementation

### Step 1: Run Database Scripts
```sql
-- 1. Create new schema and tables
\i create-todoaapp-schema.sql

-- 2. (Optional) Migrate data if needed
\i migrate-data-to-todoaapp.sql

-- 3. Enable RLS
\i create-todoaapp-rls.sql
```

### Step 2: Update Backend Code
See the updated files I'll create next.

### Step 3: Test
1. Test authentication and profile creation
2. Test organization creation and member management
3. Test project creation and member management
4. Test task CRUD operations
5. Test comments, attachments, time tracking
6. Test Slack integrations
7. Test notifications and mentions

### Step 4: Cleanup (Optional)
Once everything works with TODOAAPP schema:

```sql
-- Only run after thorough testing!
DROP TABLE IF EXISTS public.attention_items CASCADE;
DROP TABLE IF EXISTS public.mentions CASCADE;
DROP TABLE IF EXISTS public.slack_integrations CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP TABLE IF EXISTS public.attachments CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.subtasks CASCADE;
DROP TABLE IF EXISTS public.task_assignments CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
```

## Rollback Plan

If something goes wrong:

1. The public schema tables are still intact
2. Simply revert backend code changes
3. Application will work with public schema again
4. Can drop TODOAAPP schema if needed:

```sql
DROP SCHEMA TODOAAPP CASCADE;
```

## Notes

- RLS policies in TODOAAPP schema reference `auth.uid()` which works across schemas
- Supabase Auth tables remain in the `auth` schema (unchanged)
- Both schemas can coexist during migration
- Use a staging environment to test before production migration
