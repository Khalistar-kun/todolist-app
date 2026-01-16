-- =====================================================
-- FIX USER ACCESS - Add missing project_members records
-- Run this AFTER running CHECK-user-access.sql
-- =====================================================

-- IMPORTANT: Replace these values with YOUR actual IDs from the browser console
-- User ID: b5733666-7690-4b0a-a693-930d34bbeb58
-- Project ID: e8f4a29e-7967-4ad5-9ad0-271da779fa33

-- Step 1: Check if project exists, if not create it
DO $$
DECLARE
  v_project_id UUID := 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
  v_org_id UUID := 'fcd4da3c-a1a5-4d38-ad6d-5cd809d5033b'; -- OJT-Internship org
  v_project_exists BOOLEAN;
BEGIN
  -- Check if project exists
  SELECT EXISTS(
    SELECT 1 FROM public.projects WHERE id = v_project_id
  ) INTO v_project_exists;

  IF NOT v_project_exists THEN
    RAISE NOTICE '⚠️  Project does not exist - creating it now...';

    -- Create the project with organization
    INSERT INTO public.projects (
      id,
      name,
      description,
      created_by,
      organization_id,
      status,
      priority,
      visibility,
      created_at,
      updated_at
    ) VALUES (
      v_project_id,
      'My Project',
      'Default project created by fix script',
      v_user_id,
      v_org_id,
      'active',
      'medium',
      'private',
      NOW(),
      NOW()
    );

    RAISE NOTICE '✅ Project created with organization';
  ELSE
    RAISE NOTICE '✅ Project already exists';
  END IF;
END $$;

-- Step 2: Add user to project_members (THIS IS THE KEY FIX!)
DO $$
DECLARE
  v_project_id UUID := 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
  v_member_exists BOOLEAN;
BEGIN
  -- Check if membership already exists
  SELECT EXISTS(
    SELECT 1 FROM public.project_members
    WHERE project_id = v_project_id AND user_id = v_user_id
  ) INTO v_member_exists;

  IF NOT v_member_exists THEN
    RAISE NOTICE '⚠️  User is not a project member - adding now...';

    -- Add user as project owner
    INSERT INTO public.project_members (
      id,
      project_id,
      user_id,
      role,
      joined_at
    ) VALUES (
      gen_random_uuid(),
      v_project_id,
      v_user_id,
      'owner',
      NOW()
    );

    RAISE NOTICE '✅ User added to project as owner';
  ELSE
    RAISE NOTICE '✅ User is already a project member';
  END IF;
END $$;

-- Step 3: Verify the fix
DO $$
DECLARE
  v_project_id UUID := 'e8f4a29e-7967-4ad5-9ad0-271da779fa33';
  v_user_id UUID := 'b5733666-7690-4b0a-a693-930d34bbeb58';
  v_can_access BOOLEAN;
BEGIN
  -- Test if user can now access the project
  SELECT EXISTS(
    SELECT 1 FROM public.project_members
    WHERE project_id = v_project_id AND user_id = v_user_id
  ) INTO v_can_access;

  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'FIX COMPLETE - VERIFICATION';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '';

  IF v_can_access THEN
    RAISE NOTICE '✅ SUCCESS! User can now access the project';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next steps:';
    RAISE NOTICE '   1. Refresh your browser';
    RAISE NOTICE '   2. Try accessing the project again';
    RAISE NOTICE '   3. The 500 errors should be gone';
  ELSE
    RAISE NOTICE '❌ FAILED - User still cannot access project';
    RAISE NOTICE '   Please check the user_id and project_id values';
  END IF;

  RAISE NOTICE '';
END $$;
