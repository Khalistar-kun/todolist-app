-- =====================================================
-- FIX PROJECT 0afc2a12-1ca4-4555-8531-50faf687814c
-- Ensure user has proper access and role
-- =====================================================

-- Your IDs
-- User: b5733666-7690-4b0a-a693-930d34bbeb58
-- Project: 0afc2a12-1ca4-4555-8531-50faf687814c

-- Step 1: Check current membership
SELECT
  'Current Membership' as info,
  id,
  user_id,
  project_id,
  role
FROM public.project_members
WHERE project_id = '0afc2a12-1ca4-4555-8531-50faf687814c'
  AND user_id = 'b5733666-7690-4b0a-a693-930d34bbeb58';

-- Step 2: Update or insert membership with correct role
INSERT INTO public.project_members (
  id,
  project_id,
  user_id,
  role,
  joined_at
) VALUES (
  gen_random_uuid(),
  '0afc2a12-1ca4-4555-8531-50faf687814c',
  'b5733666-7690-4b0a-a693-930d34bbeb58',
  'owner',  -- Changed from 'reader' to 'owner'
  NOW()
)
ON CONFLICT (project_id, user_id) DO UPDATE SET
  role = 'owner';  -- Ensure role is 'owner' not 'reader'

-- Step 3: Verify the fix
SELECT
  'Updated Membership' as info,
  id,
  user_id,
  project_id,
  role,
  CASE
    WHEN role IN ('owner', 'admin', 'member') THEN '✅ VALID - Can create tasks'
    ELSE '❌ INVALID - Cannot create tasks (role: ' || role || ')'
  END as status
FROM public.project_members
WHERE project_id = '0afc2a12-1ca4-4555-8531-50faf687814c'
  AND user_id = 'b5733666-7690-4b0a-a693-930d34bbeb58';

-- Step 4: Show project info
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'FIX COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Project: OJT-Internship Program';
  RAISE NOTICE 'User role: owner (can now create tasks)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Hard refresh your browser (Ctrl+Shift+R)';
  RAISE NOTICE '2. Try creating a task again';
  RAISE NOTICE '3. It should work now!';
  RAISE NOTICE '';
END $$;
