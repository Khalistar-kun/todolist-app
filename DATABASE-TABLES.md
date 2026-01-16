# Database Tables Documentation

Complete list of all tables used in the Todo List application.

## Core User & Organization Tables

### 1. **profiles**
- **Purpose**: User profile information extending Supabase auth.users
- **Key Columns**: id, email, full_name, avatar_url, bio, phone, timezone, language
- **Relationships**:
  - Links to auth.users (1:1)
  - Referenced by organization_members, project_members, tasks, etc.

### 2. **organizations**
- **Purpose**: Multi-tenant organization/workspace management
- **Key Columns**: id, name, slug, description, logo_url, website, created_by
- **Relationships**:
  - Has many organization_members
  - Has many projects
  - Has many teams

### 3. **organization_members**
- **Purpose**: Organization membership with roles (owner, admin, member)
- **Key Columns**: id, organization_id, user_id, role, joined_at
- **Relationships**:
  - Belongs to organizations
  - Belongs to profiles (users)

## Project Management Tables

### 4. **projects**
- **Purpose**: Project/board management within organizations
- **Key Columns**: id, name, description, organization_id, team_id, created_by, color, status
- **Relationships**:
  - Belongs to organizations
  - Optionally belongs to teams
  - Has many project_members
  - Has many tasks

### 5. **project_members**
- **Purpose**: Project membership with roles (owner, admin, editor, reader)
- **Key Columns**: id, project_id, user_id, role, joined_at
- **Relationships**:
  - Belongs to projects
  - Belongs to profiles (users)

## Task Management Tables

### 6. **tasks**
- **Purpose**: Main task/todo items with kanban workflow
- **Key Columns**:
  - Basic: id, title, description, project_id, stage_id
  - Status: status (task_status enum), priority (task_priority enum)
  - Assignment: assigned_to, created_by
  - Dates: due_date, start_date, completed_at
  - Workflow: approval_status, approved_by, approved_at, rejection_reason
  - Slack: slack_thread_ts, slack_message_ts, slack_user_id, slack_user_name
  - Tracking: moved_to_done_at, moved_to_done_by
- **Total Columns**: 34
- **Relationships**:
  - Belongs to projects
  - Has many subtasks
  - Has many comments
  - Has many attachments
  - Has many time_entries
  - Has many activity_logs

### 7. **task_assignments**
- **Purpose**: Track task assignments (many-to-many relationship)
- **Key Columns**: id, task_id, user_id, assigned_at, assigned_by
- **Relationships**:
  - Belongs to tasks
  - Belongs to profiles (users)

### 8. **subtasks**
- **Purpose**: Checklist items within tasks
- **Key Columns**: id, task_id, title, completed, position, due_date
- **Relationships**:
  - Belongs to tasks

### 9. **comments**
- **Purpose**: Comments/discussions on tasks
- **Key Columns**: id, task_id, user_id, content, created_at, updated_at
- **Relationships**:
  - Belongs to tasks
  - Belongs to profiles (users)
  - Can have mentions

### 10. **attachments**
- **Purpose**: File attachments for tasks/comments
- **Key Columns**: id, task_id, comment_id, file_name, file_url, file_size, file_type
- **Relationships**:
  - Belongs to tasks (optional)
  - Belongs to comments (optional)

## Time Tracking & Activity

### 11. **time_entries**
- **Purpose**: Time tracking for tasks
- **Key Columns**: id, task_id, user_id, start_time, end_time, duration, description
- **Relationships**:
  - Belongs to tasks
  - Belongs to profiles (users)

### 12. **activity_logs**
- **Purpose**: Audit trail of all changes (who did what when)
- **Key Columns**: id, project_id, task_id, user_id, action, entity_type, entity_id, changes, created_at
- **Relationships**:
  - Belongs to projects (optional)
  - Belongs to tasks (optional)
  - Belongs to profiles (users)

## Notifications & Communication

### 13. **notifications**
- **Purpose**: User notifications for various events
- **Key Columns**: id, user_id, type (notification_type enum), title, message, data, is_read
- **Relationships**:
  - Belongs to profiles (users)

### 14. **webhooks**
- **Purpose**: Webhook configurations for external integrations
- **Key Columns**: id, project_id, url, events (webhook_event enum), secret, enabled
- **Relationships**:
  - Belongs to projects

### 15. **slack_integrations**
- **Purpose**: Slack webhook integration per project
- **Key Columns**:
  - id, project_id, webhook_url, channel_name
  - notify_on_task_create, notify_on_task_update, notify_on_task_delete
  - notify_on_task_move, notify_on_task_complete
- **Total Columns**: 14
- **Relationships**:
  - Belongs to projects (1:1 relationship)

## Team Structure

### 16. **teams**
- **Purpose**: Team hierarchy within organizations (Organization → Teams → Projects)
- **Key Columns**: id, organization_id, name, description, color, image_url, created_by
- **Relationships**:
  - Belongs to organizations
  - Has many team_members
  - Has many projects

### 17. **team_members**
- **Purpose**: Team membership with roles (owner, admin, member)
- **Key Columns**: id, team_id, user_id, role, joined_at
- **Relationships**:
  - Belongs to teams
  - Belongs to profiles (users)

## Attention & Mentions System

### 18. **mentions**
- **Purpose**: Track @mentions in comments/tasks
- **Key Columns**:
  - id, mentioned_user_id, mentioner_user_id
  - task_id, comment_id, project_id
  - mention_context, created_at, read_at
- **Relationships**:
  - Belongs to profiles (mentioned_user_id and mentioner_user_id)
  - Belongs to tasks (optional)
  - Belongs to comments (optional)

### 19. **attention_items**
- **Purpose**: Unified inbox for user attention (mentions, assignments, due dates, etc.)
- **Key Columns**:
  - id, user_id
  - attention_type (enum: mention, assignment, due_soon, overdue, comment, status_change, unassignment)
  - priority (enum: urgent, high, normal, low)
  - task_id, comment_id, mention_id, project_id, actor_user_id
  - title, body
  - read_at, dismissed_at, actioned_at
  - dedup_key (prevents duplicate notifications)
- **Relationships**:
  - Belongs to profiles (user_id)
  - Links to tasks, comments, mentions, projects
  - Links to actor (user who triggered the attention item)

---

## Database Schema Summary

**Total Tables**: 19

**Table Categories**:
- **User & Organization**: 3 tables (profiles, organizations, organization_members)
- **Projects**: 2 tables (projects, project_members)
- **Tasks**: 4 tables (tasks, task_assignments, subtasks, comments)
- **Files & Time**: 2 tables (attachments, time_entries)
- **Activity & Notifications**: 2 tables (activity_logs, notifications)
- **Integrations**: 2 tables (webhooks, slack_integrations)
- **Teams**: 2 tables (teams, team_members)
- **Attention System**: 2 tables (mentions, attention_items)

## Enum Types

1. **task_priority**: none, low, medium, high, urgent
2. **task_status**: todo, in_progress, review, done, archived
3. **project_role**: owner, admin, editor, reader
4. **notification_type**: task_assigned, task_updated, comment_added, mention, etc.
5. **webhook_event**: task_created, task_updated, task_deleted, etc.
6. **attention_type**: mention, assignment, due_soon, overdue, comment, status_change, unassignment
7. **attention_priority**: urgent, high, normal, low

## Key Relationships Diagram

```
auth.users (Supabase Auth)
    ↓
profiles (1:1)
    ↓
    ├─→ organization_members ←→ organizations
    │                               ↓
    │                           teams ←→ team_members
    │                               ↓
    ├─→ project_members ←→ projects
    │                           ↓
    ├─→ tasks ←→ task_assignments
    │       ↓
    │       ├─→ subtasks
    │       ├─→ comments ←→ mentions
    │       ├─→ attachments
    │       ├─→ time_entries
    │       └─→ activity_logs
    │
    ├─→ notifications
    ├─→ attention_items
    └─→ slack_integrations (per project)
```

## Security

- **Row Level Security (RLS)**: Enabled on all tables
- **Policies**: Fine-grained access control based on organization/project membership
- **Authentication**: Uses Supabase Auth (auth.uid())

## Special Features

1. **Approval Workflow**: Tasks in "done" stage require approval from project owners/admins
2. **Slack Integration**: Bi-directional sync with Slack channels
3. **Attention Inbox**: Unified notification system with deduplication
4. **Time Tracking**: Built-in time entry system for tasks
5. **Activity Logs**: Complete audit trail of all changes
6. **@Mentions**: Track and notify mentioned users
7. **Multi-tenant**: Organization-based data isolation
