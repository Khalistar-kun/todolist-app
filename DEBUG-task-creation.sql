-- =====================================================
-- DEBUG TASK CREATION - Find why task creation fails
-- =====================================================

-- Check 1: Does the project have workflow_stages?
SELECT
  'Project Workflow Check' as info,
  id,
  name,
  workflow_stages,
  CASE
    WHEN workflow_stages IS NULL THEN 'ERROR: NULL workflow_stages'
    WHEN jsonb_array_length(workflow_stages) = 0 THEN 'ERROR: Empty workflow_stages'
    ELSE 'OK: ' || jsonb_array_length(workflow_stages)::text || ' stages'
  END as status
FROM public.projects
WHERE id = '0afc2a12-1ca4-4555-8531-50faf687814c';

-- Check 2: Are you a member of this project?
SELECT
  'Membership Check' as info,
  pm.id,
  pm.user_id,
  pm.role,
  CASE
    WHEN pm.role IN ('owner', 'admin', 'member') THEN 'OK'
    ELSE 'ERROR: Invalid role - ' || pm.role
  END as status
FROM public.project_members pm
WHERE pm.project_id = '0afc2a12-1ca4-4555-8531-50faf687814c'
  AND pm.user_id = 'b5733666-7690-4b0a-a693-930d34bbeb58';

-- Check 3: What stages are defined in the project?
SELECT
  'Project Stages' as info,
  jsonb_array_elements(workflow_stages) as stage
FROM public.projects
WHERE id = '0afc2a12-1ca4-4555-8531-50faf687814c';

-- Check 4: Try to create a task manually to see what fails
DO $$
DECLARE
  v_project_id UUID := '0afc2a12-1ca4-4555-8531-50faf687814c';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
  v_task_id UUID;
BEGIN
  RAISE NOTICE 'Attempting to create task...';

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
    'Test Task Manual Creation',
    'Testing if task creation works',
    'todo',
    'medium',
    'todo',
    v_user_id,
    1,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_task_id;

  RAISE NOTICE '✅ SUCCESS! Created task: %', v_task_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ FAILED! Error: %', SQLERRM;
    RAISE NOTICE 'Error detail: %', SQLSTATE;
END $$;

-- Check 5: Show the project details
SELECT
  'Full Project Details' as info,
  *
FROM public.projects
WHERE id = '0afc2a12-1ca4-4555-8531-50faf687814c';
