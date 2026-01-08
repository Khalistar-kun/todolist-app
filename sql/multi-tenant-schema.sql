-- Multi-tenant schema for project-based access control

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
CREATE TYPE project_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role project_role DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
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
CREATE TYPE step_trigger AS ENUM ('on_completion', 'on_status_change', 'manual');

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

-- Slack integrations per project
CREATE TABLE IF NOT EXISTS public.slack_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  channel_name TEXT,
  notify_on_task_create BOOLEAN DEFAULT true,
  notify_on_task_assign BOOLEAN DEFAULT true,
  notify_on_task_complete BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- Update existing clients table to be project-scoped
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Update existing tasks table for multi-tenant and multi-assignee support
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to UUID[] DEFAULT '{}';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_clients_project ON public.clients(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks USING GIN(assigned_to);

-- RLS Policies for projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects they are members of"
  ON public.projects FOR SELECT
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = projects.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project owners can update projects"
  ON public.projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = projects.id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project owners can delete projects"
  ON public.projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = projects.id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- RLS Policies for project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their projects"
  ON public.project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Project admins can add members"
  ON public.project_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = project_members.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project admins can remove members"
  ON public.project_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Update RLS policies for clients (project-scoped)
DROP POLICY IF EXISTS "Users can view their clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their clients" ON public.clients;

CREATE POLICY "Users can view clients in their projects"
  ON public.clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = clients.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = clients.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Project members can update clients"
  ON public.clients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = clients.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Project admins can delete clients"
  ON public.clients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = clients.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Update RLS policies for tasks (project-scoped)
DROP POLICY IF EXISTS "Users can view their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their tasks" ON public.tasks;

CREATE POLICY "Users can view tasks in their projects"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = tasks.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = tasks.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Project members can update tasks"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = tasks.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Project admins can delete tasks"
  ON public.tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = tasks.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- RLS for workflows
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflows in their projects"
  ON public.workflows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = workflows.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project admins can manage workflows"
  ON public.workflows FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = workflows.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- RLS for workflow_steps
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow steps"
  ON public.workflow_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      JOIN public.project_members pm ON pm.project_id = w.project_id
      WHERE w.id = workflow_steps.workflow_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Project admins can manage workflow steps"
  ON public.workflow_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      JOIN public.project_members pm ON pm.project_id = w.project_id
      WHERE w.id = workflow_steps.workflow_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- RLS for slack_integrations
ALTER TABLE public.slack_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view slack integrations in their projects"
  ON public.slack_integrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = slack_integrations.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project admins can manage slack integrations"
  ON public.slack_integrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = slack_integrations.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to auto-create project owner membership
CREATE OR REPLACE FUNCTION create_project_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_add_project_owner
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION create_project_owner_membership();
