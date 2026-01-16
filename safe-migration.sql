-- Safe Migration Script for Todo List App
-- This script can be run multiple times safely - it checks for existing objects

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types (with safe checks)
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('none', 'low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_role AS ENUM ('owner', 'admin', 'editor', 'reader');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('task_assigned', 'task_updated', 'comment_added', 'project_invite', 'deadline_reminder');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE webhook_event AS ENUM ('task_created', 'task_updated', 'task_deleted', 'comment_added', 'project_created');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  username TEXT UNIQUE,
  bio TEXT,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organizations for multi-tenant support
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  subscription_tier TEXT DEFAULT 'free',
  max_members INTEGER DEFAULT 10,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization members
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role project_role DEFAULT 'reader',
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  status TEXT DEFAULT 'active',
  visibility TEXT DEFAULT 'team',
  workflow_stages JSONB DEFAULT '[
    {"id": "todo", "name": "To Do", "color": "#6B7280"},
    {"id": "in_progress", "name": "In Progress", "color": "#3B82F6"},
    {"id": "review", "name": "Review", "color": "#F59E0B"},
    {"id": "done", "name": "Done", "color": "#10B981"}
  ]',
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project members
CREATE TABLE IF NOT EXISTS project_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role project_role DEFAULT 'reader',
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'none',
  position INTEGER DEFAULT 0,
  stage_id TEXT NOT NULL DEFAULT 'todo',
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}'
);

-- Task assignments
CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

-- Subtasks
CREATE TABLE IF NOT EXISTS subtasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attachments
CREATE TABLE IF NOT EXISTS attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Time tracking
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL,
  description TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events webhook_event[] NOT NULL,
  secret TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance (safe)
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_user ON organization_members(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_members_project_user ON project_members(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_stage_position ON tasks(stage_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_user ON task_assignments(task_id, user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id);
CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_comment_id ON attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_user ON time_entries(task_id, user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_id ON activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Row Level Security policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Organization members can view organization" ON organizations;
CREATE POLICY "Organization members can view organization" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organization owners can update organization" ON organizations;
CREATE POLICY "Organization owners can update organization" ON organizations
  FOR UPDATE USING (
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Organization members can view members" ON organization_members;
CREATE POLICY "Organization members can view members" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Project members can view projects" ON projects;
CREATE POLICY "Project members can view projects" ON projects
  FOR SELECT USING (
    id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Project admins can update projects" ON projects;
CREATE POLICY "Project admins can update projects" ON projects
  FOR UPDATE USING (
    created_by = auth.uid() OR
    id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Project members can view project members" ON project_members;
CREATE POLICY "Project members can view project members" ON project_members
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Project members can view tasks" ON tasks;
CREATE POLICY "Project members can view tasks" ON tasks
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Project editors can update tasks" ON tasks;
CREATE POLICY "Project editors can update tasks" ON tasks
  FOR UPDATE USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Project members can view task assignments" ON task_assignments;
CREATE POLICY "Project members can view task assignments" ON task_assignments
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Project members can view comments" ON comments;
CREATE POLICY "Project members can view comments" ON comments
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Project members can create comments" ON comments;
CREATE POLICY "Project members can create comments" ON comments
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Functions and triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
DROP TRIGGER IF EXISTS update_subtasks_updated_at ON subtasks;
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
DROP TRIGGER IF EXISTS update_webhooks_updated_at ON webhooks;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subtasks_updated_at BEFORE UPDATE ON subtasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_logs (project_id, task_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.project_id, COALESCE(NEW.id, NULL), NEW.created_by, 'created', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO activity_logs (project_id, task_id, user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (NEW.project_id, COALESCE(NEW.id, NULL), NEW.updated_by, 'updated', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_logs (project_id, task_id, user_id, action, entity_type, entity_id, old_values)
    VALUES (OLD.project_id, COALESCE(OLD.id, NULL), auth.uid(), 'deleted', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing activity logging triggers
DROP TRIGGER IF EXISTS log_tasks_activity ON tasks;
DROP TRIGGER IF EXISTS log_comments_activity ON comments;

-- Add activity logging triggers
CREATE TRIGGER log_tasks_activity AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER log_comments_activity AFTER INSERT OR UPDATE OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION log_activity();

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_data)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to handle task assignment notifications
CREATE OR REPLACE FUNCTION notify_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT
    NEW.user_id,
    'task_assigned',
    'New Task Assignment',
    'You have been assigned to task: ' || (SELECT title FROM tasks WHERE id = NEW.task_id),
    jsonb_build_object('task_id', NEW.task_id, 'project_id', (SELECT project_id FROM tasks WHERE id = NEW.task_id))
  FROM (SELECT 1) AS dummy
  WHERE NEW.user_id != NEW.assigned_by;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing notification trigger
DROP TRIGGER IF EXISTS task_assignment_notification ON task_assignments;

-- Add notification triggers
CREATE TRIGGER task_assignment_notification AFTER INSERT ON task_assignments
  FOR EACH ROW EXECUTE FUNCTION notify_task_assignment();

-- =====================================================
-- SLACK INTEGRATIONS
-- =====================================================

-- Slack Integrations table for project-level webhook configuration
CREATE TABLE IF NOT EXISTS slack_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  channel_name TEXT,
  notify_on_task_create BOOLEAN DEFAULT true,
  notify_on_task_update BOOLEAN DEFAULT true,
  notify_on_task_delete BOOLEAN DEFAULT true,
  notify_on_task_move BOOLEAN DEFAULT true,
  notify_on_task_complete BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Add Slack thread tracking fields to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'slack_thread_ts'
  ) THEN
    ALTER TABLE tasks ADD COLUMN slack_thread_ts TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'slack_message_ts'
  ) THEN
    ALTER TABLE tasks ADD COLUMN slack_message_ts TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'slack_user_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN slack_user_id TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'slack_user_name'
  ) THEN
    ALTER TABLE tasks ADD COLUMN slack_user_name TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'created_by_slack'
  ) THEN
    ALTER TABLE tasks ADD COLUMN created_by_slack BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Enable RLS for slack_integrations
ALTER TABLE slack_integrations ENABLE ROW LEVEL SECURITY;

-- Drop and recreate Slack integration policies
DROP POLICY IF EXISTS "Project members can view slack integrations" ON slack_integrations;
CREATE POLICY "Project members can view slack integrations" ON slack_integrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = slack_integrations.project_id
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Project admins can manage slack integrations" ON slack_integrations;
CREATE POLICY "Project admins can manage slack integrations" ON slack_integrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = slack_integrations.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('admin', 'owner')
    )
  );

-- Index for Slack integrations
CREATE INDEX IF NOT EXISTS idx_slack_integrations_project_id ON slack_integrations(project_id);

-- =====================================================
-- TEAMS FEATURE
-- =====================================================

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  image_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Add team_id to projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for teams
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);

-- Enable RLS for teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Teams policies
DROP POLICY IF EXISTS "Users can read teams in their organization" ON teams;
CREATE POLICY "Users can read teams in their organization" ON teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = teams.organization_id
      AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org admins can create teams" ON teams;
CREATE POLICY "Org admins can create teams" ON teams
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = teams.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Team admins can update teams" ON teams;
CREATE POLICY "Team admins can update teams" ON teams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = teams.id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Team owners can delete teams" ON teams;
CREATE POLICY "Team owners can delete teams" ON teams
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = teams.id
      AND tm.user_id = auth.uid()
      AND tm.role = 'owner'
    )
  );

-- Team members policies
DROP POLICY IF EXISTS "Users can read team members" ON team_members;
CREATE POLICY "Users can read team members" ON team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM teams t
      JOIN organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = team_members.team_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Team admins can add members" ON team_members;
CREATE POLICY "Team admins can add members" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
    OR
    NOT EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
    )
  );

DROP POLICY IF EXISTS "Team admins can update members" ON team_members;
CREATE POLICY "Team admins can update members" ON team_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Team admins can remove members" ON team_members;
CREATE POLICY "Team admins can remove members" ON team_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
    OR
    team_members.user_id = auth.uid()
  );

-- Trigger for teams updated_at
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_teams_updated_at ON teams;
CREATE TRIGGER trigger_update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_teams_updated_at();

-- =====================================================
-- TASK APPROVAL WORKFLOW
-- =====================================================

-- Add approval columns to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE tasks ADD COLUMN approval_status TEXT DEFAULT 'none' CHECK (approval_status IN ('none', 'pending', 'approved', 'rejected'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE tasks ADD COLUMN approved_by UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE tasks ADD COLUMN rejection_reason TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'moved_to_done_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN moved_to_done_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'moved_to_done_by'
  ) THEN
    ALTER TABLE tasks ADD COLUMN moved_to_done_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Create indexes for approval status
CREATE INDEX IF NOT EXISTS idx_tasks_approval_status ON tasks(approval_status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_approval ON tasks(project_id, approval_status);

-- Function to check if user is project owner or admin
CREATE OR REPLACE FUNCTION is_project_owner_or_admin(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;
  RETURN v_role IN ('owner', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve task
CREATE OR REPLACE FUNCTION approve_task(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_id UUID;
  v_current_stage_id TEXT;
BEGIN
  SELECT project_id, stage_id INTO v_project_id, v_current_stage_id
  FROM tasks WHERE id = p_task_id;

  IF NOT is_project_owner_or_admin(v_project_id, p_user_id) THEN
    RAISE EXCEPTION 'Only project owners or admins can approve tasks';
  END IF;

  IF v_current_stage_id != 'done' THEN
    RAISE EXCEPTION 'Task must be in Done stage to be approved';
  END IF;

  UPDATE tasks
  SET
    approval_status = 'approved',
    approved_at = NOW(),
    approved_by = p_user_id,
    completed_at = NOW()
  WHERE id = p_task_id AND approval_status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject task
CREATE OR REPLACE FUNCTION reject_task(
  p_task_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_return_stage_id TEXT DEFAULT 'review'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT project_id INTO v_project_id
  FROM tasks WHERE id = p_task_id;

  IF NOT is_project_owner_or_admin(v_project_id, p_user_id) THEN
    RAISE EXCEPTION 'Only project owners or admins can reject tasks';
  END IF;

  UPDATE tasks
  SET
    approval_status = 'rejected',
    rejection_reason = p_reason,
    stage_id = p_return_stage_id,
    moved_to_done_at = NULL,
    moved_to_done_by = NULL
  WHERE id = p_task_id AND approval_status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for task approval on move to done
CREATE OR REPLACE FUNCTION handle_task_move_to_done()
RETURNS TRIGGER AS $$
DECLARE
  v_done_stage_id TEXT := 'done';
BEGIN
  IF NEW.stage_id = v_done_stage_id AND (OLD.stage_id IS NULL OR OLD.stage_id != v_done_stage_id) THEN
    IF NEW.approval_status IS NULL OR NEW.approval_status = 'none' OR NEW.approval_status = 'rejected' THEN
      NEW.approval_status := 'pending';
      NEW.moved_to_done_at := NOW();
      NEW.moved_to_done_by := NEW.updated_by;
      NEW.rejection_reason := NULL;
    END IF;
  END IF;

  IF OLD.stage_id = v_done_stage_id AND NEW.stage_id != v_done_stage_id THEN
    IF NEW.approval_status = 'pending' THEN
      NEW.approval_status := 'none';
      NEW.moved_to_done_at := NULL;
      NEW.moved_to_done_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_done_approval_trigger ON tasks;
CREATE TRIGGER task_done_approval_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_move_to_done();

CREATE OR REPLACE FUNCTION handle_task_insert_done()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage_id = 'done' THEN
    NEW.approval_status := 'pending';
    NEW.moved_to_done_at := NOW();
    NEW.moved_to_done_by := NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_insert_done_trigger ON tasks;
CREATE TRIGGER task_insert_done_trigger
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_insert_done();

-- =====================================================
-- ATTENTION INBOX & MENTIONS SYSTEM
-- =====================================================

-- Create attention types
DO $$ BEGIN
    CREATE TYPE attention_type AS ENUM (
      'mention', 'assignment', 'due_soon', 'overdue',
      'comment', 'status_change', 'unassignment'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attention_priority AS ENUM ('urgent', 'high', 'normal', 'low');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Mentions table
CREATE TABLE IF NOT EXISTS mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  mention_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CONSTRAINT mention_has_context CHECK (
    task_id IS NOT NULL OR comment_id IS NOT NULL
  )
);

-- Mentions indexes
CREATE INDEX IF NOT EXISTS idx_mentions_mentioned_user ON mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_mentioner ON mentions(mentioner_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_task ON mentions(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentions_comment ON mentions(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentions_unread ON mentions(mentioned_user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mentions_created ON mentions(created_at DESC);

-- Attention items table
CREATE TABLE IF NOT EXISTS attention_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attention_type attention_type NOT NULL,
  priority attention_priority NOT NULL DEFAULT 'normal',
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  mention_id UUID REFERENCES mentions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
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

-- Attention items indexes
CREATE INDEX IF NOT EXISTS idx_attention_user_active ON attention_items(user_id, created_at DESC)
  WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attention_user_unread ON attention_items(user_id, read_at)
  WHERE read_at IS NULL AND dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attention_priority ON attention_items(user_id, priority, created_at DESC)
  WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attention_type ON attention_items(user_id, attention_type)
  WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attention_task ON attention_items(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attention_dedup ON attention_items(user_id, dedup_key) WHERE dismissed_at IS NULL;

-- Enable RLS for mentions and attention
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attention_items ENABLE ROW LEVEL SECURITY;

-- Mentions policies
DROP POLICY IF EXISTS mentions_select ON mentions;
CREATE POLICY mentions_select ON mentions
  FOR SELECT USING (
    mentioned_user_id = auth.uid() OR mentioner_user_id = auth.uid()
  );

DROP POLICY IF EXISTS mentions_insert ON mentions;
CREATE POLICY mentions_insert ON mentions
  FOR INSERT WITH CHECK (mentioner_user_id = auth.uid());

DROP POLICY IF EXISTS mentions_update ON mentions;
CREATE POLICY mentions_update ON mentions
  FOR UPDATE USING (mentioned_user_id = auth.uid());

-- Attention items policies
DROP POLICY IF EXISTS attention_select ON attention_items;
CREATE POLICY attention_select ON attention_items
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS attention_insert ON attention_items;
CREATE POLICY attention_insert ON attention_items
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS attention_update ON attention_items;
CREATE POLICY attention_update ON attention_items
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS attention_delete ON attention_items;
CREATE POLICY attention_delete ON attention_items
  FOR DELETE USING (user_id = auth.uid());
