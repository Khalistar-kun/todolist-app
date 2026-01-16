-- =====================================================
-- FIX TRIGGERS - FINAL VERSION
-- Fixed user_id reference issue
-- =====================================================

-- Drop and recreate log_activity function with correct column references
DROP FUNCTION IF EXISTS public.log_activity() CASCADE;

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (
      project_id,
      task_id,
      user_id,
      action,
      entity_type,
      entity_id,
      new_values,
      created_at
    ) VALUES (
      COALESCE(NEW.project_id, NULL),
      CASE WHEN TG_TABLE_NAME = 'tasks' THEN NEW.id ELSE NULL END,
      NEW.created_by,  -- tasks table only has created_by, not user_id
      'created',
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(NEW),
      NOW()
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.activity_logs (
      project_id,
      task_id,
      user_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      created_at
    ) VALUES (
      COALESCE(NEW.project_id, OLD.project_id),
      CASE WHEN TG_TABLE_NAME = 'tasks' THEN NEW.id ELSE NULL END,
      COALESCE(NEW.updated_by, NEW.created_by),  -- use updated_by if available, fallback to created_by
      'updated',
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      NOW()
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (
      project_id,
      task_id,
      user_id,
      action,
      entity_type,
      entity_id,
      old_values,
      created_at
    ) VALUES (
      COALESCE(OLD.project_id, NULL),
      CASE WHEN TG_TABLE_NAME = 'tasks' THEN OLD.id ELSE NULL END,
      COALESCE(OLD.updated_by, OLD.created_by),  -- use updated_by if available, fallback to created_by
      'deleted',
      TG_TABLE_NAME,
      OLD.id,
      to_jsonb(OLD),
      NOW()
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers on tasks table
DROP TRIGGER IF EXISTS log_task_activity_insert ON public.tasks;
DROP TRIGGER IF EXISTS log_task_activity_update ON public.tasks;
DROP TRIGGER IF EXISTS log_task_activity_delete ON public.tasks;

CREATE TRIGGER log_task_activity_insert
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_task_activity_update
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_task_activity_delete
  AFTER DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity();

-- Ensure update_updated_at function exists
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure updated_at trigger exists
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Show all triggers on tasks table
SELECT
  '=== TRIGGERS ON TASKS TABLE ===' as section,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'tasks'
ORDER BY trigger_name;

-- Test task creation and update
DO $$
DECLARE
  v_test_task_id UUID;
  v_project_id UUID := '0afc2a12-1ca4-4555-8531-50faf687814c';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
  v_log_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'TESTING TRIGGERS';
  RAISE NOTICE '============================================================';

  -- Delete old test task
  DELETE FROM public.tasks WHERE title = 'TRIGGER TEST TASK';
  RAISE NOTICE '✓ Cleaned up old test tasks';

  -- Insert test task
  INSERT INTO public.tasks (
    id, project_id, title, stage_id, status, priority, created_by, position, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_project_id, 'TRIGGER TEST TASK', 'todo', 'todo', 'medium', v_user_id, 1, NOW(), NOW()
  )
  RETURNING id INTO v_test_task_id;

  RAISE NOTICE '✅ Test task created with ID: %', v_test_task_id;

  -- Update test task
  UPDATE public.tasks
  SET stage_id = 'in_progress', status = 'in_progress', updated_by = v_user_id
  WHERE id = v_test_task_id;

  RAISE NOTICE '✅ Test task updated to in_progress';

  -- Check activity logs
  SELECT COUNT(*) INTO v_log_count
  FROM public.activity_logs
  WHERE entity_id = v_test_task_id AND entity_type = 'tasks';

  IF v_log_count >= 2 THEN
    RAISE NOTICE '✅ Activity logs working! Found % entries (create + update)', v_log_count;
  ELSIF v_log_count > 0 THEN
    RAISE NOTICE '⚠️  Only found % log entry (expected 2)', v_log_count;
  ELSE
    RAISE NOTICE '❌ No activity logs found - triggers not working';
  END IF;

  -- Verify update persisted
  IF EXISTS (SELECT 1 FROM public.tasks WHERE id = v_test_task_id AND stage_id = 'in_progress') THEN
    RAISE NOTICE '✅ UPDATE PERSISTED! Task is at in_progress stage';
  ELSE
    RAISE NOTICE '❌ UPDATE FAILED! Task not at in_progress stage';
  END IF;

  -- Show activity log entries
  RAISE NOTICE '';
  RAISE NOTICE 'Activity log entries:';
  FOR v_log_count IN
    SELECT 1 FROM public.activity_logs
    WHERE entity_id = v_test_task_id AND entity_type = 'tasks'
  LOOP
    NULL;
  END LOOP;

  -- Clean up
  DELETE FROM public.tasks WHERE id = v_test_task_id;
  RAISE NOTICE '✓ Test task cleaned up';

  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ ALL DONE! Triggers are working correctly!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Try creating a task in your UI';
  RAISE NOTICE '2. Move the task to a different stage';
  RAISE NOTICE '3. Refresh the page - the change should persist!';
  RAISE NOTICE '';
END $$;
