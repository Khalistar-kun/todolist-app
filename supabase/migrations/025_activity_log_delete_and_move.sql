-- Migration: Add activity logging for task deletions and stage moves
-- This adds the missing activity triggers for complete history tracking

-- =====================================================
-- 1. TRIGGER FOR TASK DELETION
-- =====================================================

-- Trigger function to log task deletion BEFORE the task is deleted
CREATE OR REPLACE FUNCTION log_task_deleted()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the deletion with task info before it's gone
  PERFORM log_activity(
    OLD.project_id,
    COALESCE(auth.uid(), OLD.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
    'task_deleted',
    OLD.id,
    OLD.title,
    NULL,
    NULL,
    NULL,
    jsonb_build_object(
      'priority', OLD.priority,
      'status', OLD.status,
      'stage_id', OLD.stage_id
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task deletion (BEFORE DELETE to capture data)
DROP TRIGGER IF EXISTS trigger_log_task_deleted ON tasks;
CREATE TRIGGER trigger_log_task_deleted
  BEFORE DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_deleted();

-- =====================================================
-- 2. TRIGGER FOR TASK STAGE MOVE
-- =====================================================

-- Trigger function to log task stage changes (moves between columns)
CREATE OR REPLACE FUNCTION log_task_moved()
RETURNS TRIGGER AS $$
DECLARE
  v_old_stage_name TEXT;
  v_new_stage_name TEXT;
  v_project RECORD;
BEGIN
  -- Only trigger if stage_id actually changed
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    -- Get project and stage names
    SELECT
      workflow_stages INTO v_project
    FROM projects
    WHERE id = NEW.project_id;

    -- Find stage names from workflow_stages JSONB array
    IF v_project.workflow_stages IS NOT NULL THEN
      SELECT name INTO v_old_stage_name
      FROM jsonb_to_recordset(v_project.workflow_stages) AS x(id TEXT, name TEXT)
      WHERE x.id = OLD.stage_id::TEXT;

      SELECT name INTO v_new_stage_name
      FROM jsonb_to_recordset(v_project.workflow_stages) AS x(id TEXT, name TEXT)
      WHERE x.id = NEW.stage_id::TEXT;
    END IF;

    -- Log the move
    PERFORM log_activity(
      NEW.project_id,
      COALESCE(NEW.updated_by, auth.uid(), NEW.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
      'task_moved',
      NEW.id,
      NEW.title,
      NULL,
      NULL,
      NULL,
      jsonb_build_object(
        'old_stage_id', OLD.stage_id,
        'new_stage_id', NEW.stage_id,
        'old_stage_name', COALESCE(v_old_stage_name, 'Unknown'),
        'new_stage_name', COALESCE(v_new_stage_name, 'Unknown')
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task moves
DROP TRIGGER IF EXISTS trigger_log_task_moved ON tasks;
CREATE TRIGGER trigger_log_task_moved
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
  EXECUTE FUNCTION log_task_moved();

-- =====================================================
-- 3. TRIGGER FOR TASK UPDATES (title, description, priority, due_date)
-- =====================================================

CREATE OR REPLACE FUNCTION log_task_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_changes JSONB := '{}';
BEGIN
  -- Track what changed
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title));
  END IF;

  IF OLD.description IS DISTINCT FROM NEW.description THEN
    v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('old', LEFT(OLD.description, 50), 'new', LEFT(NEW.description, 50)));
  END IF;

  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    v_changes := v_changes || jsonb_build_object('priority', jsonb_build_object('old', OLD.priority, 'new', NEW.priority));
  END IF;

  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    v_changes := v_changes || jsonb_build_object('due_date', jsonb_build_object('old', OLD.due_date, 'new', NEW.due_date));
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
  END IF;

  -- Only log if there were actual content changes (not just stage_id which is handled separately)
  -- and not just updated_at/updated_by changes
  IF v_changes != '{}' THEN
    PERFORM log_activity(
      NEW.project_id,
      COALESCE(NEW.updated_by, auth.uid(), NEW.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
      'task_updated',
      NEW.id,
      NEW.title,
      NULL,
      NULL,
      NULL,
      v_changes
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task updates (excluding stage moves which are handled separately)
DROP TRIGGER IF EXISTS trigger_log_task_updated ON tasks;
CREATE TRIGGER trigger_log_task_updated
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.priority IS DISTINCT FROM NEW.priority OR
    OLD.due_date IS DISTINCT FROM NEW.due_date OR
    OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION log_task_updated();

-- =====================================================
-- 4. FIX COMMENT TRIGGER (ensure it uses correct column)
-- =====================================================

-- Check if comments table uses 'created_by' or 'user_id'
CREATE OR REPLACE FUNCTION log_comment_added()
RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
  v_actor_id UUID;
BEGIN
  -- Get task info
  SELECT id, title, project_id INTO v_task
  FROM tasks WHERE id = NEW.task_id;

  -- Handle both possible column names for the comment author
  v_actor_id := COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::UUID);

  IF v_task IS NOT NULL THEN
    PERFORM log_activity(
      v_task.project_id,
      v_actor_id,
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

-- Recreate the comment trigger
DROP TRIGGER IF EXISTS trigger_log_comment_added ON comments;
CREATE TRIGGER trigger_log_comment_added
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION log_comment_added();

-- =====================================================
-- 5. GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION log_task_deleted() TO authenticated;
GRANT EXECUTE ON FUNCTION log_task_moved() TO authenticated;
GRANT EXECUTE ON FUNCTION log_task_updated() TO authenticated;
GRANT EXECUTE ON FUNCTION log_comment_added() TO authenticated;

-- =====================================================
-- DONE! Activity types now tracked:
-- - task_created (existing)
-- - task_deleted (NEW)
-- - task_moved (NEW)
-- - task_updated (NEW)
-- - task_assigned (existing)
-- - comment_added (fixed)
-- - approval_requested (existing)
-- - approval_approved (existing)
-- - approval_rejected (existing)
-- =====================================================
