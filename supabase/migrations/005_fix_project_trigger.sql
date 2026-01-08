-- CRITICAL FIX: Remove/Fix trigger that references public.project_members
-- Run this in your Supabase SQL Editor

-- Step 1: Drop any existing USER triggers (not system triggers)
DROP TRIGGER IF EXISTS on_project_created ON "todoAAPP".projects;
DROP TRIGGER IF EXISTS trigger_auto_add_project_member ON "todoAAPP".projects;
DROP TRIGGER IF EXISTS auto_add_project_member ON "todoAAPP".projects;
DROP TRIGGER IF EXISTS handle_new_project ON "todoAAPP".projects;

-- Step 2: Drop associated functions
DROP FUNCTION IF EXISTS "todoAAPP".handle_new_project() CASCADE;
DROP FUNCTION IF EXISTS "todoAAPP".auto_add_project_member() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_project() CASCADE;
DROP FUNCTION IF EXISTS public.auto_add_project_member() CASCADE;

-- Step 3: List remaining triggers to verify (should only show system/constraint triggers)
SELECT
    tgname AS trigger_name,
    CASE WHEN tgisinternal THEN 'SYSTEM' ELSE 'USER' END AS trigger_type
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'todoAAPP'
AND c.relname = 'projects';
