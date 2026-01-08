-- Migration: Fix triggers that reference wrong schema
-- Run this in your Supabase SQL Editor

-- Step 1: Find all triggers on the todoAAPP schema
SELECT
    trigger_name,
    event_object_schema,
    event_object_table,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'todoAAPP';

-- Step 2: Find all functions that might reference public schema
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'todoAAPP'
AND pg_get_functiondef(p.oid) LIKE '%public.%';

-- Step 3: Check for any trigger functions
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'todoAAPP'
AND p.prorettype = 'trigger'::regtype;

-- Step 4: List all triggers with their full definitions
SELECT
    tgname AS trigger_name,
    relname AS table_name,
    nspname AS schema_name,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE nspname = 'todoAAPP'
AND NOT tgisinternal;

-- ============================================
-- COMMON FIX: If there's an auto-add project member trigger
-- ============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_project_created ON "todoAAPP".projects;
DROP FUNCTION IF EXISTS "todoAAPP".handle_new_project();

-- Create corrected function that uses the right schema
CREATE OR REPLACE FUNCTION "todoAAPP".handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-add creator as project owner
    INSERT INTO "todoAAPP".project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (project_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: We're NOT creating the trigger because the API route
-- already handles adding project members. Having both would cause duplicates.
-- If you want auto-add via trigger, uncomment below:
--
-- CREATE TRIGGER on_project_created
--     AFTER INSERT ON "todoAAPP".projects
--     FOR EACH ROW
--     EXECUTE FUNCTION "todoAAPP".handle_new_project();

-- ============================================
-- ALTERNATIVE: Completely disable any existing triggers
-- ============================================

-- If triggers are causing issues, you can disable them temporarily:
-- ALTER TABLE "todoAAPP".projects DISABLE TRIGGER ALL;
-- ALTER TABLE "todoAAPP".project_members DISABLE TRIGGER ALL;

-- To re-enable:
-- ALTER TABLE "todoAAPP".projects ENABLE TRIGGER ALL;
-- ALTER TABLE "todoAAPP".project_members ENABLE TRIGGER ALL;

-- ============================================
-- VERIFY: Check the search_path is set correctly
-- ============================================

-- Show current search_path
SHOW search_path;

-- Set search_path to prioritize todoAAPP
ALTER DATABASE postgres SET search_path TO "todoAAPP", public;

-- For the authenticated role specifically
ALTER ROLE authenticated SET search_path TO "todoAAPP", public;
ALTER ROLE service_role SET search_path TO "todoAAPP", public;
ALTER ROLE anon SET search_path TO "todoAAPP", public;
