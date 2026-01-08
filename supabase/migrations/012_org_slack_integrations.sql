-- Organization Slack Integrations table
-- Each organization can have one Slack integration for announcements, meetings, and member notifications

CREATE TABLE IF NOT EXISTS public.org_slack_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  notify_on_announcement BOOLEAN DEFAULT true,
  notify_on_meeting BOOLEAN DEFAULT true,
  notify_on_member_join BOOLEAN DEFAULT true,
  notify_on_member_leave BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.org_slack_integrations ENABLE ROW LEVEL SECURITY;

-- Organization members can view Slack integrations
CREATE POLICY "Org members can view slack integrations" ON public.org_slack_integrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_slack_integrations.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Only organization admins and owners can manage Slack integrations
CREATE POLICY "Org admins can manage slack integrations" ON public.org_slack_integrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_slack_integrations.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_slack_integrations_org_id ON public.org_slack_integrations(organization_id);

-- Enable realtime for org_slack_integrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'org_slack_integrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_slack_integrations;
  END IF;
END $$;

-- Grant permissions
GRANT ALL ON public.org_slack_integrations TO authenticated;
GRANT ALL ON public.org_slack_integrations TO service_role;

-- Comment on table
COMMENT ON TABLE public.org_slack_integrations IS 'Slack integration settings for organizations';
COMMENT ON COLUMN public.org_slack_integrations.access_token IS 'Slack Bot User OAuth Access Token';
COMMENT ON COLUMN public.org_slack_integrations.channel_id IS 'Slack channel ID for notifications';
COMMENT ON COLUMN public.org_slack_integrations.notify_on_announcement IS 'Send notification when new announcement is posted';
COMMENT ON COLUMN public.org_slack_integrations.notify_on_meeting IS 'Send notification when new meeting is scheduled';
COMMENT ON COLUMN public.org_slack_integrations.notify_on_member_join IS 'Send notification when new member joins';
COMMENT ON COLUMN public.org_slack_integrations.notify_on_member_leave IS 'Send notification when member leaves';
