-- Database schema for storing email OAuth2 tokens securely
-- Run this SQL in your Supabase SQL editor

-- Create email_tokens table
CREATE TABLE IF NOT EXISTS public.email_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL, -- 'gmail', 'outlook', etc.
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_type text DEFAULT 'Bearer',
  expiry_date timestamp with time zone NOT NULL,
  scope text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,

  -- Ensure only one token per provider
  CONSTRAINT email_tokens_provider_unique UNIQUE (provider)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_tokens_provider ON public.email_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_email_tokens_expiry_date ON public.email_tokens(expiry_date);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.email_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow service role to access tokens (server-side)
CREATE POLICY "Service role full access to email tokens"
ON public.email_tokens
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_email_tokens_updated_at
BEFORE UPDATE ON public.email_tokens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.email_tokens IS 'Stores OAuth2 tokens for email service providers (Gmail, Outlook, etc.)';
COMMENT ON COLUMN public.email_tokens.provider IS 'Email service provider (gmail, outlook, etc.)';
COMMENT ON COLUMN public.email_tokens.access_token IS 'OAuth2 access token for API access';
COMMENT ON COLUMN public.email_tokens.refresh_token IS 'OAuth2 refresh token for obtaining new access tokens';
COMMENT ON COLUMN public.email_tokens.expiry_date IS 'When the access token expires';
COMMENT ON COLUMN public.email_tokens.scope IS 'OAuth2 scopes granted to the application';