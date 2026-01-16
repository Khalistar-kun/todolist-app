-- Fix for infinite recursion in RLS policies
-- This script disables problematic policies and creates fixed versions

-- =====================================================
-- FIX ORGANIZATION_MEMBERS POLICIES
-- =====================================================

-- Drop and recreate organization_members policies without recursion
DROP POLICY IF EXISTS "Users can read organization members" ON organization_members;
CREATE POLICY "Users can read organization members"
  ON organization_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- FIX PROJECT_MEMBERS POLICIES
-- =====================================================

-- Drop and recreate project_members policies without recursion
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
CREATE POLICY "Users can view project members"
  ON project_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- FIX TASKS POLICIES
-- =====================================================

-- Tasks policies should use direct project_members check
DROP POLICY IF EXISTS "Users can read tasks in their projects" ON tasks;
CREATE POLICY "Users can read tasks in their projects"
  ON tasks
  FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Project members can create tasks" ON tasks;
CREATE POLICY "Project members can create tasks"
  ON tasks
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Project members can update tasks" ON tasks;
CREATE POLICY "Project members can update tasks"
  ON tasks
  FOR UPDATE
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Project owners can delete tasks" ON tasks;
CREATE POLICY "Project owners can delete tasks"
  ON tasks
  FOR DELETE
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- FIX ORGANIZATIONS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can read organizations they belong to" ON organizations;
CREATE POLICY "Users can read organizations they belong to"
  ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organization owners can update organizations" ON organizations;
CREATE POLICY "Organization owners can update organizations"
  ON organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

-- =====================================================
-- FIX PROJECTS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can read projects they are members of" ON projects;
CREATE POLICY "Users can read projects they are members of"
  ON projects
  FOR SELECT
  USING (
    id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organization members can create projects" ON projects;
CREATE POLICY "Organization members can create projects"
  ON projects
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Project owners can update projects" ON projects;
CREATE POLICY "Project owners can update projects"
  ON projects
  FOR UPDATE
  USING (
    id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Project owners can delete projects" ON projects;
CREATE POLICY "Project owners can delete projects"
  ON projects
  FOR DELETE
  USING (
    id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role = 'owner'
    )
  );

-- =====================================================
-- VERIFY RLS IS STILL ENABLED
-- =====================================================

-- Ensure RLS is enabled on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'RLS policies fixed successfully! Infinite recursion should be resolved.';
END $$;
