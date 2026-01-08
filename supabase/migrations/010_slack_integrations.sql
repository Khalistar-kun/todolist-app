-- Slack Integrations table for project-level webhook configuration
-- Each project can have one Slack integration

CREATE TABLE IF NOT EXISTS public.slack_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  channel_name TEXT,
  notify_on_task_create BOOLEAN DEFAULT true,
  notify_on_task_update BOOLEAN DEFAULT true,
  notify_on_task_delete BOOLEAN DEFAULT true,
  notify_on_task_move BOOLEAN DEFAULT true,
  notify_on_task_complete BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Add Slack thread tracking fields to tasks table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'slack_thread_ts'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN slack_thread_ts TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'slack_message_ts'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN slack_message_ts TEXT;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.slack_integrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Project members can view slack integrations" ON public.slack_integrations;
DROP POLICY IF EXISTS "Project admins can manage slack integrations" ON public.slack_integrations;

-- Project members can view Slack integrations
CREATE POLICY "Project members can view slack integrations" ON public.slack_integrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = slack_integrations.project_id
      AND pm.user_id = auth.uid()
    )
  );

-- Only project admins and owners can manage Slack integrations
CREATE POLICY "Project admins can manage slack integrations" ON public.slack_integrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = slack_integrations.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('admin', 'owner')
    )
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_slack_integrations_project_id ON public.slack_integrations(project_id);

-- Enable realtime for slack_integrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'slack_integrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.slack_integrations;
  END IF;
END $$;
