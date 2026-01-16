# Database Setup Guide

This guide will help you set up the complete database schema for the Todo List application.

## Overview

The application uses a Supabase PostgreSQL database with the following features:
- Multi-tenant organization system
- Projects and tasks management
- Team collaboration
- Slack integrations
- Task approval workflows
- Attention inbox and mentions system
- Row Level Security (RLS) for data protection

## Option 1: Using the Safe Migration Script (Recommended)

The `safe-migration.sql` file is designed to be run multiple times safely. It checks for existing database objects before creating them.

### Steps:

1. **Open Supabase SQL Editor**
   - Go to your Supabase Dashboard: https://supabase.com/dashboard/project/qyjzqzqqjimittltttph
   - Navigate to the SQL Editor

2. **Copy the Safe Migration Script**
   - Open `safe-migration.sql` file
   - Copy the entire contents (Ctrl+A, Ctrl+C)

3. **Run in SQL Editor**
   - Paste the script into the SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Wait for execution to complete (this may take 30-60 seconds)

4. **Verify Success**
   - You should see "Success. No rows returned" or similar message
   - Check the Tables tab to confirm all tables are created

### What Gets Created:

The safe migration script creates:

**Core Tables:**
- `profiles` - User profiles extending auth.users
- `organizations` - Multi-tenant organizations
- `organization_members` - Organization membership
- `projects` - Project management
- `project_members` - Project membership and roles
- `tasks` - Task items with kanban stages
- `task_assignments` - Task to user assignments
- `subtasks` - Checklist items within tasks
- `comments` - Task comments
- `attachments` - File attachments
- `time_entries` - Time tracking
- `activity_logs` - Audit trail
- `notifications` - User notifications
- `webhooks` - Webhook configurations

**Advanced Features:**
- `slack_integrations` - Slack webhook integration per project
- `teams` - Team structure within organizations
- `team_members` - Team membership
- `mentions` - @mention tracking
- `attention_items` - Unified inbox for user attention

**Enums:**
- `task_priority` - none, low, medium, high, urgent
- `task_status` - todo, in_progress, review, done, archived
- `project_role` - owner, admin, editor, reader
- `notification_type` - task_assigned, task_updated, comment_added, etc.
- `webhook_event` - task_created, task_updated, etc.
- `attention_type` - mention, assignment, due_soon, overdue, etc.
- `attention_priority` - urgent, high, normal, low

**Security:**
- Row Level Security (RLS) policies for all tables
- Secure functions with SECURITY DEFINER
- Fine-grained access control

**Automation:**
- Triggers for updated_at timestamps
- Activity logging triggers
- Task assignment notifications
- Attention item creation triggers

## Option 2: Using Individual Migration Files

If you prefer to run migrations individually, you can find all migration files in the `supabase/migrations/` directory. They are numbered in order (001 through 025).

**Note:** Running individual migrations requires careful ordering and may fail if run out of sequence.

## Troubleshooting

### Error: "type already exists"
This is normal if you've partially run migrations before. The safe migration script handles this gracefully by catching duplicate object errors.

### Error: "relation already exists"
The safe migration script uses `CREATE TABLE IF NOT EXISTS`, so this shouldn't occur. If it does, it's safe to continue.

### Error: "permission denied"
Make sure you're using the service role key, not the anon key. The SQL Editor in Supabase Dashboard uses the appropriate credentials automatically.

### Checking What Exists

To see what tables already exist in your database:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

To see what types exist:

```sql
SELECT typname
FROM pg_type
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND typtype = 'e'
ORDER BY typname;
```

## Verification

After running the migration, verify the setup:

```sql
-- Count tables
SELECT COUNT(*) as table_count
FROM pg_tables
WHERE schemaname = 'public';
-- Should return approximately 18-20 tables

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
-- All tables should have RLS enabled

-- Check policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
-- Should return multiple policies per table
```

## Next Steps

After the database is set up:

1. **Create your first user** - Sign up through the application
2. **Create an organization** - Set up your first organization
3. **Create a project** - Start managing tasks
4. **Invite team members** - Add collaborators

## Connecting Your Application

The application is already configured to connect to Supabase using the environment variables in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://qyjzqzqqjimittltttph.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Support

If you encounter issues:
1. Check the Supabase logs in your dashboard
2. Verify all environment variables are set correctly
3. Ensure your Supabase project is active and not paused

## Database Diagram

```
auth.users (Supabase Auth)
    ↓
profiles (1:1)
    ↓
organizations (1:many) ←→ organization_members
    ↓
teams (optional hierarchy) ←→ team_members
    ↓
projects ←→ project_members
    ↓                ↓
tasks ←→ task_assignments
    ↓
    ├─→ subtasks
    ├─→ comments
    ├─→ attachments
    ├─→ time_entries
    └─→ activity_logs

Separate features:
- slack_integrations (linked to projects)
- notifications (linked to users)
- mentions (linked to users/tasks/comments)
- attention_items (unified inbox)
- webhooks (linked to projects)
```
