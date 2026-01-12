-- Migration: Fix profile trigger for new user signup
-- Problem: The handle_new_user trigger may be failing silently, leaving users without profiles
-- Solution: Recreate the trigger with better error handling and also fix any existing users without profiles

-- ============================================
-- PART 1: Drop and recreate the trigger function with better handling
-- ============================================

-- Drop the old trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert profile with ON CONFLICT to handle edge cases
  INSERT INTO public.profiles (id, email, full_name, avatar_url, profile_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth signup
    RAISE WARNING 'handle_new_user trigger failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PART 2: Fix any existing auth users who don't have profiles
-- This handles users who signed up when the trigger was broken
-- ============================================

-- Insert missing profiles for any auth users without them
INSERT INTO public.profiles (id, email, full_name, avatar_url, profile_completed)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture'),
  false
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PART 3: Ensure the profiles table has proper constraints
-- ============================================

-- Make sure email column allows updates (for the ON CONFLICT clause)
-- The UNIQUE constraint should already exist, but ensure it does
DO $$
BEGIN
  -- Check if unique constraint exists on email
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_email_key'
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    -- Add unique constraint if missing
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists, that's fine
    NULL;
END $$;

-- ============================================
-- VERIFICATION: Show how many profiles were fixed
-- ============================================
DO $$
DECLARE
  profile_count INTEGER;
  auth_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  RAISE NOTICE 'Profile sync complete: % profiles for % auth users', profile_count, auth_count;
END $$;
