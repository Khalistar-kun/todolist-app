-- =====================================================
-- EMERGENCY: DISABLE RLS FOR TESTING ONLY
-- This will help identify if RLS is the problem
-- DO NOT USE IN PRODUCTION - FOR DEBUGGING ONLY
-- =====================================================

-- ⚠️ WARNING: This temporarily disables Row Level Security
-- Use this ONLY to test if RLS is causing the 500 errors
-- After confirming, re-enable RLS and fix the policies properly

-- Disable RLS on all tables temporarily
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attention_items DISABLE ROW LEVEL SECURITY;

-- If task_dependencies exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_dependencies'
  ) THEN
    ALTER TABLE public.task_dependencies DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Message
DO $$
BEGIN
  RAISE NOTICE '⚠️  RLS TEMPORARILY DISABLED FOR TESTING';
  RAISE NOTICE '';
  RAISE NOTICE 'If your app works now, the problem is RLS policies.';
  RAISE NOTICE 'After testing, run RE-ENABLE-rls.sql to turn RLS back on.';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 IMPORTANT: DO NOT leave RLS disabled in production!';
END $$;
