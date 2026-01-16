-- =====================================================
-- FINAL FIX V2 - Initialize Project with Workflow Stages
-- Simplified version without \echo commands
-- =====================================================

-- Step 1: Check current state
DO $$
DECLARE
  v_project_id UUID := 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
  v_org_id UUID := 'fcd4da3c-a1a5-4d38-ad6d-5cd809d5033b';
  v_project_exists BOOLEAN;
  v_has_workflow BOOLEAN;
  v_has_member BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.projects WHERE id = v_project_id) INTO v_project_exists;
  SELECT EXISTS(
    SELECT 1 FROM public.projects
    WHERE id = v_project_id AND workflow_stages IS NOT NULL AND jsonb_array_length(workflow_stages) > 0
  ) INTO v_has_workflow;
  SELECT EXISTS(
    SELECT 1 FROM public.project_members WHERE project_id = v_project_id AND user_id = v_user_id
  ) INTO v_has_member;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'STEP 1: Current State';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Project exists: %', CASE WHEN v_project_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE 'Has workflow_stages: %', CASE WHEN v_has_workflow THEN 'YES' ELSE 'NO - THIS IS THE PROBLEM!' END;
  RAISE NOTICE 'User is member: %', CASE WHEN v_has_member THEN 'YES' ELSE 'NO' END;
END $$;

-- Step 2: Create/Update project with workflow_stages
INSERT INTO public.projects (
  id,
  name,
  description,
  organization_id,
  created_by,
  status,
  color,
  workflow_stages,
  created_at,
  updated_at
) VALUES (
  'e8f4a29e-7967-4ad5-9ad0-271da779fa33',
  'My Project',
  'Default project',
  'fcd4da3c-a1a5-4d38-ad6d-5cd809d5033b',
  'b5733666-7690-4b0a-a693-930d34bbeb58',
  'active',
  '#3B82F6',
  '[
    {"id": "todo", "name": "To Do", "color": "#6B7280", "position": 0},
    {"id": "in_progress", "name": "In Progress", "color": "#3B82F6", "position": 1},
    {"id": "review", "name": "Review", "color": "#F59E0B", "position": 2},
    {"id": "done", "name": "Done", "color": "#10B981", "position": 3}
  ]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  workflow_stages = '[
    {"id": "todo", "name": "To Do", "color": "#6B7280", "position": 0},
    {"id": "in_progress", "name": "In Progress", "color": "#3B82F6", "position": 1},
    {"id": "review", "name": "Review", "color": "#F59E0B", "position": 2},
    {"id": "done", "name": "Done", "color": "#10B981", "position": 3}
  ]'::jsonb,
  updated_at = NOW();

-- Step 3: Ensure user is a project member
INSERT INTO public.project_members (
  id,
  project_id,
  user_id,
  role,
  joined_at
) VALUES (
  gen_random_uuid(),
  'e8f4a29e-7967-4ad5-9ad0-271da779fa33',
  'b5733666-7690-4b0a-a693-930d34bbeb58',
  'owner',
  NOW()
)
ON CONFLICT (project_id, user_id) DO UPDATE SET
  role = 'owner';

-- Step 4: Verify the fix
DO $$
DECLARE
  v_project_id UUID := 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
  v_project RECORD;
  v_member RECORD;
BEGIN
  SELECT id, name, workflow_stages, jsonb_array_length(workflow_stages) as stage_count
  INTO v_project
  FROM public.projects
  WHERE id = v_project_id;

  SELECT role INTO v_member
  FROM public.project_members
  WHERE project_id = v_project_id AND user_id = v_user_id;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'VERIFICATION COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Project: %', v_project.name;
  RAISE NOTICE 'Workflow stages: % stages configured', v_project.stage_count;
  RAISE NOTICE 'User role: %', v_member.role;
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Refresh your browser (hard refresh: Ctrl+Shift+R)';
  RAISE NOTICE '2. Try creating a task';
  RAISE NOTICE '3. The 500 errors should be GONE!';
END $$;

-- Show final project data
SELECT
  'Final Project State' as status,
  id,
  name,
  organization_id,
  workflow_stages
FROM public.projects
WHERE id = 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';
