-- Update Slack integrations to use Access Token instead of Webhook
-- This provides more flexibility and simpler setup for users

-- Add new columns for access token authentication
ALTER TABLE public.slack_integrations
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS channel_id TEXT;

-- Make webhook_url optional (nullable) since we're moving to access tokens
ALTER TABLE public.slack_integrations
  ALTER COLUMN webhook_url DROP NOT NULL;

-- Add an index on channel_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_slack_integrations_channel_id ON public.slack_integrations(channel_id);

-- Comment on the new columns
COMMENT ON COLUMN public.slack_integrations.access_token IS 'Slack Bot User OAuth Access Token for sending messages';
COMMENT ON COLUMN public.slack_integrations.channel_id IS 'Slack channel ID where notifications will be sent';
