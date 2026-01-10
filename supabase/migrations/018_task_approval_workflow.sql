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
