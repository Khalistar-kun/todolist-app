-- Complete Multi-tenant Task Management System Schema
-- This script creates all necessary tables, indexes, and RLS policies

-- First, enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'in_review', 'done', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE project_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE step_trigger AS ENUM ('on_completion', 'on_status_change', 'manual');

-- Projects table (workspaces/multi-vendor containers)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project members (many-to-many with roles)
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role project_role DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'medium',
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  tags TEXT[] DEFAULT '{}',
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  custom_fields JSONB DEFAULT '{}',
  -- Slack integration fields
  slack_message_ts TEXT,
  slack_channel_id TEXT
);

-- Workflows for task automation
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Workflow steps (defines A → B → C progression)
CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  from_status task_status NOT NULL,
  to_status task_status NOT NULL,
  trigger_type step_trigger DEFAULT 'on_completion',
  auto_assign_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);

-- Comments table for task collaboration
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentioned_users UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Attachments table for file uploads
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'task_assigned', 'task_updated', 'comment_added', 'mention', 'due_reminder', etc.
  title TEXT NOT NULL,
  message TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  username TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_task_id ON public.comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_by ON public.comments(created_by);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at);

CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON public.attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_project_id ON public.attachments(project_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Projects
CREATE POLICY "Users can view projects they are members of" ON public.projects
  FOR SELECT USING (
    id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert projects they create" ON public.projects
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Project owners can update projects" ON public.projects
  FOR UPDATE USING (
    created_by = auth.uid() OR
    id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project owners can delete projects" ON public.projects
  FOR DELETE USING (
    created_by = auth.uid()
  );

-- RLS Policies for Project Members
CREATE POLICY "Users can view project memberships" ON public.project_members
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid()
    ) OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can insert project members (invite others)" ON public.project_members
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can update project member roles" ON public.project_members
  FOR UPDATE USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can leave projects" ON public.project_members
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for Tasks
CREATE POLICY "Users can view tasks in their projects" ON public.tasks
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tasks in their projects" ON public.tasks
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid()
    ) AND
    created_by = auth.uid()
  );

CREATE POLICY "Users can update tasks in their projects" ON public.tasks
  FOR UPDATE USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid()
    ) OR
    assigned_to = auth.uid()
  );

CREATE POLICY "Users can delete tasks they created" ON public.tasks
  FOR DELETE USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for Comments
CREATE POLICY "Users can view comments on tasks they can access" ON public.comments
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE project_id IN (
        SELECT project_id FROM public.project_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert comments on tasks they can access" ON public.comments
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE project_id IN (
        SELECT project_id FROM public.project_members
        WHERE user_id = auth.uid()
      )
    ) AND
    created_by = auth.uid()
  );

CREATE POLICY "Users can update their own comments" ON public.comments
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own comments" ON public.comments
  FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for Attachments
CREATE POLICY "Users can view attachments for accessible resources" ON public.attachments
  FOR SELECT USING (
    (task_id IS NOT NULL AND task_id IN (
      SELECT id FROM public.tasks
      WHERE project_id IN (
        SELECT project_id FROM public.project_members
        WHERE user_id = auth.uid()
      )
    )) OR
    (project_id IS NOT NULL AND project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert attachments for accessible resources" ON public.attachments
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND (
      (task_id IS NOT NULL AND task_id IN (
        SELECT id FROM public.tasks
        WHERE project_id IN (
          SELECT project_id FROM public.project_members
          WHERE user_id = auth.uid()
        )
      )) OR
      (project_id IS NOT NULL AND project_id IN (
        SELECT project_id FROM public.project_members
        WHERE user_id = auth.uid()
      ))
    )
  );

-- RLS Policies for Notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for User Profiles
CREATE POLICY "Users can view all profiles" ON public.user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (id = auth.uid());

-- RLS Policies for Workflows
CREATE POLICY "Users can view workflows in their projects" ON public.workflows
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert workflows in their projects" ON public.workflows
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for Workflow Steps
CREATE POLICY "Users can view workflow steps in their projects" ON public.workflow_steps
  FOR SELECT USING (
    workflow_id IN (
      SELECT id FROM public.workflows
      WHERE project_id IN (
        SELECT project_id FROM public.project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create function to handle user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();