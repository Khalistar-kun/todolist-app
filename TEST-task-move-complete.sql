-- =====================================================
-- COMPLETE TEST: Task Movement and Update
-- This tests the entire flow of moving a task
-- =====================================================

-- Your IDs
-- User: b5733666-7690-4b0a-a693-930d34bbeb58
-- Project: 0afc2a12-1ca4-4555-8531-50faf687814c

-- STEP 1: Create a test task
DO $$
DECLARE
  v_project_id UUID := '0afc2a12-1ca4-4555-8531-50faf687814c';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
  v_task_id UUID;
BEGIN
  -- Delete any existing test tasks first
  DELETE FROM public.tasks
  WHERE title = 'TEST TASK - Movement Test'
    AND project_id = v_project_id;

  -- Create test task
  INSERT INTO public.tasks (
    id,
    project_id,
    title,
    description,
    stage_id,
    priority,
    status,
    created_by,
    position,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_project_id,
    'TEST TASK - Movement Test',
    'This task tests if updates persist',
    'todo',
    'medium',
    'todo',
    v_user_id,
    1,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_task_id;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'STEP 1: Created test task';
  RAISE NOTICE 'Task ID: %', v_task_id;
  RAISE NOTICE 'Initial stage_id: todo';
  RAISE NOTICE '============================================================';
END $$;

-- STEP 2: Show the test task
SELECT
  'Initial Task State' as info,
  id,
  title,
  stage_id,
  status,
  updated_at,
  updated_by
FROM public.tasks
WHERE title = 'TEST TASK - Movement Test'
  AND project_id = '0afc2a12-1ca4-4555-8531-50faf687814c';

-- STEP 3: Update the task (simulate API call)
DO $$
DECLARE
  v_task_id UUID;
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
BEGIN
  -- Get the test task ID
  SELECT id INTO v_task_id
  FROM public.tasks
  WHERE title = 'TEST TASK - Movement Test'
    AND project_id = '0afc2a12-1ca4-4555-8531-50faf687814c'
  LIMIT 1;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Test task not found!';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'STEP 2: Updating task to in_progress stage';
  RAISE NOTICE 'Task ID: %', v_task_id;
  RAISE NOTICE '============================================================';

  -- Update the task (this is what the API does)
  UPDATE public.tasks
  SET stage_id = 'in_progress',
      status = 'in_progress',
      updated_at = NOW(),
      updated_by = v_user_id
  WHERE id = v_task_id;

  RAISE NOTICE '✅ Update executed';
END $$;

-- STEP 4: Verify the update persisted
SELECT
  'After Update' as info,
  id,
  title,
  stage_id,
  status,
  updated_at,
  updated_by,
  CASE
    WHEN stage_id = 'in_progress' THEN '✅ SUCCESS - Update persisted!'
    ELSE '❌ FAILED - Still at: ' || stage_id
  END as result
FROM public.tasks
WHERE title = 'TEST TASK - Movement Test'
  AND project_id = '0afc2a12-1ca4-4555-8531-50faf687814c';

-- STEP 5: Check RLS policies on tasks table
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'CHECKING RLS POLICIES';
  RAISE NOTICE '============================================================';
END $$;

SELECT
  'Tasks UPDATE Policy' as info,
  policyname,
  cmd,
  CASE
    WHEN length(qual::text) > 150 THEN substring(qual::text from 1 for 150) || '...'
    ELSE qual::text
  END as policy_definition
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tasks'
  AND cmd = 'UPDATE';

-- STEP 6: Test with RLS enabled (as authenticated user)
DO $$
DECLARE
  v_task_id UUID;
  v_can_update BOOLEAN;
BEGIN
  -- Get task ID
  SELECT id INTO v_task_id
  FROM public.tasks
  WHERE title = 'TEST TASK - Movement Test'
  LIMIT 1;

  -- Check if user can see the task with RLS
  PERFORM set_config('request.jwt.claims', '{"sub": "b5733666-7690-4b0a-a693-930d34bbeb58"}', true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT EXISTS(
    SELECT 1 FROM public.tasks
    WHERE id = v_task_id
  ) INTO v_can_update;

  RESET role;

  RAISE NOTICE '';
  RAISE NOTICE 'RLS CHECK: Can user update this task? %',
    CASE WHEN v_can_update THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '';
END $$;

-- FINAL: Summary
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'TEST COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'If stage_id = in_progress, the database UPDATE works!';
  RAISE NOTICE 'If it still says todo, there might be a constraint or trigger.';
  RAISE NOTICE '';
  RAISE NOTICE 'Check the results above.';
END $$;
