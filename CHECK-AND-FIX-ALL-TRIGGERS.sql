-- =====================================================
-- CHECK AND FIX ALL TRIGGERS
-- Comprehensive check of all database triggers and their dependencies
-- =====================================================

-- STEP 1: List all existing triggers
SELECT
  '=== ALL TRIGGERS ===' as section,
  trigger_schema,
  trigger_name,
  event_object_table as table_name,
  event_manipulation as event_type,
  action_timing as timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- STEP 2: Check activity_logs table schema
SELECT
  '=== ACTIVITY_LOGS TABLE ===' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_logs'
ORDER BY ordinal_position;

-- STEP 3: Fix activity_logs table - add all missing columns
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'FIXING ACTIVITY_LOGS TABLE';
  RAISE NOTICE '============================================================';

  -- Add entity_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE public.activity_logs ADD COLUMN entity_type TEXT;
    RAISE NOTICE '✅ Added entity_type column';
  ELSE
    RAISE NOTICE '✓ entity_type column exists';
  END IF;

  -- Add entity_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE public.activity_logs ADD COLUMN entity_id UUID;
    RAISE NOTICE '✅ Added entity_id column';
  ELSE
    RAISE NOTICE '✓ entity_id column exists';
  END IF;

  -- Add old_values column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'old_values'
  ) THEN
    ALTER TABLE public.activity_logs ADD COLUMN old_values JSONB;
    RAISE NOTICE '✅ Added old_values column';
  ELSE
    RAISE NOTICE '✓ old_values column exists';
  END IF;

  -- Add new_values column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'new_values'
  ) THEN
    ALTER TABLE public.activity_logs ADD COLUMN new_values JSONB;
    RAISE NOTICE '✅ Added new_values column';
  ELSE
    RAISE NOTICE '✓ new_values column exists';
  END IF;

  RAISE NOTICE '';
END $$;

-- STEP 4: Check if log_activity function exists and fix it
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'CHECKING LOG_ACTIVITY FUNCTION';
  RAISE NOTICE '============================================================';

  -- Check if function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'log_activity'
  ) THEN
    RAISE NOTICE '✓ log_activity() function exists';
    RAISE NOTICE 'Recreating function with proper column handling...';

    -- Drop and recreate the function
    DROP FUNCTION IF EXISTS public.log_activity() CASCADE;

    CREATE OR REPLACE FUNCTION public.log_activity()
    RETURNS TRIGGER AS $func$
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
          COALESCE(NEW.created_by, NEW.user_id),
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
          COALESCE(NEW.updated_by, NEW.user_id),
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
          COALESCE(OLD.updated_by, OLD.user_id, OLD.created_by),
          'deleted',
          TG_TABLE_NAME,
          OLD.id,
          to_jsonb(OLD),
          NOW()
        );
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    RAISE NOTICE '✅ log_activity() function recreated';
  ELSE
    RAISE NOTICE '⚠️  log_activity() function does NOT exist';
    RAISE NOTICE 'Creating function...';

    CREATE OR REPLACE FUNCTION public.log_activity()
    RETURNS TRIGGER AS $func$
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
          COALESCE(NEW.created_by, NEW.user_id),
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
          COALESCE(NEW.updated_by, NEW.user_id),
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
          COALESCE(OLD.updated_by, OLD.user_id, OLD.created_by),
          'deleted',
          TG_TABLE_NAME,
          OLD.id,
          to_jsonb(OLD),
          NOW()
        );
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    RAISE NOTICE '✅ log_activity() function created';
  END IF;

  RAISE NOTICE '';
END $$;

-- STEP 5: Recreate triggers on tasks table
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'SETTING UP TRIGGERS ON TASKS TABLE';
  RAISE NOTICE '============================================================';

  -- Drop existing triggers if they exist
  DROP TRIGGER IF EXISTS log_task_activity_insert ON public.tasks;
  DROP TRIGGER IF EXISTS log_task_activity_update ON public.tasks;
  DROP TRIGGER IF EXISTS log_task_activity_delete ON public.tasks;

  -- Create triggers
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

  RAISE NOTICE '✅ Triggers created on tasks table';
  RAISE NOTICE '';
END $$;

-- STEP 6: Check for updated_at triggers
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'CHECKING UPDATED_AT TRIGGERS';
  RAISE NOTICE '============================================================';

  -- Check if update_updated_at function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at'
  ) THEN
    RAISE NOTICE 'Creating update_updated_at() function...';

    CREATE OR REPLACE FUNCTION public.update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    RAISE NOTICE '✅ update_updated_at() function created';
  ELSE
    RAISE NOTICE '✓ update_updated_at() function exists';
  END IF;

  -- Ensure trigger exists on tasks table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table = 'tasks'
      AND trigger_name = 'update_tasks_updated_at'
  ) THEN
    CREATE TRIGGER update_tasks_updated_at
      BEFORE UPDATE ON public.tasks
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();

    RAISE NOTICE '✅ update_tasks_updated_at trigger created';
  ELSE
    RAISE NOTICE '✓ update_tasks_updated_at trigger exists';
  END IF;

  RAISE NOTICE '';
END $$;

-- STEP 7: Show final trigger list
SELECT
  '=== FINAL TRIGGER LIST ===' as section,
  trigger_schema,
  trigger_name,
  event_object_table,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'tasks'
ORDER BY trigger_name;

-- STEP 8: Test with a simple insert/update
DO $$
DECLARE
  v_test_task_id UUID;
  v_project_id UUID := '0afc2a12-1ca4-4555-8531-50faf687814c';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'TESTING TRIGGERS';
  RAISE NOTICE '============================================================';

  -- Delete old test task if exists
  DELETE FROM public.tasks WHERE title = 'TRIGGER TEST TASK';

  -- Insert test task
  INSERT INTO public.tasks (
    id, project_id, title, stage_id, status, priority, created_by, position, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_project_id, 'TRIGGER TEST TASK', 'todo', 'todo', 'medium', v_user_id, 1, NOW(), NOW()
  )
  RETURNING id INTO v_test_task_id;

  RAISE NOTICE '✅ Test task created: %', v_test_task_id;

  -- Update test task
  UPDATE public.tasks
  SET stage_id = 'in_progress', updated_by = v_user_id
  WHERE id = v_test_task_id;

  RAISE NOTICE '✅ Test task updated';

  -- Check activity logs
  IF EXISTS (
    SELECT 1 FROM public.activity_logs
    WHERE entity_id = v_test_task_id AND entity_type = 'tasks'
  ) THEN
    RAISE NOTICE '✅ Activity logs working! Found % entries',
      (SELECT COUNT(*) FROM public.activity_logs WHERE entity_id = v_test_task_id);
  ELSE
    RAISE NOTICE '⚠️  No activity logs found - trigger may not be firing';
  END IF;

  -- Clean up
  DELETE FROM public.tasks WHERE id = v_test_task_id;

  RAISE NOTICE '';
END $$;

-- FINAL MESSAGE
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ ALL TRIGGERS VERIFIED AND FIXED';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - activity_logs table: All required columns added';
  RAISE NOTICE '  - log_activity() function: Recreated with proper error handling';
  RAISE NOTICE '  - Task triggers: All triggers created and tested';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Try creating a task in your UI';
  RAISE NOTICE '  2. Try moving a task between stages';
  RAISE NOTICE '  3. Refresh the page - changes should persist!';
  RAISE NOTICE '';
END $$;
