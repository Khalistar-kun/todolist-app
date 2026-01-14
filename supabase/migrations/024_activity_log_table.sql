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
