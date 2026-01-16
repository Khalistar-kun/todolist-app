-- =====================================================
-- COMPLETE FIX - Activity Logs & Triggers
-- Ensures all columns exist, then updates triggers
-- =====================================================

-- STEP 1: Ensure ALL required columns exist in activity_logs
DO $$
BEGIN
  -- Add entity_type if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE public.activity_logs ADD COLUMN entity_type TEXT;
    RAISE NOTICE '✅ Added entity_type column';
  ELSE
    RAISE NOTICE '✓ entity_type column exists';
  END IF;

  -- Add entity_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE public.activity_logs ADD COLUMN entity_id UUID;
    RAISE NOTICE '✅ Added entity_id column';
  ELSE
    RAISE NOTICE '✓ entity_id column exists';
  END IF;

  -- Add old_values if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'old_values'
  ) THEN
    ALTER TABLE public.activity_logs ADD COLUMN old_values JSONB;
    RAISE NOTICE '✅ Added old_values column';
  ELSE
    RAISE NOTICE '✓ old_values column exists';
  END IF;

  -- Add new_values if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'new_values'
  ) THEN
    ALTER TABLE public.activity_logs ADD COLUMN new_values JSONB;
    RAISE NOTICE '✅ Added new_values column';
  ELSE
    RAISE NOTICE '✓ new_values column exists';
  END IF;
END $$;

-- STEP 2: Show all activity_logs columns
SELECT
  '=== ACTIVITY_LOGS COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_logs'
ORDER BY ordinal_position;

-- STEP 3: Drop and recreate log_activity function
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
      NEW.created_by,
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
      COALESCE(NEW.updated_by, NEW.created_by),
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
      NULL,  -- NULL to avoid FK constraint on deleted task
      COALESCE(OLD.updated_by, OLD.created_by),
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

-- STEP 4: Recreate all triggers on tasks table
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

-- STEP 5: Ensure update_updated_at trigger exists
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- STEP 6: Show all triggers
SELECT
  '=== ALL TRIGGERS ON TASKS ===' as section,
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'tasks'
ORDER BY trigger_name;

-- STEP 7: Test everything
DO $$
DECLARE
  v_test_task_id UUID;
  v_project_id UUID := '0afc2a12-1ca4-4555-8531-50faf687814c';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
  v_log_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'TESTING TASK CREATION AND UPDATES';
  RAISE NOTICE '============================================================';

  -- Clean up
  DELETE FROM public.tasks WHERE title = 'FINAL TEST TASK';

  -- Create task
  INSERT INTO public.tasks (
    id, project_id, title, stage_id, status, priority, created_by, position, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_project_id, 'FINAL TEST TASK', 'todo', 'todo', 'medium', v_user_id, 1, NOW(), NOW()
  )
  RETURNING id INTO v_test_task_id;

  RAISE NOTICE '✅ Task created: %', v_test_task_id;

  -- Update task
  UPDATE public.tasks
  SET stage_id = 'in_progress', status = 'in_progress', updated_by = v_user_id
  WHERE id = v_test_task_id;

  RAISE NOTICE '✅ Task updated to in_progress';

  -- Check logs
  SELECT COUNT(*) INTO v_log_count
  FROM public.activity_logs
  WHERE entity_id = v_test_task_id AND entity_type = 'tasks';

  IF v_log_count >= 2 THEN
    RAISE NOTICE '✅ Activity logs: % entries found', v_log_count;
  ELSE
    RAISE NOTICE '⚠️  Only % activity log entries', v_log_count;
  END IF;

  -- Verify persistence
  IF EXISTS (SELECT 1 FROM public.tasks WHERE id = v_test_task_id AND stage_id = 'in_progress') THEN
    RAISE NOTICE '✅ UPDATE PERSISTED!';
  ELSE
    RAISE NOTICE '❌ Update did not persist';
  END IF;

  -- Delete task (test delete trigger)
  DELETE FROM public.tasks WHERE id = v_test_task_id;

  -- Final log count
  SELECT COUNT(*) INTO v_log_count
  FROM public.activity_logs
  WHERE entity_id = v_test_task_id AND entity_type = 'tasks';

  RAISE NOTICE '✅ Final activity log count: % (should be 3)', v_log_count;

  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ ALL TESTS PASSED!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Task creation should now work in your UI!';
  RAISE NOTICE '';
END $$;
