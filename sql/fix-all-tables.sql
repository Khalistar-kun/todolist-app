-- ============================================
-- COMPLETE FIX FOR ALL TABLES
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. FIX TASKS TABLE - Add all missing columns
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS stage_id TEXT DEFAULT 'todo';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Update status column to TEXT if it's an enum (safer approach)
DO $$
BEGIN
  -- Check if priority column exists, add if not
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'priority') THEN
    ALTER TABLE public.tasks ADD COLUMN priority TEXT DEFAULT 'medium';
  END IF;
END $$;

-- Create indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_stage_id ON public.tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);

-- 2. FIX COMMENTS TABLE - Add missing columns
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}';
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. FIX SUBTASKS TABLE - Add missing columns
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create trigger for subtasks updated_at
DROP TRIGGER IF EXISTS update_subtasks_updated_at ON public.subtasks;
CREATE TRIGGER update_subtasks_updated_at
  BEFORE UPDATE ON public.subtasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. FIX TIME_ENTRIES TABLE - Add missing columns
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS hours NUMERIC;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Copy duration_minutes to duration if duration is null
UPDATE public.time_entries SET duration = duration_minutes WHERE duration IS NULL AND duration_minutes IS NOT NULL;

-- 5. FIX TASK_ASSIGNMENTS TABLE - Add missing columns
ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id);

-- 6. FIX ATTACHMENTS TABLE - Ensure all columns exist
ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;
ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Update existing rows to have file_name if filename exists
UPDATE public.attachments SET file_name = filename WHERE file_name IS NULL AND filename IS NOT NULL;
UPDATE public.attachments SET file_type = mime_type WHERE file_type IS NULL AND mime_type IS NOT NULL;

-- 7. FIX PROFILES TABLE - Ensure all columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- 8. FIX PROJECTS TABLE - Ensure all columns exist
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS workflow_stages JSONB DEFAULT '[{"id": "todo", "name": "To Do", "color": "#6B7280"}, {"id": "in_progress", "name": "In Progress", "color": "#3B82F6"}, {"id": "review", "name": "Review", "color": "#F59E0B"}, {"id": "done", "name": "Done", "color": "#10B981"}]';

-- 9. CREATE NOTIFICATIONS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- 10. CREATE ACTIVITY_LOGS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view activity in their projects" ON public.activity_logs;
CREATE POLICY "Users can view activity in their projects" ON public.activity_logs
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
  );

-- 11. Update function for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_comments_task_id ON public.comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_project_id ON public.comments(project_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON public.subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON public.time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON public.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user_id ON public.task_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON public.activity_logs(project_id);

-- 13. ADDITIONAL RLS POLICIES FOR FULL FUNCTIONALITY

-- Comments: Allow project members to create comments
DROP POLICY IF EXISTS "Project members can create comments" ON public.comments;
CREATE POLICY "Project members can create comments" ON public.comments
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
    )
  );

-- Comments: Allow users to delete their own comments
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE USING (created_by = auth.uid());

-- Subtasks: Allow project members to delete subtasks
DROP POLICY IF EXISTS "Project members can delete subtasks" ON public.subtasks;
CREATE POLICY "Project members can delete subtasks" ON public.subtasks
  FOR DELETE USING (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
    )
  );

-- Subtasks: Allow project members to update subtasks
DROP POLICY IF EXISTS "Project members can update subtasks" ON public.subtasks;
CREATE POLICY "Project members can update subtasks" ON public.subtasks
  FOR UPDATE USING (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
    )
  );

-- Subtasks: Allow project members to create subtasks
DROP POLICY IF EXISTS "Project members can create subtasks" ON public.subtasks;
CREATE POLICY "Project members can create subtasks" ON public.subtasks
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
    )
  );

-- Time entries: Allow users to update their own time entries
DROP POLICY IF EXISTS "Users can update own time entries" ON public.time_entries;
CREATE POLICY "Users can update own time entries" ON public.time_entries
  FOR UPDATE USING (user_id = auth.uid());

-- Time entries: Allow users to delete their own time entries
DROP POLICY IF EXISTS "Users can delete own time entries" ON public.time_entries;
CREATE POLICY "Users can delete own time entries" ON public.time_entries
  FOR DELETE USING (user_id = auth.uid());

-- Task assignments: Allow project members to delete assignments
DROP POLICY IF EXISTS "Project members can delete assignments" ON public.task_assignments;
CREATE POLICY "Project members can delete assignments" ON public.task_assignments
  FOR DELETE USING (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
    )
  );

-- Task assignments: Allow project members to update assignments
DROP POLICY IF EXISTS "Project members can update assignments" ON public.task_assignments;
CREATE POLICY "Project members can update assignments" ON public.task_assignments
  FOR UPDATE USING (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
    )
  );

-- Attachments: Allow users to delete their own attachments
DROP POLICY IF EXISTS "Users can delete own attachments" ON public.attachments;
CREATE POLICY "Users can delete own attachments" ON public.attachments
  FOR DELETE USING (uploaded_by = auth.uid());

-- 14. PASSWORD RESET PINS TABLE
CREATE TABLE IF NOT EXISTS public.password_reset_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  pin TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_pins_email ON public.password_reset_pins(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_pins_expires ON public.password_reset_pins(expires_at);

-- No RLS for this table - only accessed via service role
ALTER TABLE public.password_reset_pins ENABLE ROW LEVEL SECURITY;

-- 15. USER PREFERENCES TABLE (for settings persistence)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  theme TEXT DEFAULT 'system',
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT true,
  task_reminders BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (user_id = auth.uid());

-- 16. Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Done!
SELECT 'All tables and columns have been fixed!' as status;
