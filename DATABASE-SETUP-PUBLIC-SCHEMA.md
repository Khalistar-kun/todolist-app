# Database Setup - Public Schema

This guide explains how to set up the complete database schema for the Todo List application using the **public schema only** architecture.

## Architecture Overview

This project follows a strict architecture mandate:

- **Schema**: `public` schema ONLY - no custom schemas
- **Table Naming**: All tables use simple names (e.g., `profiles`, `tasks`, `projects`)
- **Query Pattern**: `.from('table_name')` - NO schema qualifiers (e.g., ~~`.from('TODOAAPP.tasks')`~~)
- **RLS**: Row Level Security policies on `public.*` tables

## Files Included

### 1. `create-public-schema-tables.sql`
Creates the 19 core tables in the public schema with:
- 7 enum types (task_priority, task_status, project_role, etc.)
- 19 core tables (profiles, organizations, projects, tasks, etc.)
- All necessary indexes for optimal performance
- RLS enabled on all tables

### 2. `create-public-schema-rls.sql`
Creates Row Level Security policies for core tables:
- 49 RLS policies for core tables
- Proper access control based on user roles
- Protects multi-tenant data separation

### 3. `create-missing-tables.sql`
Creates 6 additional tables used by various features:
- user_preferences (settings and preferences)
- password_reset_pins (password reset flow)
- project_invitations (invitation management)
- org_slack_integrations (organization Slack settings)
- organization_announcements (org-wide announcements)
- organization_meetings (meeting schedules)

### 4. `create-missing-tables-rls.sql`
Creates RLS policies for additional tables:
- 20 RLS policies
- Secure access control for each feature
- Integration with existing security model

## Setup Instructions

### Prerequisites
- Supabase project created
- Access to Supabase SQL Editor
- Service role key configured in `.env.local`

### Step 1: Create Core Tables

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `create-public-schema-tables.sql`
4. Paste into SQL Editor and click **RUN**

Expected output:
```
✅ Public schema tables created successfully!
📊 Created 19 tables with all indexes
🔒 Row Level Security enabled on all tables
```

### Step 2: Apply Core RLS Policies

1. In the SQL Editor, create a new query
2. Copy the contents of `create-public-schema-rls.sql`
3. Paste into SQL Editor and click **RUN**

Expected output:
```
✅ RLS policies created successfully for public schema!
🔒 All 19 tables are now protected with Row Level Security
```

### Step 3: Create Additional Tables

1. In the SQL Editor, create a new query
2. Copy the contents of `create-missing-tables.sql`
3. Paste into SQL Editor and click **RUN**

Expected output:
```
✅ Additional tables created successfully!
📊 Created 6 additional tables
🔒 RLS enabled on all tables
```

### Step 4: Apply Additional RLS Policies

1. In the SQL Editor, create a new query
2. Copy the contents of `create-missing-tables-rls.sql`
3. Paste into SQL Editor and click **RUN**

Expected output:
```
✅ RLS policies for additional tables created successfully!
✨ Total: 20 additional RLS policies created
```

### Step 5: Verify Setup

Run the health check endpoint:

```bash
curl http://localhost:3002/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "All database tables accessible",
  "checks": {
    "public.profiles": { "status": "ok", "rowCount": 0 },
    "public.organizations": { "status": "ok", "rowCount": 0 },
    "public.projects": { "status": "ok", "rowCount": 0 },
    "public.tasks": { "status": "ok", "rowCount": 0 },
    "public.notifications": { "status": "ok", "rowCount": 0 }
  },
  "timestamp": "2026-01-16T..."
}
```

## Database Schema

### Core Tables (19 tables)

#### 1. User Management
- `profiles` - User profiles and settings

#### 2. Organization Structure
- `organizations` - Company/organization details
- `organization_members` - Users belonging to organizations
- `teams` - Teams within organizations
- `team_members` - Users belonging to teams

#### 3. Project Management
- `projects` - Projects and their settings
- `project_members` - Users assigned to projects

#### 4. Task Management
- `tasks` - Main tasks/work items
- `task_assignments` - Users assigned to specific tasks
- `subtasks` - Checklist items within tasks
- `comments` - Comments on tasks
- `attachments` - Files attached to tasks

#### 5. Time & Activity Tracking
- `time_entries` - Time tracking for tasks
- `activity_logs` - Audit trail of changes

#### 6. Notifications & Communication
- `notifications` - User notifications/alerts
- `mentions` - @mentions in comments
- `attention_items` - Items requiring user attention

#### 7. Integrations
- `webhooks` - Webhook configurations
- `slack_integrations` - Slack bot integration settings

### Additional Tables (6 tables)

#### 8. User Preferences & Settings
- `user_preferences` - User settings (theme, notifications, language, timezone)

#### 9. Authentication & Security
- `password_reset_pins` - Temporary PINs for password reset flow

#### 10. Invitation Management
- `project_invitations` - Project membership invitation tracking

#### 11. Organization Features
- `org_slack_integrations` - Organization-level Slack integration
- `organization_announcements` - Organization-wide announcements
- `organization_meetings` - Meeting schedules and details

**Total: 25 tables**

## Key Features

### Enum Types
- `task_status`: todo, in_progress, review, done, archived
- `task_priority`: none, low, medium, high, urgent
- `project_role`: owner, admin, editor, reader
- `notification_type`: task_assigned, task_updated, mention, etc.
- `webhook_event`: task_created, task_updated, etc.
- `attention_type`: mention, assignment, due_soon, etc.

### Slack Integration
The `tasks` table includes Slack-specific fields:
- `slack_thread_ts` - Slack thread timestamp
- `slack_message_ts` - Slack message timestamp
- `slack_user_id` - Slack user who created
- `slack_user_name` - Slack username
- `created_by_slack` - Boolean flag

### Approval Workflow
The `tasks` table includes approval workflow fields:
- `approval_status`: none, pending, approved, rejected
- `approved_at` - Timestamp of approval
- `approved_by` - User who approved
- `rejection_reason` - Reason for rejection

## RLS Policies Summary

### Security Model
- **Profiles**: All users can view profiles; users can only update their own
- **Organizations**: Users can only see orgs they belong to; owners can manage
- **Projects**: Users can only access projects they're members of
- **Tasks**: Access controlled by project membership; role-based editing
- **Comments/Subtasks**: Inherit access from parent task
- **Notifications**: Users can only see their own notifications

### Role Hierarchy
1. **Organization**: owner > admin > member
2. **Team**: owner > admin > member
3. **Project**: owner > admin > editor > reader

## Troubleshooting

### Issue: Tables not accessible
**Error**: "Could not find the table 'public.profiles'"

**Solution**: Ensure you've run `create-public-schema-tables.sql` first

### Issue: Permission denied
**Error**: "new row violates row-level security policy"

**Solution**:
1. Verify RLS policies are applied: Run `create-public-schema-rls.sql`
2. Check user authentication: Ensure `auth.uid()` returns valid user ID
3. Verify user has proper role in organization/project

### Issue: Infinite recursion in policy
**Error**: "infinite recursion detected in policy"

**Solution**: This shouldn't occur with the provided policies. If it does:
1. Drop all policies: Run the DROP POLICY section of `create-public-schema-rls.sql`
2. Re-create policies: Run the full `create-public-schema-rls.sql` again

## Migration from TODOAAPP Schema

If you previously used the TODOAAPP custom schema:

1. **Don't migrate data** - The old schema structure is incompatible
2. **Fresh start**: Run the public schema scripts on a clean database
3. **Update code**: Ensure all queries use `.from('table_name')` without schema qualifiers
4. **Remove TODOAAPP references**: Search for `TODOAAPP.` in your codebase and remove

## Next Steps

After database setup:

1. ✅ Start the development server: `npm run dev`
2. ✅ Test the health endpoint: `http://localhost:3002/api/health`
3. ✅ Create your first user account
4. ✅ Create your first organization and project
5. ✅ Start creating tasks!

## Code Examples

### Correct Query Pattern

```typescript
// ✅ Correct - No schema qualifier
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('project_id', projectId)

// ✅ Correct - Simple table names
const { data } = await supabase
  .from('project_members')
  .select('role')
  .eq('user_id', userId)
```

### Incorrect Query Pattern

```typescript
// ❌ Wrong - Don't use schema qualifiers
const { data } = await supabase
  .from('TODOAAPP.tasks')  // NO!
  .select('*')

// ❌ Wrong - Don't use public prefix
const { data } = await supabase
  .from('public.tasks')  // NO!
  .select('*')
```

## Support

For issues or questions:
1. Check the [Supabase Documentation](https://supabase.com/docs)
2. Review the SQL scripts for table definitions
3. Check the application logs for detailed error messages
4. Verify your Supabase environment variables in `.env.local`

## Architecture Files

Related documentation:
- `create-public-schema-tables.sql` - Core table definitions (19 tables)
- `create-public-schema-rls.sql` - Core RLS policies (49 policies)
- `create-missing-tables.sql` - Additional table definitions (6 tables)
- `create-missing-tables-rls.sql` - Additional RLS policies (20 policies)
- `app/api/health/route.ts` - Health check endpoint
- `TODOAAPP-TABLES.md` - Original schema documentation (for reference only)

---

**Last Updated**: 2026-01-16
**Schema Version**: 1.0.0 (Public Schema)
**Total Tables**: 25 (19 core + 6 additional)
**Total RLS Policies**: 69 (49 core + 20 additional)
