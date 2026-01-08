-- Add Slack tracking fields to tasks table for threading support
-- This enables same-day updates to be posted in thread of original message

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS slack_thread_ts TEXT,
  ADD COLUMN IF NOT EXISTS slack_message_ts TEXT;

-- Create index for faster lookups when checking for existing threads
CREATE INDEX IF NOT EXISTS idx_tasks_slack_thread ON public.tasks(slack_thread_ts) WHERE slack_thread_ts IS NOT NULL;

COMMENT ON COLUMN public.tasks.slack_thread_ts IS 'Slack thread timestamp for grouping same-day updates';
COMMENT ON COLUMN public.tasks.slack_message_ts IS 'Most recent Slack message timestamp for this task';
