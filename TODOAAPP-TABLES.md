# TODOAAPP Schema Tables

## Complete Table List (19 Tables)

The TODOAAPP schema contains 19 tables organized by functional area:

### 1. User Management (1 table)
| # | Table | Description |
|---|-------|-------------|
| 1 | **profiles** | User profiles and settings |

### 2. Organization Structure (4 tables)
| # | Table | Description |
|---|-------|-------------|
| 2 | **organizations** | Company/organization details |
| 3 | **organization_members** | Users belonging to organizations |
| 4 | **teams** | Teams within organizations |
| 5 | **team_members** | Users belonging to teams |

### 3. Project Management (2 tables)
| # | Table | Description |
|---|-------|-------------|
| 6 | **projects** | Projects and their settings |
| 7 | **project_members** | Users assigned to projects |

### 4. Task Management (5 tables)
| # | Table | Description |
|---|-------|-------------|
| 8 | **tasks** | Main tasks/work items |
| 9 | **task_assignments** | Users assigned to specific tasks |
| 10 | **subtasks** | Checklist items within tasks |
| 11 | **comments** | Comments on tasks |
| 12 | **attachments** | Files attached to tasks |

### 5. Time & Activity Tracking (2 tables)
| # | Table | Description |
|---|-------|-------------|
| 13 | **time_entries** | Time tracking for tasks |
| 14 | **activity_logs** | Audit trail of changes |

### 6. Notifications & Communication (3 tables)
| # | Table | Description |
|---|-------|-------------|
| 15 | **notifications** | User notifications/alerts |
| 16 | **mentions** | @mentions in comments |
| 17 | **attention_items** | Items requiring user attention |

### 7. Integrations (2 tables)
| # | Table | Description |
|---|-------|-------------|
| 18 | **webhooks** | Webhook configurations |
| 19 | **slack_integrations** | Slack bot integration settings |

## Key Features by Table

### Core Tables with Slack Integration

**tasks** table includes Slack fields:
- `slack_thread_ts` - Slack thread timestamp
- `slack_message_ts` - Slack message timestamp
- `slack_user_id` - Slack user who created
- `slack_user_name` - Slack username
- `created_by_slack` - Boolean flag

**slack_integrations** table:
- `webhook_url` - Slack webhook URL (NOT NULL)
- `channel_id` - Slack channel ID
- `channel_name` - Slack channel name
- `access_token` - Slack bot token
- Notification toggles for various events

### Enums Used Across Tables

**task_status**
- `todo`, `in_progress`, `review`, `done`, `archived`

**task_priority**
- `none`, `low`, `medium`, `high`, `urgent`

**notification_type**
- `task_assigned`, `task_updated`, `task_completed`
- `comment_added`, `mention`
- `project_invite`, `organization_invite`

**organization_role / team_role**
- `owner`, `admin`, `member`

**project_role**
- `owner`, `admin`, `editor`, `reader`

## How to Verify Tables

### Option 1: SQL Query (in Supabase SQL Editor)

Run [check-todoaapp-schema.sql](check-todoaapp-schema.sql):

```sql
SELECT table_name, column_count, size
FROM information_schema.tables
WHERE table_schema = 'TODOAAPP'
ORDER BY table_name;
```

### Option 2: Node Script

```bash
node list-todoaapp-tables.js
```

### Option 3: Health Check API

```bash
curl http://localhost:3002/api/health
```

Checks 5 critical tables:
- profiles
- organizations
- projects
- tasks
- notifications

## Schema Relationships

```
organizations
  ├── organization_members (users in org)
  ├── teams
  │   └── team_members (users in team)
  └── projects
      ├── project_members (users in project)
      └── tasks
          ├── task_assignments (assigned users)
          ├── subtasks (checklist items)
          ├── comments
          │   └── mentions (@user refs)
          ├── attachments (files)
          ├── time_entries (time tracking)
          └── activity_logs (audit trail)

notifications → profiles (user notifications)
attention_items → profiles (user attention items)
webhooks → projects (webhook configs)
slack_integrations → projects (Slack configs)
```

## Row Level Security (RLS)

All 19 tables have RLS enabled with policies for:
- **SELECT** - Users can read data they have access to
- **INSERT** - Users can create data in their projects/organizations
- **UPDATE** - Users can update data based on role permissions
- **DELETE** - Owners/admins can delete data

See [create-todoaapp-rls.sql](create-todoaapp-rls.sql) for complete policies.

## Migration Status

To check if tables are populated with data:

```sql
-- Run in Supabase SQL Editor
SELECT
  'TODOAAPP.' || table_name as table_name,
  (SELECT COUNT(*) FROM TODOAAPP.[table_name]) as row_count
FROM information_schema.tables
WHERE table_schema = 'TODOAAPP'
ORDER BY table_name;
```

Or use the script in [check-todoaapp-schema.sql](check-todoaapp-schema.sql).
