# Slack Integration Deployment Checklist

## Pre-Deployment

### 1. Database Setup
- [ ] Run migration: `sql/add_slack_fields_to_tasks.sql`
- [ ] Verify new fields exist:
  ```sql
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'tasks'
    AND column_name IN ('slack_thread_ts', 'slack_message_ts');
  ```
- [ ] Verify index created:
  ```sql
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'tasks' AND indexname = 'idx_tasks_slack_thread';
  ```

### 2. Slack Webhook Setup
- [ ] Create Slack app at https://api.slack.com/apps
- [ ] Enable Incoming Webhooks
- [ ] Add webhook to desired channel
- [ ] Copy webhook URL
- [ ] Test webhook with curl:
  ```bash
  curl -X POST -H 'Content-Type: application/json' \
    --data '{"text":"Test from deployment checklist"}' \
    YOUR_WEBHOOK_URL
  ```

### 3. Database Configuration
- [ ] Insert webhook config:
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
    '<project-id>',
    '<webhook-url>',
    '#channel-name',
    true,
    true,
    true,
    '<user-id>'
  );
  ```
- [ ] Verify insertion:
  ```sql
  SELECT * FROM slack_integrations WHERE project_id = '<project-id>';
  ```

## Testing

### 4. Automated Tests
- [ ] Set environment variable:
  ```bash
  export TEST_PROJECT_ID="your-project-id"
  ```
- [ ] Run test suite:
  ```bash
  npx tsx test-slack.ts
  ```
- [ ] Verify all 7 tests pass:
  - [ ] Test 1: Slack config fetch
  - [ ] Test 2: Task created notification
  - [ ] Test 3: Task updated notification
  - [ ] Test 4: Status changed notification
  - [ ] Test 5: Task deleted notification
  - [ ] Test 6: Threading logic
  - [ ] Test 7: Database schema

### 5. Manual Tests

#### Task Creation
- [ ] Open app in browser
- [ ] Create new task via TaskEditorModal
- [ ] Check Slack channel for "🆕 New Task Created" notification
- [ ] Verify task details in notification
- [ ] Check database:
  ```sql
  SELECT slack_thread_ts, slack_message_ts
  FROM tasks WHERE id = '<new-task-id>';
  ```
- [ ] Verify both fields are populated

#### Task Update (Same Day)
- [ ] Update the task you just created
- [ ] Check Slack for "✏️ Task Updated" as threaded reply
- [ ] Verify changes shown in notification
- [ ] Check database:
  ```sql
  SELECT slack_thread_ts, slack_message_ts, updated_at
  FROM tasks WHERE id = '<task-id>';
  ```
- [ ] Verify `slack_thread_ts` unchanged, `slack_message_ts` updated

#### Task Update (Different Day)
- [ ] Wait 24 hours OR manually set old timestamp:
  ```sql
  UPDATE tasks
  SET slack_message_ts = '1000000000.000000'
  WHERE id = '<task-id>';
  ```
- [ ] Update the task again
- [ ] Check Slack for new message (not threaded)
- [ ] Verify both timestamps updated in database

#### Status Toggle (Checkbox)
- [ ] Go to TaskList view
- [ ] Click checkbox to toggle task status
- [ ] Check Slack for "📋 Task Moved to DONE/TODO"
- [ ] Verify status transition shown correctly

#### Status Change (Kanban)
- [ ] Go to KanbanBoard view
- [ ] Drag task from one column to another
- [ ] Check Slack for status change notification
- [ ] Verify old → new status shown

#### Task Deletion
- [ ] Open task in TaskEditorModal
- [ ] Click Delete button
- [ ] Check Slack for "🗑️ Task Deleted" notification
- [ ] Verify task removed from database

### 6. Edge Cases

#### No Slack Config
- [ ] Remove Slack config from database:
  ```sql
  DELETE FROM slack_integrations WHERE project_id = '<test-project-id>';
  ```
- [ ] Create/update/delete tasks
- [ ] Verify app works normally (no crashes)
- [ ] Verify no Slack notifications sent
- [ ] Re-insert Slack config

#### Invalid Webhook
- [ ] Update webhook to invalid URL:
  ```sql
  UPDATE slack_integrations
  SET webhook_url = 'https://invalid-webhook-url'
  WHERE project_id = '<project-id>';
  ```
- [ ] Create a task
- [ ] Check browser console for error
- [ ] Verify app continues to work
- [ ] Restore valid webhook URL

#### No Changes on Update
- [ ] Open existing task
- [ ] Don't change anything
- [ ] Click Save
- [ ] Verify NO Slack notification sent (change detection works)

## Deployment

### 7. Code Review
- [ ] Review `src/lib/slack.ts` for any TODOs
- [ ] Check all console.error calls are appropriate
- [ ] Verify no sensitive data in logs
- [ ] Confirm TypeScript compilation succeeds:
  ```bash
  npx tsc --noEmit
  ```

### 8. Environment Variables
- [ ] Verify `.env.local` has:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] No Slack credentials in environment variables (all in DB)

### 9. Build & Deploy
- [ ] Run production build:
  ```bash
  npm run build
  ```
- [ ] Fix any build errors
- [ ] Deploy to production
- [ ] Verify deployment succeeded

## Post-Deployment

### 10. Production Verification
- [ ] Test task creation in production
- [ ] Verify Slack notification received
- [ ] Test all notification types
- [ ] Monitor error logs for 24 hours
- [ ] Check Slack rate limits not exceeded

### 11. User Communication
- [ ] Notify team about new Slack integration
- [ ] Share Slack channel name
- [ ] Provide link to `SLACK_QUICK_START.md`
- [ ] Set expectations for notification frequency

### 12. Monitoring
- [ ] Set up alerts for failed Slack webhooks
- [ ] Monitor database growth (slack_thread_ts fields)
- [ ] Track Slack API usage
- [ ] Review notification frequency after 1 week

## Rollback Plan

If issues occur:

### Emergency Rollback
- [ ] Keep Slack integration in database (doesn't affect app)
- [ ] If needed, disable notifications:
  ```sql
  UPDATE slack_integrations
  SET notify_on_task_create = false,
      notify_on_task_assign = false,
      notify_on_task_complete = false
  WHERE project_id = '<project-id>';
  ```

### Full Rollback
- [ ] Remove Slack config:
  ```sql
  DELETE FROM slack_integrations WHERE project_id = '<project-id>';
  ```
- [ ] Revert code changes (git revert)
- [ ] Optional: Remove slack fields from tasks table:
  ```sql
  ALTER TABLE tasks DROP COLUMN IF EXISTS slack_thread_ts;
  ALTER TABLE tasks DROP COLUMN IF EXISTS slack_message_ts;
  ```

## Documentation

### 13. Final Steps
- [ ] Archive this checklist with deployment date
- [ ] Update team wiki with Slack integration docs
- [ ] Add to onboarding documentation
- [ ] Schedule review meeting after 2 weeks

## Sign-Off

- [ ] Developer tested: _________________ Date: _______
- [ ] QA verified: _____________________ Date: _______
- [ ] Deployed to production: __________ Date: _______
- [ ] Post-deployment verified: ________ Date: _______

---

**Deployment Notes:**

Date: _______________
Deployed by: _______________
Issues encountered: _______________________________________________
_______________________________________________________________

**Status:** [ ] Success [ ] Partial [ ] Failed

---

**Need Help?**
- Test script: `npx tsx test-slack.ts`
- Quick start: `SLACK_QUICK_START.md`
- Full guide: `SLACK_INTEGRATION_GUIDE.md`
- Technical details: `SLACK_IMPLEMENTATION_SUMMARY.md`
