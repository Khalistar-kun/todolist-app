-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR TODOAAPP SCHEMA
-- This must be run AFTER create-todoaapp-schema.sql
-- =====================================================

SET search_path TO TODOAAPP, public;

-- =====================================================
-- DROP EXISTING POLICIES (for idempotency)
-- =====================================================

-- Drop all existing policies on TODOAAPP tables
DROP POLICY IF EXISTS "Users can view all profiles" ON TODOAAPP.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON TODOAAPP.profiles;
DROP POLICY IF EXISTS "Users can read organizations they belong to" ON TODOAAPP.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON TODOAAPP.organizations;
DROP POLICY IF EXISTS "Organization owners can update organizations" ON TODOAAPP.organizations;
DROP POLICY IF EXISTS "Organization owners can delete organizations" ON TODOAAPP.organizations;
DROP POLICY IF EXISTS "Users can read organization members" ON TODOAAPP.organization_members;
DROP POLICY IF EXISTS "Org admins can add members" ON TODOAAPP.organization_members;
DROP POLICY IF EXISTS "Org admins can update members" ON TODOAAPP.organization_members;
DROP POLICY IF EXISTS "Users can leave organizations" ON TODOAAPP.organization_members;
DROP POLICY IF EXISTS "Users can read teams in their organization" ON TODOAAPP.teams;
DROP POLICY IF EXISTS "Org admins can create teams" ON TODOAAPP.teams;
DROP POLICY IF EXISTS "Team admins can update teams" ON TODOAAPP.teams;
DROP POLICY IF EXISTS "Team owners can delete teams" ON TODOAAPP.teams;
DROP POLICY IF EXISTS "Users can read team members" ON TODOAAPP.team_members;
DROP POLICY IF EXISTS "Team admins can add members" ON TODOAAPP.team_members;
DROP POLICY IF EXISTS "Users can read projects they are members of" ON TODOAAPP.projects;
DROP POLICY IF EXISTS "Organization members can create projects" ON TODOAAPP.projects;
DROP POLICY IF EXISTS "Project owners can update projects" ON TODOAAPP.projects;
DROP POLICY IF EXISTS "Project owners can delete projects" ON TODOAAPP.projects;
DROP POLICY IF EXISTS "Users can view project members" ON TODOAAPP.project_members;
DROP POLICY IF EXISTS "Project admins can add members" ON TODOAAPP.project_members;
DROP POLICY IF EXISTS "Users can read tasks in their projects" ON TODOAAPP.tasks;
DROP POLICY IF EXISTS "Project members can create tasks" ON TODOAAPP.tasks;
DROP POLICY IF EXISTS "Project members can update tasks" ON TODOAAPP.tasks;
DROP POLICY IF EXISTS "Project owners can delete tasks" ON TODOAAPP.tasks;
DROP POLICY IF EXISTS "task_assignments_select" ON TODOAAPP.task_assignments;
DROP POLICY IF EXISTS "subtasks_select" ON TODOAAPP.subtasks;
DROP POLICY IF EXISTS "subtasks_all" ON TODOAAPP.subtasks;
DROP POLICY IF EXISTS "comments_select" ON TODOAAPP.comments;
DROP POLICY IF EXISTS "comments_insert" ON TODOAAPP.comments;
DROP POLICY IF EXISTS "notifications_select" ON TODOAAPP.notifications;
DROP POLICY IF EXISTS "notifications_update" ON TODOAAPP.notifications;
DROP POLICY IF EXISTS "mentions_select" ON TODOAAPP.mentions;
DROP POLICY IF EXISTS "attention_select" ON TODOAAPP.attention_items;
DROP POLICY IF EXISTS "attention_update" ON TODOAAPP.attention_items;

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE TODOAAPP.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.slack_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE TODOAAPP.attention_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

CREATE POLICY "Users can view all profiles"
  ON TODOAAPP.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON TODOAAPP.profiles FOR UPDATE
  USING (auth.uid() = id);

-- =====================================================
-- ORGANIZATIONS POLICIES
-- =====================================================

CREATE POLICY "Users can read organizations they belong to"
  ON TODOAAPP.organizations FOR SELECT
  USING (
    id IN (
      SELECT om.organization_id
      FROM TODOAAPP.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create organizations"
  ON TODOAAPP.organizations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Organization owners can update organizations"
  ON TODOAAPP.organizations FOR UPDATE
  USING (
    id IN (
      SELECT om.organization_id
      FROM TODOAAPP.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

CREATE POLICY "Organization owners can delete organizations"
  ON TODOAAPP.organizations FOR DELETE
  USING (
    id IN (
      SELECT om.organization_id
      FROM TODOAAPP.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

-- =====================================================
-- ORGANIZATION_MEMBERS POLICIES
-- =====================================================

CREATE POLICY "Users can read organization members"
  ON TODOAAPP.organization_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    organization_id IN (
      SELECT organization_id FROM TODOAAPP.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can add members"
  ON TODOAAPP.organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM TODOAAPP.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update members"
  ON TODOAAPP.organization_members FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM TODOAAPP.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can leave organizations"
  ON TODOAAPP.organization_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    organization_id IN (
      SELECT om.organization_id
      FROM TODOAAPP.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- TEAMS POLICIES
-- =====================================================

CREATE POLICY "Users can read teams in their organization"
  ON TODOAAPP.teams FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM TODOAAPP.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can create teams"
  ON TODOAAPP.teams FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM TODOAAPP.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Team admins can update teams"
  ON TODOAAPP.teams FOR UPDATE
  USING (
    id IN (
      SELECT tm.team_id
      FROM TODOAAPP.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Team owners can delete teams"
  ON TODOAAPP.teams FOR DELETE
  USING (
    id IN (
      SELECT tm.team_id
      FROM TODOAAPP.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role = 'owner'
    )
  );

-- =====================================================
-- TEAM_MEMBERS POLICIES
-- =====================================================

CREATE POLICY "Users can read team members"
  ON TODOAAPP.team_members FOR SELECT
  USING (
    team_id IN (
      SELECT tm.team_id
      FROM TODOAAPP.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can add members"
  ON TODOAAPP.team_members FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT tm.team_id
      FROM TODOAAPP.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
    OR
    NOT EXISTS (
      SELECT 1 FROM TODOAAPP.team_members tm
      WHERE tm.team_id = team_members.team_id
    )
  );

-- =====================================================
-- PROJECTS POLICIES
-- =====================================================

CREATE POLICY "Users can read projects they are members of"
  ON TODOAAPP.projects FOR SELECT
  USING (
    id IN (
      SELECT pm.project_id
      FROM TODOAAPP.project_members pm
      WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can create projects"
  ON TODOAAPP.projects FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM TODOAAPP.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project owners can update projects"
  ON TODOAAPP.projects FOR UPDATE
  USING (
    id IN (
      SELECT pm.project_id
      FROM TODOAAPP.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project owners can delete projects"
  ON TODOAAPP.projects FOR DELETE
  USING (
    id IN (
      SELECT pm.project_id
      FROM TODOAAPP.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role = 'owner'
    )
  );

-- =====================================================
-- PROJECT_MEMBERS POLICIES
-- =====================================================

CREATE POLICY "Users can view project members"
  ON TODOAAPP.project_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    project_id IN (
      SELECT project_id FROM TODOAAPP.project_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project admins can add members"
  ON TODOAAPP.project_members FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT pm.project_id
      FROM TODOAAPP.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- TASKS POLICIES
-- =====================================================

CREATE POLICY "Users can read tasks in their projects"
  ON TODOAAPP.tasks FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM TODOAAPP.project_members pm
      WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create tasks"
  ON TODOAAPP.tasks FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT pm.project_id
      FROM TODOAAPP.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Project members can update tasks"
  ON TODOAAPP.tasks FOR UPDATE
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM TODOAAPP.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Project owners can delete tasks"
  ON TODOAAPP.tasks FOR DELETE
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM TODOAAPP.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- REMAINING TABLES - SIMPLE POLICIES
-- =====================================================

-- Task Assignments
CREATE POLICY "task_assignments_select" ON TODOAAPP.task_assignments FOR SELECT
  USING (task_id IN (SELECT id FROM TODOAAPP.tasks));

-- Subtasks
CREATE POLICY "subtasks_select" ON TODOAAPP.subtasks FOR SELECT
  USING (task_id IN (SELECT id FROM TODOAAPP.tasks));

CREATE POLICY "subtasks_all" ON TODOAAPP.subtasks FOR ALL
  USING (task_id IN (SELECT id FROM TODOAAPP.tasks));

-- Comments
CREATE POLICY "comments_select" ON TODOAAPP.comments FOR SELECT
  USING (task_id IN (SELECT id FROM TODOAAPP.tasks));

CREATE POLICY "comments_insert" ON TODOAAPP.comments FOR INSERT
  WITH CHECK (task_id IN (SELECT id FROM TODOAAPP.tasks));

-- Notifications
CREATE POLICY "notifications_select" ON TODOAAPP.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON TODOAAPP.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Mentions
CREATE POLICY "mentions_select" ON TODOAAPP.mentions FOR SELECT
  USING (mentioned_user_id = auth.uid() OR mentioner_user_id = auth.uid());

-- Attention Items
CREATE POLICY "attention_select" ON TODOAAPP.attention_items FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "attention_update" ON TODOAAPP.attention_items FOR UPDATE
  USING (user_id = auth.uid());

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies created successfully for TODOAAPP schema!';
  RAISE NOTICE '🔒 All tables are now protected with Row Level Security';
END $$;
