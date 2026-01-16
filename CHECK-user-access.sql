-- =====================================================
-- CHECK USER ACCESS - Diagnose why user can't access data
-- Run this to see what data is missing for your user
-- =====================================================

-- Replace with your actual user ID from browser console
-- User ID from screenshot: b5733666-7690-4b0a-a693-930d34bbeb58
-- Project ID from screenshot: e8f4a29e-7967-4ad5-9ad0-271da779fa33

-- Check if user profile exists
SELECT
  '1. Profile Check' as check_type,
  id,
  full_name,
  email,
  created_at
FROM public.profiles
WHERE id = 'b5733666-7690-4b0a-a693-930d34bbeb58';

-- Check if project exists
SELECT
  '2. Project Check' as check_type,
  id,
  name,
  created_by,
  organization_id,
  created_at
FROM public.projects
WHERE id = 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';

-- Check if user has project_members record (THIS IS CRITICAL!)
SELECT
  '3. Project Members Check (CRITICAL)' as check_type,
  id,
  project_id,
  user_id,
  role,
  joined_at
FROM public.project_members
WHERE user_id = 'b5733666-7690-4b0a-a693-930d34bbeb58'
  AND project_id = 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';

-- Check ALL projects this user is a member of
SELECT
  '4. All User Projects' as check_type,
  pm.id,
  pm.project_id,
  p.name as project_name,
  pm.role,
  pm.joined_at
FROM public.project_members pm
LEFT JOIN public.projects p ON p.id = pm.project_id
WHERE pm.user_id = 'b5733666-7690-4b0a-a693-930d34bbeb58'
ORDER BY pm.joined_at DESC;

-- Check if user has organization access
SELECT
  '5. Organization Members Check' as check_type,
  om.id,
  om.organization_id,
  o.name as org_name,
  om.role,
  om.joined_at
FROM public.organization_members om
LEFT JOIN public.organizations o ON o.id = om.organization_id
WHERE om.user_id = 'b5733666-7690-4b0a-a693-930d34bbeb58'
ORDER BY om.joined_at DESC;

-- Summary
DO $$
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'DIAGNOSTIC COMPLETE';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'If section 3 returns NO ROWS, that is your problem!';
  RAISE NOTICE '';
  RAISE NOTICE 'The user MUST have a record in project_members table';
  RAISE NOTICE 'to access the project. If missing, run FIX-user-access.sql';
  RAISE NOTICE '';
END $$;
