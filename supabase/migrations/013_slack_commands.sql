-- Add columns to track tasks created from Slack
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS created_by_slack BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS slack_user_id TEXT,
  ADD COLUMN IF NOT EXISTS slack_user_name TEXT;

-- Comment on columns
COMMENT ON COLUMN public.tasks.created_by_slack IS 'Whether this task was created via Slack slash command';
COMMENT ON COLUMN public.tasks.slack_user_id IS 'Slack user ID who created the task';
COMMENT ON COLUMN public.tasks.slack_user_name IS 'Slack username who created the task';

-- Index for Slack-created tasks
CREATE INDEX IF NOT EXISTS idx_tasks_slack_user ON public.tasks(slack_user_id) WHERE slack_user_id IS NOT NULL;
