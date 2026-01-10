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
