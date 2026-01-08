# Slack Webhook Integration Guide

## Overview

This TodoApp now includes comprehensive Slack webhook integration that sends real-time notifications to your Slack channels when tasks are created, updated, deleted, or moved between statuses.

## Features

### 1. Threading Support
- **Same-day updates**: Updates to a task on the same day are posted as threaded replies to the original message
- **Different-day updates**: Updates on a new day create a fresh message (new thread)
- This keeps your Slack channel organized and easy to follow

### 2. Notification Types

#### 🆕 Task Created
Sent when a new task is created via the TaskEditorModal
- Shows task title, description, status, assignees, and due date

#### ✏️ Task Updated
Sent when task details are modified via the TaskEditorModal
- Only sends if there are significant changes (title, description, assignees, due date, or status)
- Shows exactly what changed with before/after values
- Uses threading for same-day updates

#### 🗑️ Task Deleted
Sent when a task is deleted
- Uses threading if deleted on the same day it was last updated

#### 📋 Status Changed
Sent when task status changes via:
- TaskList checkbox toggle (todo ↔ done)
- KanbanBoard drag & drop (todo → in_progress → done)
- Shows status transition with emojis

## Database Schema

### Migration: `add_slack_fields_to_tasks.sql`

Adds two new fields to the `tasks` table:

```sql
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS slack_thread_ts TEXT,
  ADD COLUMN IF NOT EXISTS slack_message_ts TEXT;
```

- `slack_thread_ts`: The original thread timestamp (set once on first message)
- `slack_message_ts`: Most recent message timestamp (updated on each notification)

## Setup Instructions

### 1. Run Database Migration

```bash
# Connect to your Supabase database and run:
psql -h <your-supabase-host> -U postgres -d postgres -f sql/add_slack_fields_to_tasks.sql
```

Or use the Supabase SQL Editor to execute the migration.

### 2. Create Slack Incoming Webhook

1. Go to https://api.slack.com/apps
2. Create a new app (or use existing)
3. Navigate to "Incoming Webhooks"
4. Activate Incoming Webhooks
5. Click "Add New Webhook to Workspace"
6. Select the channel where you want notifications
7. Copy the webhook URL (looks like: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`)

### 3. Configure Slack Integration in Database

Insert your Slack webhook into the `slack_integrations` table:

```sql
INSERT INTO public.slack_integrations (
  project_id,
  webhook_url,
  channel_name,
  notify_on_task_create,
  notify_on_task_assign,
  notify_on_task_complete,
  created_by
) VALUES (
  '<your-project-id>',
  'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
  '#your-channel-name',
  true,
  true,
  true,
  '<your-user-id>'
);
```

## Code Architecture

### `/src/lib/slack.ts`
Core Slack integration library with:
- `getSlackConfig()`: Fetch Slack config from database
- `notifyTaskCreated()`: Send task creation notification
- `notifyTaskUpdated()`: Send task update notification
- `notifyTaskDeleted()`: Send task deletion notification
- `notifyStatusChanged()`: Send status change notification
- `shouldUseThread()`: Determine if update should be threaded
- `detectTaskChanges()`: Compare old/new task to find changes
- `updateTaskSlackThread()`: Update task with Slack timestamps

### Integration Points

#### TaskEditorModal (`/src/components/TaskEditorModal.tsx`)
- **Create**: Sends notification when new task is saved
- **Update**: Sends notification when task is modified (only if changes detected)
- **Delete**: Sends notification when task is deleted

#### TaskList (`/src/components/TaskList.tsx`)
- **Status Toggle**: Sends notification when checkbox is toggled (todo ↔ done)

#### KanbanBoard (`/src/components/KanbanBoard.tsx`)
- **Drag & Drop**: Sends notification when task is moved between columns

## Message Format Examples

### Task Created
```
🆕 New Task Created
━━━━━━━━━━━━━━━━━━━
Implement Slack Integration

Description: Add webhook notifications for all task events
Status: 🔄 IN PROGRESS
Assignees: user@example.com
Due: Jan 15, 2025 5:00 PM
```

### Task Updated
```
✏️ Task Updated
━━━━━━━━━━━━━━━━━━━
Implement Slack Integration

Status: 🔄 in progress → ✅ done
Due: Jan 17, 2025 3:00 PM
```

### Task Deleted
```
🗑️ Task Deleted
━━━━━━━━━━━━━━━━━━━
Old Task Name

This task has been deleted.
```

### Status Changed
```
📋 Task Moved to DONE
━━━━━━━━━━━━━━━━━━━
Implement Slack Integration

⏳ todo → ✅ done
```

## Testing

### Manual Testing Checklist

1. **Task Creation**
   - [ ] Create a new task via TaskEditorModal
   - [ ] Verify Slack notification appears
   - [ ] Check that `slack_thread_ts` and `slack_message_ts` are set in database

2. **Task Update (Same Day)**
   - [ ] Update the task you just created (within same day)
   - [ ] Verify notification appears as threaded reply
   - [ ] Check that `slack_message_ts` is updated but `slack_thread_ts` remains the same

3. **Task Update (Different Day)**
   - [ ] Wait until next day or manually update timestamps in database
   - [ ] Update the task again
   - [ ] Verify new message is created (not threaded)
   - [ ] Check that both timestamps are updated

4. **Status Toggle (Checkbox)**
   - [ ] Toggle task status via checkbox in TaskList
   - [ ] Verify status change notification

5. **Status Change (Kanban)**
   - [ ] Drag task between columns in KanbanBoard
   - [ ] Verify status change notification

6. **Task Deletion**
   - [ ] Delete a task
   - [ ] Verify deletion notification

### Automated Testing Script

```typescript
// test-slack-integration.ts
import { getSupabaseBrowser } from '@/lib/supabase/client'
import {
  getSlackConfig,
  notifyTaskCreated,
  notifyTaskUpdated,
  notifyStatusChanged,
  notifyTaskDeleted,
  updateTaskSlackThread,
} from '@/lib/slack'

async function testSlackIntegration() {
  const sb = getSupabaseBrowser()
  const projectId = '<your-project-id>'

  // 1. Test config fetch
  console.log('Testing Slack config fetch...')
  const config = await getSlackConfig(sb, projectId)
  console.log('Config:', config)

  if (!config) {
    console.error('No Slack config found!')
    return
  }

  // 2. Test task creation notification
  console.log('Testing task creation notification...')
  const testTask = {
    id: 'test-' + Date.now(),
    title: 'Test Task',
    description: 'This is a test task',
    status: 'todo' as const,
    assignees: ['test@example.com'],
    due_at: new Date().toISOString(),
  }

  await notifyTaskCreated(config, testTask)
  console.log('✓ Task creation notification sent')

  // 3. Test update notification
  console.log('Testing task update notification...')
  const changes = {
    status: { old: 'todo' as const, new: 'in_progress' as const },
    description: { old: 'Old description', new: 'New description' },
  }

  await notifyTaskUpdated(config, testTask as any, changes)
  console.log('✓ Task update notification sent')

  console.log('All tests passed! ✓')
}
```

## Troubleshooting

### Notifications Not Sending

1. **Check Slack webhook URL**
   - Ensure webhook URL is correct in `slack_integrations` table
   - Test webhook with curl:
     ```bash
     curl -X POST -H 'Content-Type: application/json' \
       --data '{"text":"Test message"}' \
       YOUR_WEBHOOK_URL
     ```

2. **Check database permissions**
   - Ensure RLS policies allow reading from `slack_integrations` table
   - Verify user has access to the project

3. **Check browser console**
   - Open DevTools → Console
   - Look for errors from Slack API calls

### Threading Not Working

1. **Verify timestamps**
   - Check that `slack_thread_ts` and `slack_message_ts` are set
   - Ensure timestamps are in correct format (seconds.microseconds)

2. **Check date logic**
   - `shouldUseThread()` compares message date with today
   - If message is from different day, new thread is created

### Performance Concerns

- Slack notifications are sent asynchronously
- They don't block the UI or database operations
- Failed notifications are logged to console but don't break the app

## Future Enhancements

Potential improvements:
- [ ] Add retry logic for failed webhook calls
- [ ] Queue notifications for batch sending
- [ ] Add Slack buttons for task actions (mark done, assign, etc.)
- [ ] Support multiple Slack channels per project
- [ ] Add notification preferences per user
- [ ] Rich formatting with Slack Block Kit
- [ ] @mention assignees in Slack notifications

## API Reference

See `/src/lib/slack.ts` for full API documentation with JSDoc comments.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Verify database schema matches migration
4. Test webhook URL independently
