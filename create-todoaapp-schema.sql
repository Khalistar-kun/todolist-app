-- =====================================================
-- CREATE TODOAAPP SCHEMA AND ALL TABLES
-- Complete database setup for TODOAAPP schema
-- =====================================================

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS TODOAAPP;

-- Set search path to use TODOAAPP schema
SET search_path TO TODOAAPP, public;

-- =====================================================
-- ENUM TYPES
-- =====================================================

DO $$ BEGIN
    CREATE TYPE TODOAAPP.task_priority AS ENUM ('none', 'low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE TODOAAPP.task_status AS ENUM ('todo', 'in_progress', 'review', 'done', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE TODOAAPP.project_role AS ENUM ('owner', 'admin', 'editor', 'reader');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE TODOAAPP.notification_type AS ENUM (
      'task_assigned', 'task_updated', 'task_completed', 'comment_added',
      'mention', 'project_invite', 'organization_invite'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE TODOAAPP.webhook_event AS ENUM (
      'task_created', 'task_updated', 'task_deleted', 'task_completed',
      'project_created', 'project_updated'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE TODOAAPP.attention_type AS ENUM (
      'mention', 'assignment', 'due_soon', 'overdue',
      'comment', 'status_change', 'unassignment'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE TODOAAPP.attention_priority AS ENUM ('urgent', 'high', 'normal', 'low');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLE 1: PROFILES
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  username TEXT UNIQUE,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  is_online BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  profile_completed BOOLEAN DEFAULT FALSE
);

-- =====================================================
-- TABLE 2: ORGANIZATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  image_url TEXT,
  created_by UUID REFERENCES TODOAAPP.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE 3: ORGANIZATION_MEMBERS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES TODOAAPP.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES TODOAAPP.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by UUID REFERENCES TODOAAPP.profiles(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- =====================================================
-- TABLE 4: TEAMS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES TODOAAPP.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  image_url TEXT,
  created_by UUID REFERENCES TODOAAPP.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE 5: TEAM_MEMBERS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES TODOAAPP.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES TODOAAPP.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- =====================================================
-- TABLE 6: PROJECTS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES TODOAAPP.organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES TODOAAPP.teams(id) ON DELETE SET NULL,
  color TEXT DEFAULT '#3B82F6',
  status TEXT DEFAULT 'active',
  workflow_stages JSONB,
  image_url TEXT,
  created_by UUID REFERENCES TODOAAPP.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE 7: PROJECT_MEMBERS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES TODOAAPP.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES TODOAAPP.profiles(id) ON DELETE CASCADE,
  role TODOAAPP.project_role NOT NULL DEFAULT 'reader',
  invited_by UUID REFERENCES TODOAAPP.profiles(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- =====================================================
-- TABLE 8: TASKS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TODOAAPP.task_status DEFAULT 'todo',
  priority TODOAAPP.task_priority DEFAULT 'none',
  project_id UUID NOT NULL REFERENCES TODOAAPP.projects(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES TODOAAPP.profiles(id),
  created_by UUID REFERENCES TODOAAPP.profiles(id),
  updated_by UUID REFERENCES TODOAAPP.profiles(id),
  due_date TIMESTAMP WITH TIME ZONE,
  start_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Task organization
  tags TEXT[],
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  parent_task_id UUID REFERENCES TODOAAPP.tasks(id) ON DELETE SET NULL,
  position INTEGER,
  stage_id TEXT,
  custom_fields JSONB,
  color TEXT,
  milestone_id UUID,

  -- Approval workflow
  approval_status TEXT DEFAULT 'none' CHECK (approval_status IN ('none', 'pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  moved_to_done_at TIMESTAMPTZ,
  moved_to_done_by UUID REFERENCES auth.users(id),

  -- Slack integration
  slack_thread_ts TEXT,
  slack_message_ts TEXT,
  slack_user_id TEXT,
  slack_user_name TEXT,
  created_by_slack BOOLEAN DEFAULT FALSE
);

-- =====================================================
-- TABLE 9: TASK_ASSIGNMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.task_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES TODOAAPP.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES TODOAAPP.profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES TODOAAPP.profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

-- =====================================================
-- TABLE 10: SUBTASKS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.subtasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES TODOAAPP.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  due_date TIMESTAMP WITH TIME ZONE,
  assigned_to UUID REFERENCES TODOAAPP.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE 11: COMMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES TODOAAPP.tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES TODOAAPP.projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES TODOAAPP.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE 12: ATTACHMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES TODOAAPP.tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES TODOAAPP.comments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES TODOAAPP.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT attachment_belongs_to_task_or_comment CHECK (
    (task_id IS NOT NULL AND comment_id IS NULL) OR
    (task_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- =====================================================
-- TABLE 13: TIME_ENTRIES
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES TODOAAPP.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES TODOAAPP.profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- in seconds
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE 14: ACTIVITY_LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES TODOAAPP.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES TODOAAPP.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES TODOAAPP.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE 15: NOTIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES TODOAAPP.profiles(id) ON DELETE CASCADE,
  type TODOAAPP.notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE 16: WEBHOOKS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES TODOAAPP.projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TODOAAPP.webhook_event[] NOT NULL,
  secret TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE 17: SLACK_INTEGRATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.slack_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES TODOAAPP.projects(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  channel_name TEXT,
  channel_id TEXT,
  access_token TEXT,
  notify_on_task_create BOOLEAN DEFAULT TRUE,
  notify_on_task_update BOOLEAN DEFAULT TRUE,
  notify_on_task_delete BOOLEAN DEFAULT TRUE,
  notify_on_task_move BOOLEAN DEFAULT TRUE,
  notify_on_task_complete BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES TODOAAPP.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id)
);

-- =====================================================
-- TABLE 18: MENTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES TODOAAPP.tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES TODOAAPP.comments(id) ON DELETE CASCADE,
  project_id UUID REFERENCES TODOAAPP.projects(id) ON DELETE CASCADE,
  mention_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CONSTRAINT mention_has_context CHECK (
    task_id IS NOT NULL OR comment_id IS NOT NULL
  )
);

-- =====================================================
-- TABLE 19: ATTENTION_ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS TODOAAPP.attention_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attention_type TODOAAPP.attention_type NOT NULL,
  priority TODOAAPP.attention_priority NOT NULL DEFAULT 'normal',
  task_id UUID REFERENCES TODOAAPP.tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES TODOAAPP.comments(id) ON DELETE CASCADE,
  mention_id UUID REFERENCES TODOAAPP.mentions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES TODOAAPP.projects(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  dedup_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_todoaapp_profiles_email ON TODOAAPP.profiles(email);
CREATE INDEX IF NOT EXISTS idx_todoaapp_profiles_username ON TODOAAPP.profiles(username);

-- Organizations
CREATE INDEX IF NOT EXISTS idx_todoaapp_organizations_slug ON TODOAAPP.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_todoaapp_organizations_created_by ON TODOAAPP.organizations(created_by);

-- Organization Members
CREATE INDEX IF NOT EXISTS idx_todoaapp_org_members_org_id ON TODOAAPP.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_org_members_user_id ON TODOAAPP.organization_members(user_id);

-- Teams
CREATE INDEX IF NOT EXISTS idx_todoaapp_teams_organization_id ON TODOAAPP.teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_teams_created_by ON TODOAAPP.teams(created_by);

-- Team Members
CREATE INDEX IF NOT EXISTS idx_todoaapp_team_members_team_id ON TODOAAPP.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_team_members_user_id ON TODOAAPP.team_members(user_id);

-- Projects
CREATE INDEX IF NOT EXISTS idx_todoaapp_projects_org_id ON TODOAAPP.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_projects_team_id ON TODOAAPP.projects(team_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_projects_created_by ON TODOAAPP.projects(created_by);

-- Project Members
CREATE INDEX IF NOT EXISTS idx_todoaapp_project_members_project_id ON TODOAAPP.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_project_members_user_id ON TODOAAPP.project_members(user_id);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_todoaapp_tasks_project_id ON TODOAAPP.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_tasks_assigned_to ON TODOAAPP.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todoaapp_tasks_created_by ON TODOAAPP.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_todoaapp_tasks_status ON TODOAAPP.tasks(status);
CREATE INDEX IF NOT EXISTS idx_todoaapp_tasks_priority ON TODOAAPP.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_todoaapp_tasks_due_date ON TODOAAPP.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_todoaapp_tasks_approval_status ON TODOAAPP.tasks(approval_status);
CREATE INDEX IF NOT EXISTS idx_todoaapp_tasks_project_approval ON TODOAAPP.tasks(project_id, approval_status);

-- Task Assignments
CREATE INDEX IF NOT EXISTS idx_todoaapp_task_assignments_task_id ON TODOAAPP.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_task_assignments_user_id ON TODOAAPP.task_assignments(user_id);

-- Subtasks
CREATE INDEX IF NOT EXISTS idx_todoaapp_subtasks_task_id ON TODOAAPP.subtasks(task_id);

-- Comments
CREATE INDEX IF NOT EXISTS idx_todoaapp_comments_task_id ON TODOAAPP.comments(task_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_comments_project_id ON TODOAAPP.comments(project_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_comments_created_by ON TODOAAPP.comments(created_by);

-- Attachments
CREATE INDEX IF NOT EXISTS idx_todoaapp_attachments_task_id ON TODOAAPP.attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_attachments_comment_id ON TODOAAPP.attachments(comment_id);

-- Time Entries
CREATE INDEX IF NOT EXISTS idx_todoaapp_time_entries_task_id ON TODOAAPP.time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_time_entries_user_id ON TODOAAPP.time_entries(user_id);

-- Activity Logs
CREATE INDEX IF NOT EXISTS idx_todoaapp_activity_logs_project_id ON TODOAAPP.activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_activity_logs_task_id ON TODOAAPP.activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_activity_logs_user_id ON TODOAAPP.activity_logs(user_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_todoaapp_notifications_user_id ON TODOAAPP.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_notifications_user_read ON TODOAAPP.notifications(user_id, is_read);

-- Slack Integrations
CREATE INDEX IF NOT EXISTS idx_todoaapp_slack_integrations_project_id ON TODOAAPP.slack_integrations(project_id);

-- Mentions
CREATE INDEX IF NOT EXISTS idx_todoaapp_mentions_mentioned_user ON TODOAAPP.mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_mentions_task_id ON TODOAAPP.mentions(task_id);
CREATE INDEX IF NOT EXISTS idx_todoaapp_mentions_comment_id ON TODOAAPP.mentions(comment_id);

-- Attention Items
CREATE INDEX IF NOT EXISTS idx_todoaapp_attention_user_active ON TODOAAPP.attention_items(user_id, created_at DESC)
  WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todoaapp_attention_task ON TODOAAPP.attention_items(task_id);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ TODOAAPP schema created successfully!';
  RAISE NOTICE '📊 Created 19 tables with all indexes';
  RAISE NOTICE '🔒 Next step: Run RLS policies script';
END $$;
