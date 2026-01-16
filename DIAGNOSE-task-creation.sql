-- =====================================================
-- DIAGNOSE TASK CREATION ISSUE
-- Check if triggers are properly set up
-- =====================================================

-- STEP 1: Check if log_activity function exists
SELECT
  '=== LOG_ACTIVITY FUNCTION ===' as section,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'log_activity';

-- STEP 2: Check all triggers on tasks table
SELECT
  '=== TASKS TABLE TRIGGERS ===' as section,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'tasks'
ORDER BY trigger_name;

-- STEP 3: Check activity_logs table columns
SELECT
  '=== ACTIVITY_LOGS COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_logs'
ORDER BY ordinal_position;

-- STEP 4: Test task creation WITHOUT trigger (disable temporarily)
DO $$
DECLARE
  v_test_task_id UUID;
  v_project_id UUID := '0afc2a12-1ca4-4555-8531-50faf687814c';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'TESTING TASK CREATION';
  RAISE NOTICE '============================================================';

  -- Temporarily disable triggers
  ALTER TABLE public.tasks DISABLE TRIGGER log_task_activity_insert;
  RAISE NOTICE '✓ Disabled INSERT trigger';

  -- Clean up old test tasks
  DELETE FROM public.tasks WHERE title = 'DIAGNOSE TEST TASK';

  -- Try to insert a task
  BEGIN
    INSERT INTO public.tasks (
      id, project_id, title, stage_id, status, priority, created_by, position, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_project_id, 'DIAGNOSE TEST TASK', 'todo', 'todo', 'medium', v_user_id, 1, NOW(), NOW()
    )
    RETURNING id INTO v_test_task_id;

    RAISE NOTICE '✅ Task created successfully WITHOUT trigger: %', v_test_task_id;

    -- Clean up
    DELETE FROM public.tasks WHERE id = v_test_task_id;
    RAISE NOTICE '✓ Test task cleaned up';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ Failed to create task even WITHOUT trigger!';
      RAISE NOTICE 'Error: %', SQLERRM;
  END;

  -- Re-enable trigger
  ALTER TABLE public.tasks ENABLE TRIGGER log_task_activity_insert;
  RAISE NOTICE '✓ Re-enabled INSERT trigger';

  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'NOW TESTING WITH TRIGGER ENABLED';
  RAISE NOTICE '============================================================';

  -- Now try WITH trigger enabled
  BEGIN
    INSERT INTO public.tasks (
      id, project_id, title, stage_id, status, priority, created_by, position, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_project_id, 'DIAGNOSE TEST TASK', 'todo', 'todo', 'medium', v_user_id, 1, NOW(), NOW()
    )
    RETURNING id INTO v_test_task_id;

    RAISE NOTICE '✅ Task created successfully WITH trigger: %', v_test_task_id;

    -- Check if activity log was created
    IF EXISTS (SELECT 1 FROM public.activity_logs WHERE entity_id = v_test_task_id) THEN
      RAISE NOTICE '✅ Activity log created successfully';
    ELSE
      RAISE NOTICE '⚠️  No activity log found (trigger may not have fired)';
    END IF;

    -- Clean up
    DELETE FROM public.tasks WHERE id = v_test_task_id;
    RAISE NOTICE '✓ Test task cleaned up';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ Failed to create task WITH trigger!';
      RAISE NOTICE 'Error: %', SQLERRM;
      RAISE NOTICE 'Detail: %', SQLSTATE;
  END;

  RAISE NOTICE '';
END $$;
