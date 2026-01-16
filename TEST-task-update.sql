-- =====================================================
-- TEST TASK UPDATE - Check if tasks can be updated
-- =====================================================

-- Your user ID
-- User: b5733666-7690-4b0a-a693-930d34bbeb58
-- Project: e8f4a29e-7967-4ad5-9ad0-271da779fa33

-- Step 1: Check if you have any tasks
SELECT
  'Current Tasks' as info,
  id,
  title,
  stage_id,
  status,
  project_id,
  created_by
FROM public.tasks
WHERE project_id = 'e8f4a29e-7967-4ad5-9ad0-271da779fa33'
ORDER BY created_at DESC
LIMIT 10;

-- Step 2: Check project_members to ensure you have access
SELECT
  'Your Project Membership' as info,
  id,
  project_id,
  user_id,
  role
FROM public.project_members
WHERE user_id = 'b5733666-7690-4b0a-a693-930d34bbeb58'
  AND project_id = 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';

-- Step 3: Try to create a test task (using service role)
DO $$
DECLARE
  v_project_id UUID := 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
  v_task_id UUID;
BEGIN
  -- Create a test task
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
    'Test Task - Moving Between Stages',
    'This is a test task to verify stage movement',
    'todo',
    'medium',
    'todo',
    v_user_id,
    1,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_task_id;

  RAISE NOTICE '✅ Created test task: %', v_task_id;

  -- Now try to update it to a different stage
  UPDATE public.tasks
  SET stage_id = 'in_progress',
      status = 'in_progress',
      updated_at = NOW(),
      updated_by = v_user_id
  WHERE id = v_task_id;

  RAISE NOTICE '✅ Updated task to in_progress stage';

  -- Show the updated task
  RAISE NOTICE '';
  RAISE NOTICE 'Test completed! Check if task was updated successfully.';
END $$;

-- Step 4: Show all tasks again to verify the update
SELECT
  'Tasks After Update' as info,
  id,
  title,
  stage_id,
  status,
  updated_at,
  updated_by
FROM public.tasks
WHERE project_id = 'e8f4a29e-7967-4ad5-9ad0-271da779fa33'
ORDER BY updated_at DESC
LIMIT 10;

-- Step 5: Check RLS policies on tasks table
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'RLS POLICIES ON TASKS TABLE';
  RAISE NOTICE '============================================================';
END $$;

SELECT
  'Tasks RLS Policies' as info,
  policyname,
  cmd as command,
  CASE
    WHEN length(qual) > 100 THEN substring(qual from 1 for 100) || '...'
    ELSE qual
  END as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tasks'
ORDER BY policyname;
