-- =====================================================
-- ADDITIONAL TABLES FOR PUBLIC SCHEMA
-- Run AFTER create-public-schema-tables.sql
-- These tables are used by various API endpoints
-- =====================================================

-- =====================================================
-- USER PREFERENCES TABLE
-- Stores user settings and preferences
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  weekly_digest BOOLEAN DEFAULT TRUE,
  task_reminders BOOLEAN DEFAULT TRUE,
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =====================================================
-- PASSWORD RESET PINS TABLE
-- Stores temporary PINs for password reset flow
-- =====================================================

CREATE TABLE IF NOT EXISTS public.password_reset_pins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  pin TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- PROJECT INVITATIONS TABLE
-- Manages project membership invitations
-- =====================================================

CREATE TABLE IF NOT EXISTS public.project_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.project_role NOT NULL DEFAULT 'reader',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  token TEXT UNIQUE,
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ORGANIZATION SLACK INTEGRATIONS TABLE
-- Organization-level Slack integration settings
-- =====================================================

CREATE TABLE IF NOT EXISTS public.org_slack_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  channel_name TEXT,
  channel_id TEXT,
  access_token TEXT,
  notify_on_announcement BOOLEAN DEFAULT TRUE,
  notify_on_meeting BOOLEAN DEFAULT TRUE,
  notify_on_project_create BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- =====================================================
-- ORGANIZATION ANNOUNCEMENTS TABLE
-- Organization-wide announcements
-- =====================================================

CREATE TABLE IF NOT EXISTS public.organization_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ORGANIZATION MEETINGS TABLE
-- Organization meeting schedules
-- =====================================================

CREATE TABLE IF NOT EXISTS public.organization_meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  meeting_link TEXT,
  location TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User Preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Password Reset Pins
CREATE INDEX IF NOT EXISTS idx_password_reset_pins_email ON public.password_reset_pins(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_pins_expires_at ON public.password_reset_pins(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_pins_email_verified ON public.password_reset_pins(email, verified)
  WHERE verified = TRUE;

-- Project Invitations
CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON public.project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON public.project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON public.project_invitations(status);
CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON public.project_invitations(token);
CREATE INDEX IF NOT EXISTS idx_project_invitations_pending ON public.project_invitations(email, status, expires_at)
  WHERE status = 'pending';

-- Organization Slack Integrations
CREATE INDEX IF NOT EXISTS idx_org_slack_integrations_org_id ON public.org_slack_integrations(organization_id);

-- Organization Announcements
CREATE INDEX IF NOT EXISTS idx_org_announcements_org_id ON public.organization_announcements(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_announcements_created_at ON public.organization_announcements(organization_id, created_at DESC);

-- Organization Meetings
CREATE INDEX IF NOT EXISTS idx_org_meetings_org_id ON public.organization_meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_meetings_scheduled_at ON public.organization_meetings(organization_id, scheduled_at);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_slack_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_meetings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Additional tables created successfully!';
  RAISE NOTICE '📊 Created 6 additional tables:';
  RAISE NOTICE '   - user_preferences';
  RAISE NOTICE '   - password_reset_pins';
  RAISE NOTICE '   - project_invitations';
  RAISE NOTICE '   - org_slack_integrations';
  RAISE NOTICE '   - organization_announcements';
  RAISE NOTICE '   - organization_meetings';
  RAISE NOTICE '🔒 RLS enabled on all tables';
  RAISE NOTICE '📋 Next step: Run create-missing-tables-rls.sql';
END $$;
