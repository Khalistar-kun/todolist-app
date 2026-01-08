-- Enable Supabase Realtime for organization-related tables
-- This allows real-time subscriptions to work on these tables

-- Safe version that checks before adding to avoid errors

-- Enable realtime for organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'organizations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE organizations;
  END IF;
END $$;

-- Enable realtime for organization_members table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'organization_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE organization_members;
  END IF;
END $$;

-- Enable realtime for organization_announcements table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'organization_announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE organization_announcements;
  END IF;
END $$;

-- Enable realtime for organization_meetings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'organization_meetings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE organization_meetings;
  END IF;
END $$;

-- Enable realtime for notifications table (for real-time notification updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- Enable realtime for projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE projects;
  END IF;
END $$;

-- Enable realtime for tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
END $$;

-- Enable realtime for project_members table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_members;
  END IF;
END $$;

-- Enable realtime for profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
END $$;
