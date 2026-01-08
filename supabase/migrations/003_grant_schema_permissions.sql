-- Migration: Grant permissions for todoAAPP schema
-- Run this in your Supabase SQL Editor to grant necessary permissions

-- Grant schema usage to all roles
GRANT USAGE ON SCHEMA "todoAAPP" TO postgres;
GRANT USAGE ON SCHEMA "todoAAPP" TO authenticated;
GRANT USAGE ON SCHEMA "todoAAPP" TO anon;
GRANT USAGE ON SCHEMA "todoAAPP" TO service_role;

-- Grant all privileges on all existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "todoAAPP" TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "todoAAPP" TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "todoAAPP" TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA "todoAAPP" TO anon;

-- Grant privileges on all sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "todoAAPP" TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "todoAAPP" TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "todoAAPP" TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "todoAAPP" TO anon;

-- Set default privileges for future tables created in this schema
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT SELECT ON TABLES TO anon;

-- Set default privileges for future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT USAGE, SELECT ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT USAGE, SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "todoAAPP" GRANT USAGE, SELECT ON SEQUENCES TO anon;

-- Ensure RLS is enabled on all tables (for production security)
ALTER TABLE "todoAAPP".profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todoAAPP".notifications ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for service_role (bypasses RLS by default, but good to have)
-- The service_role key has superuser-like access, so these are mainly for documentation

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view all profiles" ON "todoAAPP".profiles;
CREATE POLICY "Users can view all profiles" ON "todoAAPP".profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON "todoAAPP".profiles;
CREATE POLICY "Users can insert own profile" ON "todoAAPP".profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON "todoAAPP".profiles;
CREATE POLICY "Users can update own profile" ON "todoAAPP".profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- ORGANIZATIONS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON "todoAAPP".organizations;
CREATE POLICY "Authenticated users can create organizations" ON "todoAAPP".organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view their organizations" ON "todoAAPP".organizations;
CREATE POLICY "Users can view their organizations" ON "todoAAPP".organizations
  FOR SELECT USING (
    created_by = auth.uid() OR
    id IN (SELECT organization_id FROM "todoAAPP".organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org owners can update organization" ON "todoAAPP".organizations;
CREATE POLICY "Org owners can update organization" ON "todoAAPP".organizations
  FOR UPDATE USING (
    created_by = auth.uid() OR
    id IN (SELECT organization_id FROM "todoAAPP".organization_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ============================================
-- ORGANIZATION_MEMBERS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view org members" ON "todoAAPP".organization_members;
CREATE POLICY "Users can view org members" ON "todoAAPP".organization_members
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM "todoAAPP".organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can join org or be added by admin" ON "todoAAPP".organization_members;
CREATE POLICY "Users can join org or be added by admin" ON "todoAAPP".organization_members
  FOR INSERT WITH CHECK (
    (user_id = auth.uid()) OR
    organization_id IN (SELECT organization_id FROM "todoAAPP".organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- ============================================
-- PROJECTS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Org members can create projects" ON "todoAAPP".projects;
CREATE POLICY "Org members can create projects" ON "todoAAPP".projects
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM "todoAAPP".organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view their projects" ON "todoAAPP".projects;
CREATE POLICY "Users can view their projects" ON "todoAAPP".projects
  FOR SELECT USING (
    created_by = auth.uid() OR
    id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Project owners can update projects" ON "todoAAPP".projects;
CREATE POLICY "Project owners can update projects" ON "todoAAPP".projects
  FOR UPDATE USING (
    created_by = auth.uid() OR
    id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

DROP POLICY IF EXISTS "Project owners can delete projects" ON "todoAAPP".projects;
CREATE POLICY "Project owners can delete projects" ON "todoAAPP".projects
  FOR DELETE USING (
    created_by = auth.uid() OR
    id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ============================================
-- PROJECT_MEMBERS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view project members" ON "todoAAPP".project_members;
CREATE POLICY "Users can view project members" ON "todoAAPP".project_members
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can join project or be added by admin" ON "todoAAPP".project_members;
CREATE POLICY "Users can join project or be added by admin" ON "todoAAPP".project_members
  FOR INSERT WITH CHECK (
    (user_id = auth.uid()) OR
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Project members can view tasks" ON "todoAAPP".tasks;
CREATE POLICY "Project members can view tasks" ON "todoAAPP".tasks
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Project members can create tasks" ON "todoAAPP".tasks;
CREATE POLICY "Project members can create tasks" ON "todoAAPP".tasks
  FOR INSERT WITH CHECK (
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role IN ('member', 'admin', 'owner'))
  );

DROP POLICY IF EXISTS "Project members can update tasks" ON "todoAAPP".tasks;
CREATE POLICY "Project members can update tasks" ON "todoAAPP".tasks
  FOR UPDATE USING (
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role IN ('member', 'admin', 'owner'))
  );

DROP POLICY IF EXISTS "Project members can delete tasks" ON "todoAAPP".tasks;
CREATE POLICY "Project members can delete tasks" ON "todoAAPP".tasks
  FOR DELETE USING (
    created_by = auth.uid() OR
    project_id IN (SELECT project_id FROM "todoAAPP".project_members WHERE user_id = auth.uid() AND role IN ('member', 'admin', 'owner'))
  );

-- ============================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own notifications" ON "todoAAPP".notifications;
CREATE POLICY "Users can view own notifications" ON "todoAAPP".notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can create notifications" ON "todoAAPP".notifications;
CREATE POLICY "System can create notifications" ON "todoAAPP".notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON "todoAAPP".notifications;
CREATE POLICY "Users can update own notifications" ON "todoAAPP".notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON "todoAAPP".notifications;
CREATE POLICY "Users can delete own notifications" ON "todoAAPP".notifications
  FOR DELETE USING (user_id = auth.uid());
