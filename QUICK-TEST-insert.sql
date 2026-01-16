-- Quick test to see the exact error when creating a task

BEGIN;

-- Try to insert a task
INSERT INTO public.tasks (
  id,
  project_id,
  title,
  stage_id,
  status,
  priority,
  created_by,
  position,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '0afc2a12-1ca4-4555-8531-50faf687814c',
  'QUICK TEST TASK',
  'todo',
  'todo',
  'medium',
  'b5733666-7690-4b0a-a693-930d34bbeb58',
  1,
  NOW(),
  NOW()
);

-- If we get here, it worked
SELECT 'SUCCESS! Task created' as result;

-- Rollback so we don't leave test data
ROLLBACK;
