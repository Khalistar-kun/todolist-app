# Slack Integration Quick Start

## TL;DR

This TodoApp automatically sends Slack notifications when:
- ✅ Tasks are created, updated, deleted
- ✅ Task status changes (checkbox toggle or Kanban drag & drop)
- ✅ Same-day updates are threaded together

## Setup (5 minutes)

### 1. Run Migration
```sql
-- In Supabase SQL Editor:
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS slack_thread_ts TEXT,
  ADD COLUMN IF NOT EXISTS slack_message_ts TEXT;
```

### 2. Create Slack Webhook
1. Go to https://api.slack.com/apps → Create New App
2. Features → Incoming Webhooks → Activate
3. Add New Webhook to Workspace → Choose channel
4. Copy webhook URL

### 3. Configure Project
```sql
INSERT INTO public.slack_integrations (
  project_id,
  webhook_url,
  channel_name,
  created_by
) VALUES (
  '<your-project-id>',
  'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
  '#your-channel',
  '<your-user-id>'
);
```

### 4. Test
```bash
# Set environment variables
export TEST_PROJECT_ID="your-project-id"

# Run test script
npx tsx test-slack.ts
```

## Usage

No code changes needed! The integration works automatically:

### Creating Tasks
```typescript
// TaskEditorModal.tsx already integrated
// When you save a new task → Slack notification sent ✓
```

### Updating Tasks
```typescript
// TaskEditorModal.tsx already integrated
// When you edit and save → Slack notification sent ✓
// Same-day updates appear as thread replies
```

### Status Changes
```typescript
// TaskList.tsx checkbox already integrated
// When you check/uncheck → Slack notification sent ✓

// KanbanBoard.tsx drag & drop already integrated
// When you drag task to new column → Slack notification sent ✓
```

## Threading Logic

```
Day 1, 10:00 AM: Task created
  └─ 10:30 AM: Task updated (threaded reply)
  └─ 11:15 AM: Task updated (threaded reply)

Day 2, 9:00 AM: Task updated (new message, new thread)
  └─ 9:45 AM: Task updated (threaded reply)
```

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/slack.ts` | Core Slack integration library |
| `sql/add_slack_fields_to_tasks.sql` | Database migration |
| `test-slack.ts` | Test script |
| `SLACK_INTEGRATION_GUIDE.md` | Full documentation |

## Troubleshooting

### Notifications not appearing?

1. Check webhook URL in database:
```sql
SELECT webhook_url, channel_name
FROM slack_integrations
WHERE project_id = '<your-project-id>';
```

2. Test webhook directly:
```bash
curl -X POST -H 'Content-Type: application/json' \
  --data '{"text":"Test"}' \
  YOUR_WEBHOOK_URL
```

3. Check browser console for errors

### Threading not working?

1. Verify database fields exist:
```sql
SELECT slack_thread_ts, slack_message_ts
FROM tasks
WHERE id = '<task-id>';
```

2. Ensure updates are same-day (check `slack_message_ts` date)

## API Quick Reference

```typescript
import {
  getSlackConfig,
  notifyTaskCreated,
  notifyTaskUpdated,
  notifyStatusChanged,
  notifyTaskDeleted,
} from '@/lib/slack'

// Get config
const config = await getSlackConfig(supabase, projectId)

// Send notifications
await notifyTaskCreated(config, task)
await notifyTaskUpdated(config, task, changes)
await notifyStatusChanged(config, task, oldStatus, newStatus)
await notifyTaskDeleted(config, task)
```

## Next Steps

- [ ] Customize message format in `src/lib/slack.ts`
- [ ] Add more notification types
- [ ] Configure multiple channels per project
- [ ] Add user notification preferences

## Support

See `SLACK_INTEGRATION_GUIDE.md` for full documentation.
