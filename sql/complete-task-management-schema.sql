-- Complete task management system schema additions
-- This extends the existing multi-tenant schema

-- Additional task fields for better task management
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

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
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}' -- Additional data for the notification
);

-- Activity logs for audit trail
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'assigned', 'completed', etc.
  entity_type TEXT NOT NULL, -- 'task', 'project', 'comment', etc.
  entity_id UUID NOT NULL,
  details JSONB DEFAULT '{}',
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC',
  working_hours_start TIME DEFAULT '09:00:00',
  working_hours_end TIME DEFAULT '17:00:00',
  working_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- Monday=1, Sunday=7
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Project templates
CREATE TABLE IF NOT EXISTS public.project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_data JSONB NOT NULL, -- Contains project structure, sample tasks, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Task templates
CREATE TABLE IF NOT EXISTS public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  checklist JSONB DEFAULT '[]', -- Array of checklist items
  default_priority VARCHAR(20) DEFAULT 'medium',
  default_tags TEXT[] DEFAULT '{}',
  estimated_hours NUMERIC,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Recurring tasks
CREATE TABLE IF NOT EXISTS public.recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  recurrence_rule TEXT NOT NULL, -- Cron expression for recurrence
  next_due_at TIMESTAMPTZ NOT NULL,
  last_completed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Time tracking
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT,
  hours NUMERIC NOT NULL CHECK (hours > 0),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Webhooks for external integrations
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}', -- Array of events to trigger on
  secret_key VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enhanced user profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_comments_task ON public.comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_by ON public.comments(created_by);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON public.attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_project ON public.attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON public.activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task ON public.activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON public.time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_position ON public.tasks(project_id, status, position);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_next_due ON public.recurring_tasks(next_due_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen_at);

-- RLS Policies for new tables

-- Comments RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments in their projects"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = comments.task_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = comments.task_id AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Comment creators can update comments"
  ON public.comments FOR UPDATE
  USING (created_by = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "Comment creators can delete comments"
  ON public.comments FOR DELETE
  USING (created_by = auth.uid());

-- Attachments RLS
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in their projects"
  ON public.attachments FOR SELECT
  USING (
    project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = attachments.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can upload attachments"
  ON public.attachments FOR INSERT
  WITH CHECK (
    project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = attachments.project_id AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  );

-- Notifications RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR ALL
  USING (user_id = auth.uid());

-- Activity Logs RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity logs in their projects"
  ON public.activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = activity_logs.project_id AND user_id = auth.uid()
    )
  );

-- User Preferences RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own preferences"
  ON public.user_preferences FOR ALL
  USING (user_id = auth.uid());

-- Project Templates RLS
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public templates or their own"
  ON public.project_templates FOR SELECT
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can create their own templates"
  ON public.project_templates FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Template creators can update their templates"
  ON public.project_templates FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Template creators can delete their templates"
  ON public.project_templates FOR DELETE
  USING (created_by = auth.uid());

-- Task Templates RLS
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can manage task templates"
  ON public.task_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = task_templates.project_id AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  );

-- Recurring Tasks RLS
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can manage recurring tasks"
  ON public.recurring_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = recurring_tasks.project_id AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  );

-- Time Entries RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own time entries"
  ON public.time_entries FOR ALL
  USING (user_id = auth.uid());

-- Webhooks RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project admins can manage webhooks"
  ON public.webhooks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = webhooks.project_id AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Triggers for new tables
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_project_templates_updated_at
  BEFORE UPDATE ON public.project_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_task_templates_updated_at
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_recurring_tasks_updated_at
  BEFORE UPDATE ON public.recurring_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Function to log activity automatically
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Determine the action based on the operation
  DECLARE
    action TEXT;
    entity_type TEXT := TG_TABLE_NAME;
  BEGIN
    IF TG_OP = 'INSERT' THEN
      action := 'created';
      INSERT INTO public.activity_logs (project_id, task_id, user_id, action, entity_type, entity_id, new_values)
      VALUES (
        COALESCE(NEW.project_id, (SELECT project_id FROM public.tasks WHERE id = NEW.task_id)),
        NEW.task_id,
        auth.uid(),
        action,
        entity_type,
        NEW.id,
        row_to_json(NEW)
      );
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
      action := 'updated';
      INSERT INTO public.activity_logs (project_id, task_id, user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (
        COALESCE(NEW.project_id, OLD.project_id, (SELECT project_id FROM public.tasks WHERE id = COALESCE(NEW.task_id, OLD.task_id))),
        COALESCE(NEW.task_id, OLD.task_id),
        auth.uid(),
        action,
        entity_type,
        NEW.id,
        row_to_json(OLD),
        row_to_json(NEW)
      );
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      action := 'deleted';
      INSERT INTO public.activity_logs (project_id, task_id, user_id, action, entity_type, entity_id, old_values)
      VALUES (
        COALESCE(OLD.project_id, (SELECT project_id FROM public.tasks WHERE id = OLD.task_id)),
        OLD.task_id,
        auth.uid(),
        action,
        entity_type,
        OLD.id,
        row_to_json(OLD)
      );
      RETURN OLD;
    END IF;
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql;

-- Apply activity logging triggers to key tables
CREATE TRIGGER log_tasks_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER log_comments_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER log_attachments_activity
  AFTER INSERT OR DELETE ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION log_activity();

-- Function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_project_id UUID DEFAULT NULL,
  p_task_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, project_id, task_id, comment_id, type, title, message, metadata)
  VALUES (p_user_id, p_project_id, p_task_id, p_comment_id, p_type, p_title, p_message, p_metadata)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update user online status
CREATE OR REPLACE FUNCTION update_user_online_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen_at = now(), is_online = true
  WHERE id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_seen when user makes any request
-- This would be called from middleware or authenticated API routes

-- Function to clean up old activity logs (optional cleanup job)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.activity_logs
  WHERE created_at < now() - interval '1 day' * days_to_keep;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;