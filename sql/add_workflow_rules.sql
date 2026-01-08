-- Workflow Rules table for automation
CREATE TABLE IF NOT EXISTS public.workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  trigger TEXT NOT NULL, -- 'task_created', 'task_updated', 'status_changed', etc.
  conditions JSONB DEFAULT '[]'::jsonb, -- Array of condition objects
  actions JSONB DEFAULT '[]'::jsonb, -- Array of action objects
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Workflow Executions table for tracking
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_rule_id UUID NOT NULL REFERENCES public.workflow_rules(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  executed_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  actions_executed INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_rules_project ON public.workflow_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_enabled ON public.workflow_rules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_workflow_executions_rule ON public.workflow_executions(workflow_rule_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_task ON public.workflow_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_date ON public.workflow_executions(executed_at);

-- RLS policies for workflow_rules
ALTER TABLE public.workflow_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow rules in their projects"
  ON public.workflow_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = workflow_rules.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project admins can create workflow rules"
  ON public.workflow_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = workflow_rules.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project admins can update workflow rules"
  ON public.workflow_rules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = workflow_rules.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project admins can delete workflow rules"
  ON public.workflow_rules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = workflow_rules.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- RLS policies for workflow_executions
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow executions in their projects"
  ON public.workflow_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_rules wr
      JOIN public.project_members pm ON pm.project_id = wr.project_id
      WHERE wr.id = workflow_executions.workflow_rule_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert workflow executions"
  ON public.workflow_executions FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_workflow_rules_updated_at
  BEFORE UPDATE ON public.workflow_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE public.workflow_rules IS 'Automated workflow rules that trigger actions based on task events';
COMMENT ON TABLE public.workflow_executions IS 'Execution log for workflow rules';
COMMENT ON COLUMN public.workflow_rules.conditions IS 'Array of condition objects that must all pass for workflow to execute';
COMMENT ON COLUMN public.workflow_rules.actions IS 'Array of action objects to execute when conditions pass';
