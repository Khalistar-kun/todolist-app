-- =====================================================
-- FIX SLACK INTEGRATION AFTER DATABASE RECOVERY
-- Run this to diagnose and fix Slack notifications
-- =====================================================

-- STEP 1: Check if slack_integrations table exists and has correct structure
SELECT 'STEP 1: Checking table structure...' as status;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'slack_integrations'
ORDER BY ordinal_position;

-- STEP 2: Check current Slack configurations (shows all projects with Slack setup)
SELECT 'STEP 2: Current Slack configurations...' as status;

SELECT
  si.id,
  si.project_id,
  p.name as project_name,
  CASE WHEN si.access_token IS NOT NULL THEN 'YES' ELSE 'NO' END as has_access_token,
  CASE WHEN si.webhook_url IS NOT NULL THEN 'YES' ELSE 'NO' END as has_webhook_url,
  si.channel_id,
  si.channel_name,
  si.notify_on_task_create,
  si.notify_on_task_update,
  si.notify_on_task_delete,
  si.notify_on_task_move,
  si.notify_on_task_complete,
  si.created_at,
  si.updated_at
FROM slack_integrations si
LEFT JOIN projects p ON si.project_id = p.id
ORDER BY si.created_at DESC;

-- STEP 3: Check if any projects exist without Slack config
SELECT 'STEP 3: Projects WITHOUT Slack integration...' as status;

SELECT
  p.id as project_id,
  p.name as project_name,
  p.created_at
FROM projects p
LEFT JOIN slack_integrations si ON p.id = si.project_id
WHERE si.id IS NULL
ORDER BY p.created_at DESC;

-- STEP 4: Check RLS policies on slack_integrations
SELECT 'STEP 4: RLS policies on slack_integrations...' as status;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'slack_integrations';

-- STEP 5: Check if RLS is enabled
SELECT 'STEP 5: RLS status...' as status;

SELECT
  relname as table_name,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as rls_forced
FROM pg_class
WHERE relname = 'slack_integrations';

-- =====================================================
-- IF SLACK CONFIG IS MISSING, RUN THIS TO RE-ADD IT:
-- (Replace the values with your actual Slack credentials)
-- =====================================================

/*
-- OPTION A: If you have a project but no Slack integration row
INSERT INTO slack_integrations (
  project_id,
  access_token,
  channel_id,
  channel_name,
  notify_on_task_create,
  notify_on_task_update,
  notify_on_task_delete,
  notify_on_task_move,
  notify_on_task_complete
) VALUES (
  'YOUR-PROJECT-ID-HERE',           -- Get from projects table
  'xoxb-your-slack-bot-token',      -- From Slack App OAuth
  'C0123456789',                     -- Channel ID from Slack
  '#your-channel-name',              -- Optional: channel name for reference
  true,                              -- notify on create
  true,                              -- notify on update
  true,                              -- notify on delete
  true,                              -- notify on move
  true                               -- notify on complete
);
*/

/*
-- OPTION B: If the row exists but needs to be updated
UPDATE slack_integrations
SET
  access_token = 'xoxb-your-new-token',
  channel_id = 'C0123456789',
  notify_on_task_create = true,
  notify_on_task_update = true,
  notify_on_task_delete = true,
  notify_on_task_move = true,
  notify_on_task_complete = true,
  updated_at = NOW()
WHERE project_id = 'YOUR-PROJECT-ID-HERE';
*/

-- =====================================================
-- FIX: Ensure all notification flags are TRUE
-- (In case they got reset to NULL or false)
-- =====================================================

SELECT 'STEP 6: Fixing NULL notification flags...' as status;

UPDATE slack_integrations
SET
  notify_on_task_create = COALESCE(notify_on_task_create, true),
  notify_on_task_update = COALESCE(notify_on_task_update, true),
  notify_on_task_delete = COALESCE(notify_on_task_delete, true),
  notify_on_task_move = COALESCE(notify_on_task_move, true),
  notify_on_task_complete = COALESCE(notify_on_task_complete, true),
  updated_at = NOW()
WHERE notify_on_task_create IS NULL
   OR notify_on_task_update IS NULL
   OR notify_on_task_delete IS NULL
   OR notify_on_task_move IS NULL
   OR notify_on_task_complete IS NULL;

-- Show final state
SELECT 'FINAL: Updated Slack configurations...' as status;

SELECT
  si.id,
  p.name as project_name,
  CASE WHEN si.access_token IS NOT NULL THEN 'OK' ELSE 'MISSING!' END as token_status,
  CASE WHEN si.channel_id IS NOT NULL THEN si.channel_id ELSE 'MISSING!' END as channel_id,
  si.notify_on_task_create as "create",
  si.notify_on_task_update as "update",
  si.notify_on_task_delete as "delete",
  si.notify_on_task_move as "move",
  si.notify_on_task_complete as "complete"
FROM slack_integrations si
LEFT JOIN projects p ON si.project_id = p.id;
