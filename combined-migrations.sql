-- Task Management System Schema
-- This migration creates the complete database structure for a multi-tenant task management app

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE task_priority AS ENUM ('none', 'low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done', 'archived');
CREATE TYPE project_role AS ENUM ('owner', 'admin', 'editor', 'reader');
CREATE TYPE notification_type AS ENUM ('task_assigned', 'task_updated', 'comment_added', 'project_invite', 'deadline_reminder');
CREATE TYPE webhook_event AS ENUM ('task_created', 'task_updated', 'task_deleted', 'comment_added', 'project_created');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
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
CREATE TABLE organizations (
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
CREATE TABLE organization_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role project_role DEFAULT 'reader',
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Projects table
CREATE TABLE projects (
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
CREATE TABLE project_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role project_role DEFAULT 'reader',
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Tasks table
CREATE TABLE tasks (
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
CREATE TABLE task_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

-- Subtasks
CREATE TABLE subtasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments
CREATE TABLE comments (
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
CREATE TABLE attachments (
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
CREATE TABLE time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL, -- in minutes
  description TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity log
CREATE TABLE activity_logs (
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
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhooks
CREATE TABLE webhooks (
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

-- Create indexes for performance
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organization_members_org_user ON organization_members(organization_id, user_id);
CREATE INDEX idx_projects_org_id ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_project_members_project_user ON project_members(project_id, user_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_stage_position ON tasks(stage_id, position);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_task_assignments_task_user ON task_assignments(task_id, user_id);
CREATE INDEX idx_task_assignments_user ON task_assignments(user_id);
CREATE INDEX idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX idx_comments_task_id ON comments(task_id);
CREATE INDEX idx_comments_project_id ON comments(project_id);
CREATE INDEX idx_attachments_task_id ON attachments(task_id);
CREATE INDEX idx_attachments_comment_id ON attachments(comment_id);
CREATE INDEX idx_time_entries_task_user ON time_entries(task_id, user_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX idx_activity_logs_task_id ON activity_logs(task_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

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

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Organizations policies
CREATE POLICY "Organization members can view organization" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization owners can update organization" ON organizations
  FOR UPDATE USING (
    created_by = auth.uid()
  );

-- Organization members policies
CREATE POLICY "Organization members can view members" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Projects policies
CREATE POLICY "Project members can view projects" ON projects
  FOR SELECT USING (
    id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project admins can update projects" ON projects
  FOR UPDATE USING (
    created_by = auth.uid() OR
    id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Project members policies
CREATE POLICY "Project members can view project members" ON project_members
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- Tasks policies
CREATE POLICY "Project members can view tasks" ON tasks
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project editors can update tasks" ON tasks
  FOR UPDATE USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
    )
  );

-- Task assignments policies
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

-- Comments policies
CREATE POLICY "Project members can view comments" ON comments
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create comments" ON comments
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

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

-- Add notification triggers
CREATE TRIGGER task_assignment_notification AFTER INSERT ON task_assignments
  FOR EACH ROW EXECUTE FUNCTION notify_task_assignment();-- Migration: Add complete RLS policies for all tables
-- This migration adds INSERT and DELETE policies that were missing from the original schema
-- Uses DROP POLICY IF EXISTS to avoid conflicts with existing policies

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================

-- Allow users to insert their own profile (needed for new user signup)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to view other profiles (needed for showing team members)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
CREATE POLICY "Users can view profiles" ON profiles
  FOR SELECT USING (true);  -- All authenticated users can view profiles

-- ============================================
-- ORGANIZATIONS TABLE POLICIES
-- ============================================

-- Allow authenticated users to create organizations
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow organization owners/admins to delete organizations
DROP POLICY IF EXISTS "Organization owners can delete organization" ON organizations;
CREATE POLICY "Organization owners can delete organization" ON organizations
  FOR DELETE USING (
    created_by = auth.uid() OR
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Update the SELECT policy to also allow viewing orgs you created (before membership is added)
DROP POLICY IF EXISTS "Organization members can view organization" ON organizations;
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    created_by = auth.uid() OR
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- ORGANIZATION_MEMBERS TABLE POLICIES
-- ============================================

-- Allow organization owners/admins to add members
DROP POLICY IF EXISTS "Organization admins can add members" ON organization_members;
CREATE POLICY "Organization admins can add members" ON organization_members
  FOR INSERT WITH CHECK (
    -- Allow if user is creating their own membership (self-joining as owner)
    (user_id = auth.uid() AND role = 'owner') OR
    -- Allow if user is an admin/owner of the organization
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow organization owners/admins to update member roles
DROP POLICY IF EXISTS "Organization admins can update members" ON organization_members;
CREATE POLICY "Organization admins can update members" ON organization_members
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow organization owners/admins to remove members
DROP POLICY IF EXISTS "Organization admins can remove members" ON organization_members;
CREATE POLICY "Organization admins can remove members" ON organization_members
  FOR DELETE USING (
    -- Users can remove themselves
    user_id = auth.uid() OR
    -- Admins/owners can remove others
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ============================================
-- PROJECTS TABLE POLICIES
-- ============================================

-- Allow organization members to create projects
DROP POLICY IF EXISTS "Organization members can create projects" ON projects;
CREATE POLICY "Organization members can create projects" ON projects
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Allow project owners/admins to delete projects
DROP POLICY IF EXISTS "Project admins can delete projects" ON projects;
CREATE POLICY "Project admins can delete projects" ON projects
  FOR DELETE USING (
    created_by = auth.uid() OR
    id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Update SELECT policy to include projects user created (before membership is added)
DROP POLICY IF EXISTS "Project members can view projects" ON projects;
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
CREATE POLICY "Users can view their projects" ON projects
  FOR SELECT USING (
    created_by = auth.uid() OR
    id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- PROJECT_MEMBERS TABLE POLICIES
-- ============================================

-- Allow project owners/admins to add members
DROP POLICY IF EXISTS "Project admins can add members" ON project_members;
CREATE POLICY "Project admins can add members" ON project_members
  FOR INSERT WITH CHECK (
    -- Allow if user is creating their own membership (self-joining as owner)
    (user_id = auth.uid() AND role = 'owner') OR
    -- Allow if user is an admin/owner of the project
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow project owners/admins to update member roles
DROP POLICY IF EXISTS "Project admins can update members" ON project_members;
CREATE POLICY "Project admins can update members" ON project_members
  FOR UPDATE USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow project owners/admins to remove members (or users can remove themselves)
DROP POLICY IF EXISTS "Project admins can remove members" ON project_members;
CREATE POLICY "Project admins can remove members" ON project_members
  FOR DELETE USING (
    -- Users can remove themselves
    user_id = auth.uid() OR
    -- Admins/owners can remove others
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================

-- Allow project members with edit permissions to create tasks
DROP POLICY IF EXISTS "Project editors can create tasks" ON tasks;
CREATE POLICY "Project editors can create tasks" ON tasks
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
    )
  );

-- Allow task creators and project admins to delete tasks
DROP POLICY IF EXISTS "Project editors can delete tasks" ON tasks;
CREATE POLICY "Project editors can delete tasks" ON tasks
  FOR DELETE USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
    )
  );

-- ============================================
-- TASK_ASSIGNMENTS TABLE POLICIES
-- ============================================

-- Allow project editors to create task assignments
DROP POLICY IF EXISTS "Project editors can create task assignments" ON task_assignments;
CREATE POLICY "Project editors can create task assignments" ON task_assignments
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- Allow project editors to update task assignments
DROP POLICY IF EXISTS "Project editors can update task assignments" ON task_assignments;
CREATE POLICY "Project editors can update task assignments" ON task_assignments
  FOR UPDATE USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- Allow project editors to delete task assignments
DROP POLICY IF EXISTS "Project editors can delete task assignments" ON task_assignments;
CREATE POLICY "Project editors can delete task assignments" ON task_assignments
  FOR DELETE USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- ============================================
-- SUBTASKS TABLE POLICIES
-- ============================================

-- Allow project members to view subtasks
DROP POLICY IF EXISTS "Project members can view subtasks" ON subtasks;
CREATE POLICY "Project members can view subtasks" ON subtasks
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Allow project editors to create subtasks
DROP POLICY IF EXISTS "Project editors can create subtasks" ON subtasks;
CREATE POLICY "Project editors can create subtasks" ON subtasks
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- Allow project editors to update subtasks
DROP POLICY IF EXISTS "Project editors can update subtasks" ON subtasks;
CREATE POLICY "Project editors can update subtasks" ON subtasks
  FOR UPDATE USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- Allow project editors to delete subtasks
DROP POLICY IF EXISTS "Project editors can delete subtasks" ON subtasks;
CREATE POLICY "Project editors can delete subtasks" ON subtasks
  FOR DELETE USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- ============================================
-- COMMENTS TABLE POLICIES
-- ============================================

-- Allow users to update their own comments
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (created_by = auth.uid());

-- Allow users to delete their own comments (or project admins)
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ============================================
-- ATTACHMENTS TABLE POLICIES
-- ============================================

-- Allow project members to view attachments
DROP POLICY IF EXISTS "Project members can view attachments" ON attachments;
CREATE POLICY "Project members can view attachments" ON attachments
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Allow project editors to create attachments
DROP POLICY IF EXISTS "Project editors can create attachments" ON attachments;
CREATE POLICY "Project editors can create attachments" ON attachments
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- Allow attachment uploaders and project admins to delete attachments
DROP POLICY IF EXISTS "Users can delete own attachments" ON attachments;
CREATE POLICY "Users can delete own attachments" ON attachments
  FOR DELETE USING (
    uploaded_by = auth.uid() OR
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
      )
    )
  );

-- ============================================
-- TIME_ENTRIES TABLE POLICIES
-- ============================================

-- Allow project members to view time entries
DROP POLICY IF EXISTS "Project members can view time entries" ON time_entries;
CREATE POLICY "Project members can view time entries" ON time_entries
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Allow users to create their own time entries
DROP POLICY IF EXISTS "Users can create own time entries" ON time_entries;
CREATE POLICY "Users can create own time entries" ON time_entries
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Allow users to update their own time entries
DROP POLICY IF EXISTS "Users can update own time entries" ON time_entries;
CREATE POLICY "Users can update own time entries" ON time_entries
  FOR UPDATE USING (user_id = auth.uid());

-- Allow users to delete their own time entries
DROP POLICY IF EXISTS "Users can delete own time entries" ON time_entries;
CREATE POLICY "Users can delete own time entries" ON time_entries
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- ACTIVITY_LOGS TABLE POLICIES
-- ============================================

-- Allow project members to view activity logs
DROP POLICY IF EXISTS "Project members can view activity logs" ON activity_logs;
CREATE POLICY "Project members can view activity logs" ON activity_logs
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- Activity logs are created by triggers, so we need a policy for system inserts
DROP POLICY IF EXISTS "System can create activity logs" ON activity_logs;
CREATE POLICY "System can create activity logs" ON activity_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================

-- Allow users to create notifications for others (for the notification system)
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Allow users to delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- WEBHOOKS TABLE POLICIES
-- ============================================

-- Enable RLS on webhooks if not already enabled
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Allow project admins to view webhooks
DROP POLICY IF EXISTS "Project admins can view webhooks" ON webhooks;
CREATE POLICY "Project admins can view webhooks" ON webhooks
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow project admins to create webhooks
DROP POLICY IF EXISTS "Project admins can create webhooks" ON webhooks;
CREATE POLICY "Project admins can create webhooks" ON webhooks
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow project admins to update webhooks
DROP POLICY IF EXISTS "Project admins can update webhooks" ON webhooks;
CREATE POLICY "Project admins can update webhooks" ON webhooks
  FOR UPDATE USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow project admins to delete webhooks
DROP POLICY IF EXISTS "Project admins can delete webhooks" ON webhooks;
CREATE POLICY "Project admins can delete webhooks" ON webhooks
  FOR DELETE USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ============================================
-- FUNCTION: Auto-create profile on user signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant permissions on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
-- Migration: Grant permissions for todoAAPP schema
-- Run this in your Supabase SQL Editor to grant necessary permissions

-- Grant schema usage to all roles
GRANT USAGE ON SCHEMA "todoAAPP" TO postgres;
GRANT USAGE ON SCHEMA "todoAAPP" TO authenticated;
GRANT USAGE ON SCHEMA "todoAAPP" TO anon;
GRANT USAGE ON SCHEMA "todoAAPP" TO service_role;

-- Grant all privileges on all existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "todoAAPP" TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "todoAAPP" TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "todoAAPP" TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA "todoAAPP" TO anon;

-- Grant privileges on all sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "todoAAPP" TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "todoAAPP" TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "todoAAPP" TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "todoAAPP" TO anon;

-- Set default privileges for future tables created in this schema
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT SELECT ON TABLES TO anon;

-- Set default privileges for future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT USAGE, SELECT ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT USAGE, SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT USAGE, SELECT ON SEQUENCES TO anon;

-- Ensure RLS is enabled on all tables (for production security)
ALTER TABLE "todoAAPP".profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".notifications ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for service_role (bypasses RLS by default, but good to have)
-- The service_role key has superuser-like access, so these are mainly for documentation

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view all profiles" ON "todoAAPP".profiles;
CREATE POLICY "Users can view all profiles" ON "todoAAPP".profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON "todoAAPP".profiles;
CREATE POLICY "Users can insert own profile" ON "todoAAPP".profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON "todoAAPP".profiles;
CREATE POLICY "Users can update own profile" ON "todoAAPP".profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- ORGANIZATIONS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON "todoAAPP".organizations;
CREATE POLICY "Authenticated users can create organizations" ON "todoAAPP".organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view their organizations" ON "todoAAPP".organizations;
CREATE POLICY "Users can view their organizations" ON "todoAAPP".organizations
  FOR SELECT USING (
    created_by = auth.uid() OR
    id IN (SELECT organization_id FROM "todoAAPP".organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org owners can update organization" ON "todoAAPP".organizations;
CREATE POLICY "Org owners can update organization" ON "todoAAPP".organizations
  FOR UPDATE USING (
    created_by = auth.uid() OR
    id IN (SELECT organization_id FROM "todoAAPP".organization_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ============================================
-- ORGANIZATION_MEMBERS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view org members" ON "todoAAPP".organization_members;
CREATE POLICY "Users can view org members" ON "todoAAPP".organization_members
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM "todoAAPP".organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can join org or be added by admin" ON "todoAAPP".organization_members;
CREATE POLICY "Users can join org or be added by admin" ON "todoAAPP".organization_members
  FOR INSERT WITH CHECK (
    (user_id = auth.uid()) OR
    organization_id IN (SELECT organization_id FROM "todoAAPP".organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- ============================================
-- PROJECTS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Org members can create projects" ON "todoAAPP".projects;
CREATE POLICY "Org members can create projects" ON "todoAAPP".projects
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM "todoAAPP".organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view their projects" ON "todoAAPP".projects;
CREATE POLICY "Users can view their projects" ON "todoAAPP".projects
  FOR SELECT USING (
    created_by = auth.uid() OR
    id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Project owners can update projects" ON "todoAAPP".projects;
CREATE POLICY "Project owners can update projects" ON "todoAAPP".projects
  FOR UPDATE USING (
    created_by = auth.uid() OR
    id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

DROP POLICY IF EXISTS "Project owners can delete projects" ON "todoAAPP".projects;
CREATE POLICY "Project owners can delete projects" ON "todoAAPP".projects
  FOR DELETE USING (
    created_by = auth.uid() OR
    id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ============================================
-- PROJECT_MEMBERS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view project members" ON "todoAAPP".project_members;
CREATE POLICY "Users can view project members" ON "todoAAPP".project_members
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can join project or be added by admin" ON "todoAAPP".project_members;
CREATE POLICY "Users can join project or be added by admin" ON "todoAAPP".project_members
  FOR INSERT WITH CHECK (
    (user_id = auth.uid()) OR
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Project members can view tasks" ON "todoAAPP".tasks;
CREATE POLICY "Project members can view tasks" ON "todoAAPP".tasks
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Project members can create tasks" ON "todoAAPP".tasks;
CREATE POLICY "Project members can create tasks" ON "todoAAPP".tasks
  FOR INSERT WITH CHECK (
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role IN ('member', 'admin', 'owner'))
  );

DROP POLICY IF EXISTS "Project members can update tasks" ON "todoAAPP".tasks;
CREATE POLICY "Project members can update tasks" ON "todoAAPP".tasks
  FOR UPDATE USING (
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role IN ('member', 'admin', 'owner'))
  );

DROP POLICY IF EXISTS "Project members can delete tasks" ON "todoAAPP".tasks;
CREATE POLICY "Project members can delete tasks" ON "todoAAPP".tasks
  FOR DELETE USING (
    created_by = auth.uid() OR
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role IN ('member', 'admin', 'owner'))
  );

-- ============================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own notifications" ON "todoAAPP".notifications;
CREATE POLICY "Users can view own notifications" ON "todoAAPP".notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can create notifications" ON "todoAAPP".notifications;
CREATE POLICY "System can create notifications" ON "todoAAPP".notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON "todoAAPP".notifications;
CREATE POLICY "Users can update own notifications" ON "todoAAPP".notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON "todoAAPP".notifications;
CREATE POLICY "Users can delete own notifications" ON "todoAAPP".notifications
  FOR DELETE USING (user_id = auth.uid());
-- Migration: Fix triggers that reference wrong schema
-- Run this in your Supabase SQL Editor

-- Step 1: Find all triggers on the todoAAPP schema
SELECT
    trigger_name,
    event_object_schema,
    event_object_table,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'todoAAPP';

-- Step 2: Find all functions that might reference public schema
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'todoAAPP'
AND pg_get_functiondef(p.oid) LIKE '%public.%';

-- Step 3: Check for any trigger functions
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'todoAAPP'
AND p.prorettype = 'trigger'::regtype;

-- Step 4: List all triggers with their full definitions
SELECT
    tgname AS trigger_name,
    relname AS table_name,
    nspname AS schema_name,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE nspname = 'todoAAPP'
AND NOT tgisinternal;

-- ============================================
-- COMMON FIX: If there's an auto-add project member trigger
-- ============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_project_created ON "todoAAPP".projects;
DROP FUNCTION IF EXISTS "todoAAPP".handle_new_project();

-- Create corrected function that uses the right schema
CREATE OR REPLACE FUNCTION "todoAAPP".handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-add creator as project owner
    INSERT INTO "todoAAPP".project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (project_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: We're NOT creating the trigger because the API route
-- already handles adding project members. Having both would cause duplicates.
-- If you want auto-add via trigger, uncomment below:
--
-- CREATE TRIGGER on_project_created
--     AFTER INSERT ON "todoAAPP".projects
--     FOR EACH ROW
--     EXECUTE FUNCTION "todoAAPP".handle_new_project();

-- ============================================
-- ALTERNATIVE: Completely disable any existing triggers
-- ============================================

-- If triggers are causing issues, you can disable them temporarily:
-- ALTER TABLE "todoAAPP".projects DISABLE TRIGGER ALL;
-- ALTER TABLE "todoAAPP".project_members DISABLE TRIGGER ALL;

-- To re-enable:
-- ALTER TABLE "todoAAPP".projects ENABLE TRIGGER ALL;
-- ALTER TABLE "todoAAPP".project_members ENABLE TRIGGER ALL;

-- ============================================
-- VERIFY: Check the search_path is set correctly
-- ============================================

-- Show current search_path
SHOW search_path;

-- Set search_path to prioritize todoAAPP
ALTER DATABASE postgres SET search_path TO "todoAAPP", public;

-- For the authenticated role specifically
ALTER ROLE authenticated SET search_path TO "todoAAPP", public;
ALTER ROLE service_role SET search_path TO "todoAAPP", public;
ALTER ROLE anon SET search_path TO "todoAAPP", public;
-- CRITICAL FIX: Remove/Fix trigger that references public.project_members
-- Run this in your Supabase SQL Editor

-- Step 1: Drop any existing USER triggers (not system triggers)
DROP TRIGGER IF EXISTS on_project_created ON "todoAAPP".projects;
DROP TRIGGER IF EXISTS trigger_auto_add_project_member ON "todoAAPP".projects;
DROP TRIGGER IF EXISTS auto_add_project_member ON "todoAAPP".projects;
DROP TRIGGER IF EXISTS handle_new_project ON "todoAAPP".projects;

-- Step 2: Drop associated functions
DROP FUNCTION IF EXISTS "todoAAPP".handle_new_project() CASCADE;
DROP FUNCTION IF EXISTS "todoAAPP".auto_add_project_member() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_project() CASCADE;
DROP FUNCTION IF EXISTS public.auto_add_project_member() CASCADE;

-- Step 3: List remaining triggers to verify (should only show system/constraint triggers)
SELECT
    tgname AS trigger_name,
    CASE WHEN tgisinternal THEN 'SYSTEM' ELSE 'USER' END AS trigger_type
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'todoAAPP'
AND c.relname = 'projects';
-- Organization Announcements table
CREATE TABLE IF NOT EXISTS organization_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Meetings table
CREATE TABLE IF NOT EXISTS organization_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  meeting_link TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'organization_invite', 'project_invite', 'announcement', 'meeting', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}', -- Store additional data like organization_id, project_id, etc.
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_announcements_org ON organization_announcements(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_announcements_created ON organization_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_meetings_org ON organization_meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_meetings_scheduled ON organization_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Enable RLS
ALTER TABLE organization_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check organization membership (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = uid
  );
$$;

-- Helper function to check if user is org admin/owner
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = uid
    AND role IN ('owner', 'admin')
  );
$$;

-- RLS Policies for organization_announcements
CREATE POLICY "Organization members can view announcements"
  ON organization_announcements FOR SELECT
  USING (is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org admins can create announcements"
  ON organization_announcements FOR INSERT
  WITH CHECK (is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins can update announcements"
  ON organization_announcements FOR UPDATE
  USING (is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins can delete announcements"
  ON organization_announcements FOR DELETE
  USING (is_org_admin(organization_id, auth.uid()));

-- RLS Policies for organization_meetings
CREATE POLICY "Organization members can view meetings"
  ON organization_meetings FOR SELECT
  USING (is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org admins can create meetings"
  ON organization_meetings FOR INSERT
  WITH CHECK (is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins can update meetings"
  ON organization_meetings FOR UPDATE
  USING (is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins can delete meetings"
  ON organization_meetings FOR DELETE
  USING (is_org_admin(organization_id, auth.uid()));

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true); -- Allow inserts from service role

-- Function to create notification when member is added to organization
CREATE OR REPLACE FUNCTION notify_org_member_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_name TEXT;
  inviter_name TEXT;
BEGIN
  -- Get organization name
  SELECT name INTO org_name FROM organizations WHERE id = NEW.organization_id;

  -- Get inviter name (the user who added them)
  SELECT COALESCE(full_name, email) INTO inviter_name
  FROM profiles
  WHERE id = auth.uid();

  -- Don't notify if user added themselves (owner creating org)
  IF NEW.user_id != auth.uid() THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'organization_invite',
      'You''ve been added to an organization',
      COALESCE(inviter_name, 'Someone') || ' added you to ' || COALESCE(org_name, 'an organization') || ' as ' || NEW.role,
      jsonb_build_object(
        'organization_id', NEW.organization_id,
        'organization_name', org_name,
        'role', NEW.role
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for organization member notifications
DROP TRIGGER IF EXISTS on_org_member_added ON organization_members;
CREATE TRIGGER on_org_member_added
  AFTER INSERT ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_org_member_added();

-- Grant necessary permissions
GRANT SELECT ON organization_announcements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON organization_announcements TO authenticated;
GRANT SELECT ON organization_meetings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON organization_meetings TO authenticated;
GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT INSERT ON notifications TO service_role;
-- Organization Announcements table
CREATE TABLE IF NOT EXISTS organization_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Meetings table
CREATE TABLE IF NOT EXISTS organization_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  meeting_link TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_announcements_org ON organization_announcements(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_announcements_created ON organization_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_meetings_org ON organization_meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_meetings_scheduled ON organization_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Grant permissions
GRANT ALL ON organization_announcements TO authenticated;
GRANT ALL ON organization_meetings TO authenticated;
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON organization_announcements TO service_role;
GRANT ALL ON organization_meetings TO service_role;
GRANT ALL ON notifications TO service_role;
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
-- Fix notifications table to support all notification types
-- This migration adds new notification types and ensures proper RLS policies

-- First, let's alter the type column to use TEXT instead of the enum
-- This is more flexible and allows for any notification type
ALTER TABLE notifications
  ALTER COLUMN type TYPE TEXT USING type::TEXT;

-- Drop the old enum type if it exists (it might be in use elsewhere)
-- We'll keep using TEXT for flexibility
DO $$
BEGIN
  -- Drop the old enum if no other tables use it
  DROP TYPE IF EXISTS notification_type;
EXCEPTION
  WHEN dependent_objects_still_exist THEN
    -- Enum is still in use elsewhere, that's fine
    NULL;
END $$;

-- Ensure RLS is enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop and recreate all notification policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read, etc.)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- Anyone can create notifications (system/API creates notifications for users)
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Ensure the column name is consistent (use is_read)
-- First check if 'read' column exists and rename it to 'is_read'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'read'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN "read" TO is_read;
  END IF;
END $$;

-- Add is_read column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
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
-- Migration: Database fixes for auth flow, comments, and performance
-- Required for: OAuth signup flow, QuickCommentPanel joins, subtask ordering
-- Safe to run: Yes (additive changes only)

-- ============================================
-- PART 1: Add profile_completed column
-- ============================================

-- Add column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'profile_completed'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN profile_completed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Backfill existing profiles as completed (they existed before this feature)
UPDATE profiles
SET profile_completed = true
WHERE profile_completed IS NULL;

-- Add partial index for efficiently finding incomplete profiles (onboarding reminders)
CREATE INDEX IF NOT EXISTS idx_profiles_incomplete
ON profiles(id)
WHERE profile_completed = false;

-- ============================================
-- PART 2: Comments FK constraint
-- NOTE: comments_created_by_fkey already exists (verified)
-- ============================================

-- No action needed - constraint exists with correct name

-- ============================================
-- PART 3: Performance indexes
-- ============================================

-- Index for faster author-based task queries
CREATE INDEX IF NOT EXISTS idx_tasks_created_by
ON tasks(created_by);

-- Index for faster comment lookups by task
CREATE INDEX IF NOT EXISTS idx_comments_created_by
ON comments(created_by);

-- Index for subtask ordering (position-based queries)
CREATE INDEX IF NOT EXISTS idx_subtasks_task_position
ON subtasks(task_id, position);

-- ============================================
-- PART 4: Ensure subtasks have proper ordering support
-- ============================================

-- Add position column if it doesn't exist (should exist from schema, but ensure)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'subtasks'
    AND column_name = 'position'
  ) THEN
    ALTER TABLE public.subtasks ADD COLUMN position INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- ROLLBACK INSTRUCTIONS
-- ============================================
--
-- To rollback:
--   ALTER TABLE profiles DROP COLUMN IF EXISTS profile_completed;
--   DROP INDEX IF EXISTS idx_profiles_incomplete;
--   DROP INDEX IF EXISTS idx_tasks_created_by;
--   DROP INDEX IF EXISTS idx_comments_created_by;
--   DROP INDEX IF EXISTS idx_subtasks_task_position;
-- =====================================================
-- ATTENTION INBOX & @MENTIONS SYSTEM
-- Migration 015
-- =====================================================

-- -----------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------

-- Type of attention item
CREATE TYPE attention_type AS ENUM (
  'mention',           -- Someone @mentioned you
  'assignment',        -- Task assigned to you
  'due_soon',          -- Task due within 24 hours
  'overdue',           -- Task is past due date
  'comment',           -- New comment on your task
  'status_change',     -- Task status changed
  'unassignment'       -- Task unassigned from you
);

-- Priority for inbox sorting
CREATE TYPE attention_priority AS ENUM (
  'urgent',    -- Overdue, explicit mentions
  'high',      -- Due soon, new assignments
  'normal',    -- Comments, status changes
  'low'        -- FYI items
);

-- -----------------------------------------------------
-- 2. MENTIONS TABLE
-- -----------------------------------------------------

CREATE TABLE mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who was mentioned
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Who made the mention
  mentioner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Context of the mention
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- The actual mention text for context
  mention_context TEXT, -- e.g., "Hey @john can you review this?"

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT mention_has_context CHECK (
    task_id IS NOT NULL OR comment_id IS NOT NULL
  )
);

-- Indexes for mentions
CREATE INDEX idx_mentions_mentioned_user ON mentions(mentioned_user_id);
CREATE INDEX idx_mentions_mentioner ON mentions(mentioner_user_id);
CREATE INDEX idx_mentions_task ON mentions(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_mentions_comment ON mentions(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX idx_mentions_unread ON mentions(mentioned_user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_mentions_created ON mentions(created_at DESC);

-- -----------------------------------------------------
-- 3. ATTENTION ITEMS TABLE (Unified Inbox)
-- -----------------------------------------------------

CREATE TABLE attention_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who this attention item is for
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Classification
  attention_type attention_type NOT NULL,
  priority attention_priority NOT NULL DEFAULT 'normal',

  -- Source references (nullable based on type)
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  mention_id UUID REFERENCES mentions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Actor who caused this (nullable for system-generated items like due_soon)
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Display content
  title TEXT NOT NULL,
  body TEXT,

  -- State
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ, -- When user took action (clicked, responded, etc.)

  -- Deduplication key to prevent spam
  dedup_key TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Only one active item per dedup_key per user
  CONSTRAINT unique_active_attention UNIQUE NULLS NOT DISTINCT (user_id, dedup_key, dismissed_at)
);

-- Indexes for attention_items
CREATE INDEX idx_attention_user_active ON attention_items(user_id, created_at DESC)
  WHERE dismissed_at IS NULL;
CREATE INDEX idx_attention_user_unread ON attention_items(user_id, read_at)
  WHERE read_at IS NULL AND dismissed_at IS NULL;
CREATE INDEX idx_attention_priority ON attention_items(user_id, priority, created_at DESC)
  WHERE dismissed_at IS NULL;
CREATE INDEX idx_attention_type ON attention_items(user_id, attention_type)
  WHERE dismissed_at IS NULL;
CREATE INDEX idx_attention_task ON attention_items(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_attention_dedup ON attention_items(user_id, dedup_key) WHERE dismissed_at IS NULL;

-- -----------------------------------------------------
-- 4. HELPER FUNCTIONS
-- -----------------------------------------------------

-- Function to create attention item with deduplication
CREATE OR REPLACE FUNCTION create_attention_item(
  p_user_id UUID,
  p_attention_type attention_type,
  p_priority attention_priority,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_task_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_mention_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_dedup_key TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Don't create attention items for the actor themselves
  IF p_user_id = p_actor_user_id THEN
    RETURN NULL;
  END IF;

  -- Insert with conflict handling for dedup
  INSERT INTO attention_items (
    user_id, attention_type, priority, title, body,
    task_id, comment_id, mention_id, project_id,
    actor_user_id, dedup_key
  ) VALUES (
    p_user_id, p_attention_type, p_priority, p_title, p_body,
    p_task_id, p_comment_id, p_mention_id, p_project_id,
    p_actor_user_id, p_dedup_key
  )
  ON CONFLICT (user_id, dedup_key, dismissed_at)
  WHERE dismissed_at IS NULL
  DO UPDATE SET
    updated_at = NOW(),
    title = EXCLUDED.title,
    body = EXCLUDED.body
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to extract mentions from text
CREATE OR REPLACE FUNCTION extract_mentions(p_text TEXT)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT DISTINCT lower(matches[1])
    FROM regexp_matches(p_text, '@([a-zA-Z0-9_.-]+)', 'g') AS matches
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -----------------------------------------------------
-- 5. TRIGGERS FOR AUTOMATIC ATTENTION ITEMS
-- -----------------------------------------------------

-- Trigger: Task assignment creates attention item
CREATE OR REPLACE FUNCTION trigger_task_assignment_attention()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title TEXT;
  v_project_id UUID;
  v_actor_name TEXT;
BEGIN
  -- Only fire on assignment changes
  IF TG_OP = 'UPDATE' AND
     (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) AND
     NEW.assigned_to IS NOT NULL THEN

    SELECT title, project_id INTO v_task_title, v_project_id
    FROM tasks WHERE id = NEW.id;

    SELECT COALESCE(full_name, email) INTO v_actor_name
    FROM profiles WHERE id = auth.uid();

    PERFORM create_attention_item(
      NEW.assigned_to,
      'assignment',
      'high',
      'Task assigned: ' || v_task_title,
      COALESCE(v_actor_name, 'Someone') || ' assigned you to this task',
      NEW.id,
      NULL,
      NULL,
      v_project_id,
      auth.uid(),
      'assignment:' || NEW.id
    );
  END IF;

  -- Handle unassignment
  IF TG_OP = 'UPDATE' AND
     OLD.assigned_to IS NOT NULL AND
     NEW.assigned_to IS NULL THEN

    SELECT title, project_id INTO v_task_title, v_project_id
    FROM tasks WHERE id = NEW.id;

    PERFORM create_attention_item(
      OLD.assigned_to,
      'unassignment',
      'normal',
      'Task unassigned: ' || v_task_title,
      'You were unassigned from this task',
      NEW.id,
      NULL,
      NULL,
      v_project_id,
      auth.uid(),
      'unassignment:' || NEW.id || ':' || NOW()::DATE
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_assignment_attention_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_task_assignment_attention();

-- Trigger: Task status change creates attention item for assignee
CREATE OR REPLACE FUNCTION trigger_task_status_attention()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title TEXT;
  v_project_id UUID;
  v_actor_name TEXT;
BEGIN
  -- Only fire on status changes, notify the assignee (if different from actor)
  IF TG_OP = 'UPDATE' AND
     OLD.status IS DISTINCT FROM NEW.status AND
     NEW.assigned_to IS NOT NULL AND
     NEW.assigned_to != auth.uid() THEN

    SELECT title, project_id INTO v_task_title, v_project_id
    FROM tasks WHERE id = NEW.id;

    SELECT COALESCE(full_name, email) INTO v_actor_name
    FROM profiles WHERE id = auth.uid();

    PERFORM create_attention_item(
      NEW.assigned_to,
      'status_change',
      'normal',
      'Status changed: ' || v_task_title,
      COALESCE(v_actor_name, 'Someone') || ' changed status to ' || NEW.status,
      NEW.id,
      NULL,
      NULL,
      v_project_id,
      auth.uid(),
      'status:' || NEW.id || ':' || NEW.status
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_status_attention_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_task_status_attention();

-- Trigger: Comment creates attention item for task owner/assignee
CREATE OR REPLACE FUNCTION trigger_comment_attention()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title TEXT;
  v_task_assignee UUID;
  v_task_creator UUID;
  v_project_id UUID;
  v_actor_name TEXT;
BEGIN
  SELECT t.title, t.assigned_to, t.created_by, t.project_id
  INTO v_task_title, v_task_assignee, v_task_creator, v_project_id
  FROM tasks t WHERE t.id = NEW.task_id;

  SELECT COALESCE(full_name, email) INTO v_actor_name
  FROM profiles WHERE id = NEW.user_id;

  -- Notify assignee (if not the commenter)
  IF v_task_assignee IS NOT NULL AND v_task_assignee != NEW.user_id THEN
    PERFORM create_attention_item(
      v_task_assignee,
      'comment',
      'normal',
      'New comment on: ' || v_task_title,
      COALESCE(v_actor_name, 'Someone') || ': ' || LEFT(NEW.content, 100),
      NEW.task_id,
      NEW.id,
      NULL,
      v_project_id,
      NEW.user_id,
      'comment:' || NEW.task_id || ':' || DATE_TRUNC('hour', NOW())
    );
  END IF;

  -- Also notify task creator if different from assignee and commenter
  IF v_task_creator IS NOT NULL AND
     v_task_creator != NEW.user_id AND
     v_task_creator != COALESCE(v_task_assignee, '00000000-0000-0000-0000-000000000000'::UUID) THEN
    PERFORM create_attention_item(
      v_task_creator,
      'comment',
      'normal',
      'New comment on: ' || v_task_title,
      COALESCE(v_actor_name, 'Someone') || ': ' || LEFT(NEW.content, 100),
      NEW.task_id,
      NEW.id,
      NULL,
      v_project_id,
      NEW.user_id,
      'comment:' || NEW.task_id || ':creator:' || DATE_TRUNC('hour', NOW())
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER comment_attention_trigger
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_comment_attention();

-- -----------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- -----------------------------------------------------

ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attention_items ENABLE ROW LEVEL SECURITY;

-- Mentions: Users can see mentions where they are mentioned or the mentioner
CREATE POLICY mentions_select ON mentions
  FOR SELECT USING (
    mentioned_user_id = auth.uid() OR
    mentioner_user_id = auth.uid()
  );

-- Mentions: Users can create mentions (for others)
CREATE POLICY mentions_insert ON mentions
  FOR INSERT WITH CHECK (
    mentioner_user_id = auth.uid()
  );

-- Mentions: Users can update their own mentions (mark as read)
CREATE POLICY mentions_update ON mentions
  FOR UPDATE USING (
    mentioned_user_id = auth.uid()
  );

-- Attention items: Users can only see their own
CREATE POLICY attention_select ON attention_items
  FOR SELECT USING (user_id = auth.uid());

-- Attention items: System can insert (via security definer functions)
CREATE POLICY attention_insert ON attention_items
  FOR INSERT WITH CHECK (true);

-- Attention items: Users can update their own (mark read, dismiss)
CREATE POLICY attention_update ON attention_items
  FOR UPDATE USING (user_id = auth.uid());

-- Attention items: Users can delete their own
CREATE POLICY attention_delete ON attention_items
  FOR DELETE USING (user_id = auth.uid());

-- -----------------------------------------------------
-- 7. VIEWS FOR COMMON QUERIES
-- -----------------------------------------------------

-- Inbox view with all relevant data
CREATE OR REPLACE VIEW inbox_view AS
SELECT
  ai.id,
  ai.user_id,
  ai.attention_type,
  ai.priority,
  ai.title,
  ai.body,
  ai.read_at,
  ai.created_at,
  ai.updated_at,
  ai.task_id,
  ai.comment_id,
  ai.mention_id,
  ai.project_id,
  -- Task info
  t.title AS task_title,
  t.status AS task_status,
  -- Project info
  p.name AS project_name,
  -- Actor info
  actor.full_name AS actor_name,
  actor.avatar_url AS actor_avatar
FROM attention_items ai
LEFT JOIN tasks t ON ai.task_id = t.id
LEFT JOIN projects p ON ai.project_id = p.id
LEFT JOIN profiles actor ON ai.actor_user_id = actor.id
WHERE ai.dismissed_at IS NULL
ORDER BY
  CASE ai.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END,
  ai.created_at DESC;

-- -----------------------------------------------------
-- 8. UTILITY FUNCTIONS FOR API
-- -----------------------------------------------------

-- Mark item as read
CREATE OR REPLACE FUNCTION mark_attention_read(p_item_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE attention_items
  SET read_at = NOW(), updated_at = NOW()
  WHERE id = p_item_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark all as read
CREATE OR REPLACE FUNCTION mark_all_attention_read()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE attention_items
  SET read_at = NOW(), updated_at = NOW()
  WHERE user_id = auth.uid()
    AND read_at IS NULL
    AND dismissed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dismiss item
CREATE OR REPLACE FUNCTION dismiss_attention_item(p_item_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE attention_items
  SET dismissed_at = NOW(), updated_at = NOW()
  WHERE id = p_item_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread count
CREATE OR REPLACE FUNCTION get_unread_attention_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM attention_items
    WHERE user_id = auth.uid()
      AND read_at IS NULL
      AND dismissed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------
-- 9. GRANTS
-- -----------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON mentions TO authenticated;
GRANT SELECT, UPDATE, DELETE ON attention_items TO authenticated;
GRANT SELECT ON inbox_view TO authenticated;
GRANT EXECUTE ON FUNCTION mark_attention_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_attention_read() TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_attention_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_attention_count() TO authenticated;
-- Migration: Add color field to tasks
-- This allows users to assign a color to tasks for visual organization

-- Add color column to tasks table
-- Using VARCHAR(7) for hex colors like #EF4444
-- NULL means default (no color)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS color VARCHAR(7);

-- Add constraint to enforce valid color values (controlled palette)
-- Allowed colors: red, orange, yellow, green, blue, purple, pink, or NULL (default)
ALTER TABLE tasks ADD CONSTRAINT tasks_color_check
  CHECK (color IS NULL OR color IN (
    '#EF4444',  -- Red
    '#F97316',  -- Orange
    '#EAB308',  -- Yellow
    '#22C55E',  -- Green
    '#3B82F6',  -- Blue
    '#8B5CF6',  -- Purple
    '#EC4899'   -- Pink
  ));

-- Add comment explaining the column
COMMENT ON COLUMN tasks.color IS 'Optional color label for task visual identification. Must be one of the predefined hex colors or NULL for default.';
-- Migration: Fix comment attention trigger to use created_by instead of user_id
-- The comments table uses 'created_by' not 'user_id', but the trigger was referencing NEW.user_id

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS comment_attention_trigger ON comments;

-- Recreate the function with the correct column reference
CREATE OR REPLACE FUNCTION trigger_comment_attention()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title TEXT;
  v_task_assignee UUID;
  v_task_creator UUID;
  v_project_id UUID;
  v_actor_name TEXT;
BEGIN
  SELECT t.title, t.assigned_to, t.created_by, t.project_id
  INTO v_task_title, v_task_assignee, v_task_creator, v_project_id
  FROM tasks t WHERE t.id = NEW.task_id;

  -- Use NEW.created_by instead of NEW.user_id (comments table uses created_by)
  SELECT COALESCE(full_name, email) INTO v_actor_name
  FROM profiles WHERE id = NEW.created_by;

  -- Notify assignee (if not the commenter)
  IF v_task_assignee IS NOT NULL AND v_task_assignee != NEW.created_by THEN
    PERFORM create_attention_item(
      v_task_assignee,
      'comment',
      'normal',
      'New comment on: ' || v_task_title,
      COALESCE(v_actor_name, 'Someone') || ': ' || LEFT(NEW.content, 100),
      NEW.task_id,
      NEW.id,
      NULL,
      v_project_id,
      NEW.created_by,
      'comment:' || NEW.task_id || ':' || DATE_TRUNC('hour', NOW())
    );
  END IF;

  -- Also notify task creator if different from assignee and commenter
  IF v_task_creator IS NOT NULL AND
     v_task_creator != NEW.created_by AND
     v_task_creator != COALESCE(v_task_assignee, '00000000-0000-0000-0000-000000000000'::UUID) THEN
    PERFORM create_attention_item(
      v_task_creator,
      'comment',
      'normal',
      'New comment on: ' || v_task_title,
      COALESCE(v_actor_name, 'Someone') || ': ' || LEFT(NEW.content, 100),
      NEW.task_id,
      NEW.id,
      NULL,
      v_project_id,
      NEW.created_by,
      'comment:' || NEW.task_id || ':creator:' || DATE_TRUNC('hour', NOW())
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER comment_attention_trigger
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_comment_attention();
-- Migration: Task Approval Workflow
-- Adds approval fields to tasks table and updates completed count logic

-- Add approval columns to tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'none' CHECK (approval_status IN ('none', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS moved_to_done_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moved_to_done_by UUID REFERENCES auth.users(id);

-- Create index for approval status queries
CREATE INDEX IF NOT EXISTS idx_tasks_approval_status ON public.tasks(approval_status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_approval ON public.tasks(project_id, approval_status);

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

-- Function to handle task approval
CREATE OR REPLACE FUNCTION approve_task(
  p_task_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_id UUID;
  v_current_stage_id TEXT;
BEGIN
  -- Get task info
  SELECT project_id, stage_id INTO v_project_id, v_current_stage_id
  FROM tasks WHERE id = p_task_id;

  -- Check if user is owner/admin
  IF NOT is_project_owner_or_admin(v_project_id, p_user_id) THEN
    RAISE EXCEPTION 'Only project owners or admins can approve tasks';
  END IF;

  -- Check if task is in Done stage and pending approval
  IF v_current_stage_id != 'done' THEN
    RAISE EXCEPTION 'Task must be in Done stage to be approved';
  END IF;

  -- Update task approval status
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

-- Function to handle task rejection
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
  -- Get task info
  SELECT project_id INTO v_project_id
  FROM tasks WHERE id = p_task_id;

  -- Check if user is owner/admin
  IF NOT is_project_owner_or_admin(v_project_id, p_user_id) THEN
    RAISE EXCEPTION 'Only project owners or admins can reject tasks';
  END IF;

  -- Update task - move back to previous stage and clear approval
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

-- Trigger to set approval_status to 'pending' when task moves to Done stage
CREATE OR REPLACE FUNCTION handle_task_move_to_done()
RETURNS TRIGGER AS $$
DECLARE
  v_done_stage_id TEXT := 'done';
BEGIN
  -- Check if task is moving TO the Done stage
  IF NEW.stage_id = v_done_stage_id AND (OLD.stage_id IS NULL OR OLD.stage_id != v_done_stage_id) THEN
    -- Only set to pending if not already approved
    IF NEW.approval_status IS NULL OR NEW.approval_status = 'none' OR NEW.approval_status = 'rejected' THEN
      NEW.approval_status := 'pending';
      NEW.moved_to_done_at := NOW();
      NEW.moved_to_done_by := NEW.updated_by;
      -- Clear any previous rejection reason
      NEW.rejection_reason := NULL;
    END IF;
  END IF;

  -- If task moves OUT of Done stage, reset approval status
  IF OLD.stage_id = v_done_stage_id AND NEW.stage_id != v_done_stage_id THEN
    -- Only reset if it was pending (not if it was approved)
    IF NEW.approval_status = 'pending' THEN
      NEW.approval_status := 'none';
      NEW.moved_to_done_at := NULL;
      NEW.moved_to_done_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS task_done_approval_trigger ON tasks;
CREATE TRIGGER task_done_approval_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_move_to_done();

-- Also handle on INSERT (new task created directly in Done stage)
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

-- Update existing tasks in Done stage to have pending approval
UPDATE tasks
SET
  approval_status = 'pending',
  moved_to_done_at = COALESCE(completed_at, updated_at, created_at),
  moved_to_done_by = COALESCE(updated_by, created_by)
WHERE stage_id = 'done' AND (approval_status IS NULL OR approval_status = 'none');

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_project_owner_or_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_task(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_task(UUID, UUID, TEXT, TEXT) TO authenticated;
-- Advanced Project Management Features Migration
-- Adds: Enhanced task assignments with roles, task dependencies,
-- time tracking improvements, milestones, portfolios, recurring tasks

-- ============================================
-- 1. ENHANCED TASK ASSIGNMENTS WITH ROLES
-- ============================================

-- Add role column to existing task_assignments table
ALTER TABLE task_assignments
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'assignee'
CHECK (role IN ('owner', 'assignee', 'reviewer', 'collaborator'));

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_task_assignments_role ON task_assignments(role);

-- ============================================
-- 2. TASK DEPENDENCIES
-- ============================================

CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    blocking_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    blocked_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) DEFAULT 'finish_to_start'
        CHECK (dependency_type IN ('finish_to_start', 'start_to_start',
                                    'finish_to_finish', 'start_to_finish')),
    lag_days INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),

    UNIQUE(blocking_task_id, blocked_task_id),
    CHECK (blocking_task_id != blocked_task_id)
);

CREATE INDEX IF NOT EXISTS idx_dependencies_blocking ON task_dependencies(blocking_task_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_blocked ON task_dependencies(blocked_task_id);

-- Enable RLS
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_dependencies
CREATE POLICY "Users can view dependencies for their projects" ON task_dependencies
    FOR SELECT USING (
        blocking_task_id IN (
            SELECT id FROM tasks WHERE project_id IN (
                SELECT project_id FROM project_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Project editors can create dependencies" ON task_dependencies
    FOR INSERT WITH CHECK (
        blocking_task_id IN (
            SELECT id FROM tasks WHERE project_id IN (
                SELECT project_id FROM project_members
                WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
            )
        )
    );

CREATE POLICY "Project editors can delete dependencies" ON task_dependencies
    FOR DELETE USING (
        blocking_task_id IN (
            SELECT id FROM tasks WHERE project_id IN (
                SELECT project_id FROM project_members
                WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
            )
        )
    );

-- Function to check for circular dependencies
CREATE OR REPLACE FUNCTION check_circular_dependency()
RETURNS TRIGGER AS $$
DECLARE
    cycle_found BOOLEAN := FALSE;
    visited_ids UUID[];
    current_id UUID;
    queue UUID[];
BEGIN
    -- Start BFS from the blocked task to see if we can reach the blocking task
    queue := ARRAY[NEW.blocked_task_id];
    visited_ids := ARRAY[NEW.blocked_task_id];

    WHILE array_length(queue, 1) > 0 LOOP
        current_id := queue[1];
        queue := queue[2:];

        -- Check if we've reached the blocking task (cycle!)
        IF current_id = NEW.blocking_task_id THEN
            RAISE EXCEPTION 'Circular dependency detected: This would create a cycle in task dependencies';
        END IF;

        -- Add all tasks that current_id blocks to the queue
        FOR current_id IN
            SELECT blocked_task_id FROM task_dependencies
            WHERE blocking_task_id = current_id
        LOOP
            IF NOT current_id = ANY(visited_ids) THEN
                visited_ids := array_append(visited_ids, current_id);
                queue := array_append(queue, current_id);
            END IF;
        END LOOP;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_circular_dependencies
    BEFORE INSERT OR UPDATE ON task_dependencies
    FOR EACH ROW EXECUTE FUNCTION check_circular_dependency();

-- ============================================
-- 3. ENHANCED TIME TRACKING
-- ============================================

-- Add is_running column to track active timers
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS is_running BOOLEAN DEFAULT FALSE;

-- Make duration nullable for running timers
ALTER TABLE time_entries
ALTER COLUMN duration DROP NOT NULL;

-- Add index for finding running timers
CREATE INDEX IF NOT EXISTS idx_time_entries_running
ON time_entries(user_id) WHERE is_running = TRUE;

-- Function to ensure only one running timer per user
CREATE OR REPLACE FUNCTION ensure_single_running_timer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_running = TRUE THEN
        -- Stop any existing running timer for this user
        UPDATE time_entries
        SET is_running = FALSE,
            ended_at = NOW(),
            duration = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60
        WHERE user_id = NEW.user_id
          AND is_running = TRUE
          AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER single_running_timer
    BEFORE INSERT OR UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION ensure_single_running_timer();

-- ============================================
-- 4. TASK ENHANCEMENTS (start_date, parent_task, estimated_hours)
-- ============================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(6,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date) WHERE start_date IS NOT NULL;

-- Prevent deep nesting (max 2 levels)
CREATE OR REPLACE FUNCTION check_task_nesting_depth()
RETURNS TRIGGER AS $$
DECLARE
    parent_depth INTEGER := 0;
    current_parent UUID;
BEGIN
    IF NEW.parent_task_id IS NOT NULL THEN
        current_parent := NEW.parent_task_id;

        -- Count depth
        WHILE current_parent IS NOT NULL LOOP
            parent_depth := parent_depth + 1;
            IF parent_depth > 2 THEN
                RAISE EXCEPTION 'Maximum task nesting depth (2 levels) exceeded';
            END IF;

            SELECT parent_task_id INTO current_parent
            FROM tasks WHERE id = current_parent;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_task_depth
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION check_task_nesting_depth();

-- ============================================
-- 5. MILESTONES
-- ============================================

CREATE TABLE IF NOT EXISTS milestones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE NOT NULL,
    completed_at TIMESTAMPTZ,
    color VARCHAR(7) DEFAULT '#6366F1',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON milestones(target_date);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view milestones" ON milestones
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Project editors can manage milestones" ON milestones
    FOR ALL USING (
        project_id IN (
            SELECT project_id FROM project_members
            WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
        )
    );

-- Link tasks to milestones
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone_id) WHERE milestone_id IS NOT NULL;

-- ============================================
-- 6. PORTFOLIOS
-- ============================================

CREATE TABLE IF NOT EXISTS portfolios (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#8B5CF6',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_projects (
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (portfolio_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolios_org ON portfolios(organization_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_portfolio ON portfolio_projects(portfolio_id);

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view portfolios" ON portfolios
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins can manage portfolios" ON portfolios
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Portfolio viewers can see portfolio projects" ON portfolio_projects
    FOR SELECT USING (
        portfolio_id IN (
            SELECT id FROM portfolios WHERE organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

-- ============================================
-- 7. RECURRING TASKS
-- ============================================

CREATE TABLE IF NOT EXISTS task_recurrences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL
        CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom')),
    interval_value INTEGER DEFAULT 1,
    days_of_week INTEGER[] DEFAULT NULL,
    day_of_month INTEGER DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    max_occurrences INTEGER DEFAULT NULL,
    occurrences_created INTEGER DEFAULT 0,
    next_occurrence_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS idx_recurrences_next
ON task_recurrences(next_occurrence_date) WHERE is_active = TRUE;

ALTER TABLE task_recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recurrences for their tasks" ON task_recurrences
    FOR SELECT USING (
        task_id IN (
            SELECT id FROM tasks WHERE project_id IN (
                SELECT project_id FROM project_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Project editors can manage recurrences" ON task_recurrences
    FOR ALL USING (
        task_id IN (
            SELECT id FROM tasks WHERE project_id IN (
                SELECT project_id FROM project_members
                WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
            )
        )
    );

-- ============================================
-- 8. WORKFLOW STAGES ENHANCEMENTS (WIP Limits)
-- ============================================

-- Add WIP limit support to projects (stored in workflow_stages JSON)
-- Each stage can have: { id, name, color, wip_limit, wip_limit_type, is_done_stage }

-- Function to validate WIP limits when moving tasks
CREATE OR REPLACE FUNCTION check_wip_limit()
RETURNS TRIGGER AS $$
DECLARE
    stage_config JSONB;
    wip_limit INTEGER;
    wip_type TEXT;
    current_count INTEGER;
    project_workflow JSONB;
BEGIN
    -- Only check if stage_id changed
    IF OLD.stage_id = NEW.stage_id THEN
        RETURN NEW;
    END IF;

    -- Get project workflow stages
    SELECT workflow_stages INTO project_workflow
    FROM projects WHERE id = NEW.project_id;

    -- Find the target stage config
    SELECT elem INTO stage_config
    FROM jsonb_array_elements(project_workflow) AS elem
    WHERE elem->>'id' = NEW.stage_id;

    -- Check if WIP limit exists
    wip_limit := (stage_config->>'wip_limit')::INTEGER;
    wip_type := COALESCE(stage_config->>'wip_limit_type', 'warning');

    IF wip_limit IS NOT NULL AND wip_limit > 0 THEN
        -- Count current tasks in target stage (excluding subtasks)
        SELECT COUNT(*) INTO current_count
        FROM tasks
        WHERE project_id = NEW.project_id
          AND stage_id = NEW.stage_id
          AND parent_task_id IS NULL
          AND id != NEW.id;

        IF current_count >= wip_limit THEN
            IF wip_type = 'strict' THEN
                RAISE EXCEPTION 'WIP limit reached for this column (% tasks max)', wip_limit;
            END IF;
            -- For 'warning' type, we let it through but could log a warning
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_stage_wip_limit
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION check_wip_limit();

-- ============================================
-- 9. PROJECT DAILY SNAPSHOTS (for reporting)
-- ============================================

CREATE TABLE IF NOT EXISTS project_daily_snapshots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    tasks_by_stage JSONB NOT NULL DEFAULT '{}',
    tasks_by_priority JSONB NOT NULL DEFAULT '{}',
    overdue_tasks INTEGER NOT NULL DEFAULT 0,
    total_estimated_hours DECIMAL(10,2) DEFAULT 0,
    total_actual_hours DECIMAL(10,2) DEFAULT 0,

    UNIQUE(project_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_project_date
ON project_daily_snapshots(project_id, snapshot_date DESC);

ALTER TABLE project_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view snapshots" ON project_daily_snapshots
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

-- Function to create daily snapshot
CREATE OR REPLACE FUNCTION create_project_snapshot(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
    snapshot_exists BOOLEAN;
    today DATE := CURRENT_DATE;
BEGIN
    -- Check if snapshot already exists for today
    SELECT EXISTS(
        SELECT 1 FROM project_daily_snapshots
        WHERE project_id = p_project_id AND snapshot_date = today
    ) INTO snapshot_exists;

    IF snapshot_exists THEN
        -- Update existing snapshot
        UPDATE project_daily_snapshots
        SET
            total_tasks = (
                SELECT COUNT(*) FROM tasks
                WHERE project_id = p_project_id AND parent_task_id IS NULL
            ),
            completed_tasks = (
                SELECT COUNT(*) FROM tasks t
                JOIN projects p ON t.project_id = p.id
                WHERE t.project_id = p_project_id
                  AND t.parent_task_id IS NULL
                  AND t.approval_status = 'approved'
                  AND EXISTS (
                      SELECT 1 FROM jsonb_array_elements(p.workflow_stages) AS stage
                      WHERE stage->>'id' = t.stage_id
                        AND (stage->>'is_done_stage')::boolean = true
                  )
            ),
            tasks_by_stage = (
                SELECT jsonb_object_agg(stage_id, cnt)
                FROM (
                    SELECT stage_id, COUNT(*) as cnt
                    FROM tasks
                    WHERE project_id = p_project_id AND parent_task_id IS NULL
                    GROUP BY stage_id
                ) sub
            ),
            tasks_by_priority = (
                SELECT jsonb_object_agg(priority::text, cnt)
                FROM (
                    SELECT priority, COUNT(*) as cnt
                    FROM tasks
                    WHERE project_id = p_project_id AND parent_task_id IS NULL
                    GROUP BY priority
                ) sub
            ),
            overdue_tasks = (
                SELECT COUNT(*) FROM tasks
                WHERE project_id = p_project_id
                  AND parent_task_id IS NULL
                  AND due_date < NOW()
                  AND completed_at IS NULL
            ),
            total_estimated_hours = (
                SELECT COALESCE(SUM(estimated_hours), 0) FROM tasks
                WHERE project_id = p_project_id
            ),
            total_actual_hours = (
                SELECT COALESCE(SUM(duration), 0) / 60.0 FROM time_entries te
                JOIN tasks t ON te.task_id = t.id
                WHERE t.project_id = p_project_id
            )
        WHERE project_id = p_project_id AND snapshot_date = today;
    ELSE
        -- Insert new snapshot
        INSERT INTO project_daily_snapshots (
            project_id, snapshot_date, total_tasks, completed_tasks,
            tasks_by_stage, tasks_by_priority, overdue_tasks,
            total_estimated_hours, total_actual_hours
        )
        SELECT
            p_project_id,
            today,
            (SELECT COUNT(*) FROM tasks WHERE project_id = p_project_id AND parent_task_id IS NULL),
            (SELECT COUNT(*) FROM tasks t
             JOIN projects p ON t.project_id = p.id
             WHERE t.project_id = p_project_id
               AND t.parent_task_id IS NULL
               AND t.approval_status = 'approved'
               AND EXISTS (
                   SELECT 1 FROM jsonb_array_elements(p.workflow_stages) AS stage
                   WHERE stage->>'id' = t.stage_id
                     AND (stage->>'is_done_stage')::boolean = true
               )),
            COALESCE((SELECT jsonb_object_agg(stage_id, cnt)
             FROM (SELECT stage_id, COUNT(*) as cnt FROM tasks
                   WHERE project_id = p_project_id AND parent_task_id IS NULL
                   GROUP BY stage_id) sub), '{}'),
            COALESCE((SELECT jsonb_object_agg(priority::text, cnt)
             FROM (SELECT priority, COUNT(*) as cnt FROM tasks
                   WHERE project_id = p_project_id AND parent_task_id IS NULL
                   GROUP BY priority) sub), '{}'),
            (SELECT COUNT(*) FROM tasks
             WHERE project_id = p_project_id AND parent_task_id IS NULL
               AND due_date < NOW() AND completed_at IS NULL),
            (SELECT COALESCE(SUM(estimated_hours), 0) FROM tasks WHERE project_id = p_project_id),
            (SELECT COALESCE(SUM(duration), 0) / 60.0 FROM time_entries te
             JOIN tasks t ON te.task_id = t.id WHERE t.project_id = p_project_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. ENABLE REALTIME FOR NEW TABLES
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE task_dependencies;
ALTER PUBLICATION supabase_realtime ADD TABLE milestones;
ALTER PUBLICATION supabase_realtime ADD TABLE portfolios;
ALTER PUBLICATION supabase_realtime ADD TABLE task_recurrences;

-- ============================================
-- 11. HELPER FUNCTIONS
-- ============================================

-- Get all tasks blocking a specific task
CREATE OR REPLACE FUNCTION get_blocking_tasks(p_task_id UUID)
RETURNS TABLE (
    task_id UUID,
    title TEXT,
    stage_id TEXT,
    is_completed BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.title, t.stage_id,
           (t.approval_status = 'approved' AND EXISTS (
               SELECT 1 FROM projects p, jsonb_array_elements(p.workflow_stages) AS stage
               WHERE p.id = t.project_id
                 AND stage->>'id' = t.stage_id
                 AND (stage->>'is_done_stage')::boolean = true
           )) as is_completed
    FROM tasks t
    JOIN task_dependencies td ON t.id = td.blocking_task_id
    WHERE td.blocked_task_id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- Get all tasks blocked by a specific task
CREATE OR REPLACE FUNCTION get_blocked_tasks(p_task_id UUID)
RETURNS TABLE (
    task_id UUID,
    title TEXT,
    stage_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.title, t.stage_id
    FROM tasks t
    JOIN task_dependencies td ON t.id = td.blocked_task_id
    WHERE td.blocking_task_id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- Check if a task is blocked
CREATE OR REPLACE FUNCTION is_task_blocked(p_task_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_incomplete_blocker BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM task_dependencies td
        JOIN tasks t ON td.blocking_task_id = t.id
        JOIN projects p ON t.project_id = p.id
        WHERE td.blocked_task_id = p_task_id
          AND NOT (
              t.approval_status = 'approved'
              AND EXISTS (
                  SELECT 1 FROM jsonb_array_elements(p.workflow_stages) AS stage
                  WHERE stage->>'id' = t.stage_id
                    AND (stage->>'is_done_stage')::boolean = true
              )
          )
    ) INTO has_incomplete_blocker;

    RETURN has_incomplete_blocker;
END;
$$ LANGUAGE plpgsql;

-- Get task count summary for a project (excluding subtasks for main counts)
CREATE OR REPLACE FUNCTION get_project_task_counts(p_project_id UUID)
RETURNS TABLE (
    total_tasks BIGINT,
    completed_tasks BIGINT,
    pending_approval BIGINT,
    overdue_tasks BIGINT,
    blocked_tasks BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH project_info AS (
        SELECT workflow_stages FROM projects WHERE id = p_project_id
    ),
    done_stage_ids AS (
        SELECT stage->>'id' as stage_id
        FROM project_info, jsonb_array_elements(workflow_stages) AS stage
        WHERE (stage->>'is_done_stage')::boolean = true
           OR stage->>'id' = 'done'
           OR LOWER(stage->>'name') = 'done'
    )
    SELECT
        COUNT(*) FILTER (WHERE parent_task_id IS NULL) as total_tasks,
        COUNT(*) FILTER (
            WHERE parent_task_id IS NULL
            AND stage_id IN (SELECT stage_id FROM done_stage_ids)
            AND approval_status = 'approved'
        ) as completed_tasks,
        COUNT(*) FILTER (
            WHERE parent_task_id IS NULL
            AND stage_id IN (SELECT stage_id FROM done_stage_ids)
            AND approval_status = 'pending'
        ) as pending_approval,
        COUNT(*) FILTER (
            WHERE parent_task_id IS NULL
            AND due_date < NOW()
            AND completed_at IS NULL
        ) as overdue_tasks,
        COUNT(*) FILTER (
            WHERE parent_task_id IS NULL
            AND is_task_blocked(id) = true
        ) as blocked_tasks
    FROM tasks
    WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate actual hours for a task from time entries
CREATE OR REPLACE FUNCTION get_task_actual_hours(p_task_id UUID)
RETURNS DECIMAL(10,2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(
            CASE
                WHEN is_running THEN EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600
                ELSE COALESCE(duration, 0) / 60.0
            END
        ) FROM time_entries WHERE task_id = p_task_id),
        0
    );
END;
$$ LANGUAGE plpgsql;
-- Add assigned_to field to subtasks table for member assignments
-- This allows assigning team members to individual subtasks

ALTER TABLE subtasks
ADD COLUMN assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for faster lookups by assignee
CREATE INDEX idx_subtasks_assigned_to ON subtasks(assigned_to);

-- Add RLS policy for subtask assignments
-- Users can update subtask assignment if they can edit the parent task
CREATE POLICY "Users can update subtask assignment"
ON subtasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN project_members pm ON pm.project_id = t.project_id
    WHERE t.id = subtasks.task_id
    AND pm.user_id = auth.uid()
    AND pm.role IN ('owner', 'admin', 'member')
  )
);

-- Comment for documentation
COMMENT ON COLUMN subtasks.assigned_to IS 'The user ID assigned to complete this subtask';
-- Project Invitations table for inviting users who may or may not have accounts yet
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('viewer', 'member', 'admin')),
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(project_id, email)
);

-- Index for looking up invitations by email (for when user logs in)
CREATE INDEX idx_project_invitations_email ON project_invitations(email) WHERE status = 'pending';

-- Index for looking up by token (for accepting via link)
CREATE INDEX idx_project_invitations_token ON project_invitations(token) WHERE status = 'pending';

-- RLS policies
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

-- Project admins/owners can view invitations for their projects
CREATE POLICY "Project admins can view invitations" ON project_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_invitations.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('admin', 'owner')
    )
  );

-- Project admins/owners can create invitations
CREATE POLICY "Project admins can create invitations" ON project_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_invitations.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('admin', 'owner')
    )
  );

-- Project admins/owners can update invitations (e.g., cancel)
CREATE POLICY "Project admins can update invitations" ON project_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_invitations.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('admin', 'owner')
    )
  );

-- Project admins/owners can delete invitations
CREATE POLICY "Project admins can delete invitations" ON project_invitations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_invitations.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('admin', 'owner')
    )
  );

-- Users can view their own invitations (by email match with their profile)
CREATE POLICY "Users can view their own invitations" ON project_invitations
  FOR SELECT
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- Users can update their own invitations (accept/decline)
CREATE POLICY "Users can update their own invitations" ON project_invitations
  FOR UPDATE
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );
-- Migration: Fix profile trigger for new user signup
-- Problem: The handle_new_user trigger may be failing silently, leaving users without profiles
-- Solution: Recreate the trigger with better error handling and also fix any existing users without profiles

-- ============================================
-- PART 1: Drop and recreate the trigger function with better handling
-- ============================================

-- Drop the old trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert profile with ON CONFLICT to handle edge cases
  INSERT INTO public.profiles (id, email, full_name, avatar_url, profile_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth signup
    RAISE WARNING 'handle_new_user trigger failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PART 2: Fix any existing auth users who don't have profiles
-- This handles users who signed up when the trigger was broken
-- ============================================

-- Insert missing profiles for any auth users without them
INSERT INTO public.profiles (id, email, full_name, avatar_url, profile_completed)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture'),
  false
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PART 3: Ensure the profiles table has proper constraints
-- ============================================

-- Make sure email column allows updates (for the ON CONFLICT clause)
-- The UNIQUE constraint should already exist, but ensure it does
DO $$
BEGIN
  -- Check if unique constraint exists on email
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_email_key'
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    -- Add unique constraint if missing
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists, that's fine
    NULL;
END $$;

-- ============================================
-- VERIFICATION: Show how many profiles were fixed
-- ============================================
DO $$
DECLARE
  profile_count INTEGER;
  auth_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  RAISE NOTICE 'Profile sync complete: % profiles for % auth users', profile_count, auth_count;
END $$;
-- Migration: Add image_url column to projects table
-- This allows projects to have a custom image/avatar

-- Add image_url column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN projects.image_url IS 'URL to the project image/avatar, can be a data URL or external URL';
-- Migration: Create activity_log table to persist activity history
-- This ensures activities are retained even when tasks/comments are deleted

-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  activity_type TEXT NOT NULL,

  -- Denormalized data for persistence (won't change when source is deleted)
  actor_name TEXT,
  actor_avatar TEXT,
  project_name TEXT,
  project_color TEXT,

  -- Optional references (may be null if source is deleted)
  task_id UUID,
  task_title TEXT,
  comment_id UUID,
  milestone_id UUID,
  milestone_name TEXT,
  target_user_id UUID,
  target_user_name TEXT,

  -- Additional metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_log_project_id ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id ON activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_task_id ON activity_log(task_id);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read activities for projects they are members of
CREATE POLICY "Users can read project activities"
  ON activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = activity_log.project_id
      AND pm.user_id = auth.uid()
    )
  );

-- Policy: System/Service role can insert activities
CREATE POLICY "Service can insert activities"
  ON activity_log
  FOR INSERT
  WITH CHECK (true);

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_project_id UUID,
  p_actor_id UUID,
  p_activity_type TEXT,
  p_task_id UUID DEFAULT NULL,
  p_task_title TEXT DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_target_user_name TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_actor_profile RECORD;
  v_project RECORD;
  v_activity_id UUID;
BEGIN
  -- Get actor profile
  SELECT full_name, avatar_url INTO v_actor_profile
  FROM profiles WHERE id = p_actor_id;

  -- Get project info
  SELECT name, color INTO v_project
  FROM projects WHERE id = p_project_id;

  -- Insert activity log
  INSERT INTO activity_log (
    project_id,
    actor_id,
    activity_type,
    actor_name,
    actor_avatar,
    project_name,
    project_color,
    task_id,
    task_title,
    comment_id,
    target_user_id,
    target_user_name,
    metadata
  ) VALUES (
    p_project_id,
    p_actor_id,
    p_activity_type,
    COALESCE(v_actor_profile.full_name, 'Unknown'),
    v_actor_profile.avatar_url,
    COALESCE(v_project.name, 'Unknown Project'),
    COALESCE(v_project.color, '#3B82F6'),
    p_task_id,
    p_task_title,
    p_comment_id,
    p_target_user_id,
    p_target_user_name,
    p_metadata
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to auto-log task creation
CREATE OR REPLACE FUNCTION log_task_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    NEW.project_id,
    NEW.created_by,
    'task_created',
    NEW.id,
    NEW.title
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for task creation
DROP TRIGGER IF EXISTS trigger_log_task_created ON tasks;
CREATE TRIGGER trigger_log_task_created
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_created();

-- Trigger function to auto-log task completion (moved to done stage with approved status)
CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when task is moved to approval pending
  IF NEW.approval_status = 'pending' AND (OLD.approval_status IS NULL OR OLD.approval_status != 'pending') THEN
    PERFORM log_activity(
      NEW.project_id,
      COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
      'approval_requested',
      NEW.id,
      NEW.title
    );
  END IF;

  -- Log when task is approved
  IF NEW.approval_status = 'approved' AND OLD.approval_status != 'approved' THEN
    PERFORM log_activity(
      NEW.project_id,
      COALESCE(NEW.approved_by, NEW.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
      'approval_approved',
      NEW.id,
      NEW.title
    );
  END IF;

  -- Log when task is rejected
  IF NEW.approval_status = 'rejected' AND OLD.approval_status != 'rejected' THEN
    PERFORM log_activity(
      NEW.project_id,
      COALESCE(NEW.approved_by, NEW.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
      'approval_rejected',
      NEW.id,
      NEW.title
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for task status changes
DROP TRIGGER IF EXISTS trigger_log_task_status ON tasks;
CREATE TRIGGER trigger_log_task_status
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_status_change();

-- Trigger function to auto-log comments
CREATE OR REPLACE FUNCTION log_comment_added()
RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
BEGIN
  -- Get task info
  SELECT id, title, project_id INTO v_task
  FROM tasks WHERE id = NEW.task_id;

  IF v_task IS NOT NULL THEN
    PERFORM log_activity(
      v_task.project_id,
      NEW.created_by,
      'comment_added',
      v_task.id,
      v_task.title,
      NEW.id,
      NULL,
      NULL,
      jsonb_build_object('content_preview', LEFT(NEW.content, 100))
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for comment creation
DROP TRIGGER IF EXISTS trigger_log_comment_added ON comments;
CREATE TRIGGER trigger_log_comment_added
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION log_comment_added();

-- Trigger function to auto-log task assignments
CREATE OR REPLACE FUNCTION log_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
  v_target_user RECORD;
BEGIN
  -- Get task info
  SELECT id, title, project_id INTO v_task
  FROM tasks WHERE id = NEW.task_id;

  -- Get assigned user info
  SELECT full_name INTO v_target_user
  FROM profiles WHERE id = NEW.user_id;

  IF v_task IS NOT NULL THEN
    PERFORM log_activity(
      v_task.project_id,
      COALESCE(NEW.assigned_by, NEW.user_id),
      'task_assigned',
      v_task.id,
      v_task.title,
      NULL,
      NEW.user_id,
      COALESCE(v_target_user.full_name, 'Unknown')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for task assignment
DROP TRIGGER IF EXISTS trigger_log_task_assignment ON task_assignments;
CREATE TRIGGER trigger_log_task_assignment
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION log_task_assignment();

-- Add comment to table
COMMENT ON TABLE activity_log IS 'Persistent activity log that survives source data deletion';
-- Migration: Create teams table for hierarchical organization structure
-- Organization → Teams → Projects

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

-- Add team_id to projects (nullable for backward compatibility)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read teams they are members of or in their organization
CREATE POLICY "Users can read teams in their organization"
  ON teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = teams.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Policy: Organization admins/owners can create teams
CREATE POLICY "Org admins can create teams"
  ON teams
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = teams.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Policy: Team owners/admins can update teams
CREATE POLICY "Team admins can update teams"
  ON teams
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = teams.id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Policy: Team owners can delete teams
CREATE POLICY "Team owners can delete teams"
  ON teams
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = teams.id
      AND tm.user_id = auth.uid()
      AND tm.role = 'owner'
    )
  );

-- Policy: Users can read team memberships for teams they belong to
CREATE POLICY "Users can read team members"
  ON team_members
  FOR SELECT
  USING (
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

-- Policy: Team admins can manage team members
CREATE POLICY "Team admins can add members"
  ON team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
    OR
    -- Allow first member (team creator) to add themselves
    NOT EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
    )
  );

CREATE POLICY "Team admins can update members"
  ON team_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Team admins can remove members"
  ON team_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
    OR
    -- Users can remove themselves
    team_members.user_id = auth.uid()
  );

-- Trigger to update updated_at
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

-- Add comments
COMMENT ON TABLE teams IS 'Teams within an organization, can contain multiple projects';
COMMENT ON TABLE team_members IS 'Team membership with roles';
COMMENT ON COLUMN projects.team_id IS 'Optional team that owns this project';
