-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR PUBLIC SCHEMA
-- Run AFTER create-public-schema-tables.sql
-- Architecture: public schema only, no custom schemas
-- =====================================================

-- =====================================================
-- DROP EXISTING POLICIES (for idempotency)
-- =====================================================

-- Profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Organizations
DROP POLICY IF EXISTS "Users can read organizations they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can delete organizations" ON public.organizations;

-- Organization Members
DROP POLICY IF EXISTS "Users can read organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Org admins can add members" ON public.organization_members;
DROP POLICY IF EXISTS "Org admins can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can leave organizations" ON public.organization_members;

-- Teams
DROP POLICY IF EXISTS "Users can read teams in their organization" ON public.teams;
DROP POLICY IF EXISTS "Org admins can create teams" ON public.teams;
DROP POLICY IF EXISTS "Team admins can update teams" ON public.teams;
DROP POLICY IF EXISTS "Team owners can delete teams" ON public.teams;

-- Team Members
DROP POLICY IF EXISTS "Users can read team members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can add members" ON public.team_members;

-- Projects
DROP POLICY IF EXISTS "Users can read projects they are members of" ON public.projects;
DROP POLICY IF EXISTS "Organization members can create projects" ON public.projects;
DROP POLICY IF EXISTS "Project owners can update projects" ON public.projects;
DROP POLICY IF EXISTS "Project owners can delete projects" ON public.projects;

-- Project Members
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins can add members" ON public.project_members;

-- Tasks
DROP POLICY IF EXISTS "Users can read tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Project members can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project owners can delete tasks" ON public.tasks;

-- Task Assignments
DROP POLICY IF EXISTS "task_assignments_select" ON public.task_assignments;
DROP POLICY IF EXISTS "task_assignments_insert" ON public.task_assignments;
DROP POLICY IF EXISTS "task_assignments_delete" ON public.task_assignments;

-- Subtasks
DROP POLICY IF EXISTS "subtasks_select" ON public.subtasks;
DROP POLICY IF EXISTS "subtasks_all" ON public.subtasks;

-- Comments
DROP POLICY IF EXISTS "comments_select" ON public.comments;
DROP POLICY IF EXISTS "comments_insert" ON public.comments;

-- Attachments
DROP POLICY IF EXISTS "attachments_select" ON public.attachments;
DROP POLICY IF EXISTS "attachments_insert" ON public.attachments;

-- Time Entries
DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_insert" ON public.time_entries;

-- Activity Logs
DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;

-- Notifications
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;

-- Webhooks
DROP POLICY IF EXISTS "webhooks_select" ON public.webhooks;
DROP POLICY IF EXISTS "webhooks_insert" ON public.webhooks;

-- Slack Integrations
DROP POLICY IF EXISTS "slack_integrations_select" ON public.slack_integrations;
DROP POLICY IF EXISTS "slack_integrations_insert" ON public.slack_integrations;
DROP POLICY IF EXISTS "slack_integrations_update" ON public.slack_integrations;

-- Mentions
DROP POLICY IF EXISTS "mentions_select" ON public.mentions;
DROP POLICY IF EXISTS "mentions_insert" ON public.mentions;
DROP POLICY IF EXISTS "mentions_update" ON public.mentions;

-- Attention Items
DROP POLICY IF EXISTS "attention_select" ON public.attention_items;
DROP POLICY IF EXISTS "attention_update" ON public.attention_items;
DROP POLICY IF EXISTS "attention_insert" ON public.attention_items;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- =====================================================
-- ORGANIZATIONS POLICIES
-- =====================================================

CREATE POLICY "Users can read organizations they belong to"
  ON public.organizations FOR SELECT
  USING (
    id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Organization owners can update organizations"
  ON public.organizations FOR UPDATE
  USING (
    id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

CREATE POLICY "Organization owners can delete organizations"
  ON public.organizations FOR DELETE
  USING (
    id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

-- =====================================================
-- ORGANIZATION_MEMBERS POLICIES
-- =====================================================

CREATE POLICY "Users can read organization members"
  ON public.organization_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can add members"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update members"
  ON public.organization_members FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can leave organizations"
  ON public.organization_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- TEAMS POLICIES
-- =====================================================

CREATE POLICY "Users can read teams in their organization"
  ON public.teams FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Team admins can update teams"
  ON public.teams FOR UPDATE
  USING (
    id IN (
      SELECT tm.team_id
      FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Team owners can delete teams"
  ON public.teams FOR DELETE
  USING (
    id IN (
      SELECT tm.team_id
      FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role = 'owner'
    )
  );

-- =====================================================
-- TEAM_MEMBERS POLICIES
-- =====================================================

CREATE POLICY "Users can read team members"
  ON public.team_members FOR SELECT
  USING (
    team_id IN (
      SELECT tm.team_id
      FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can add members"
  ON public.team_members FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT tm.team_id
      FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
    OR
    NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_members.team_id
    )
  );

-- =====================================================
-- PROJECTS POLICIES
-- =====================================================

CREATE POLICY "Users can read projects they are members of"
  ON public.projects FOR SELECT
  USING (
    id IN (
      SELECT pm.project_id
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Project owners can update projects"
  ON public.projects FOR UPDATE
  USING (
    id IN (
      SELECT pm.project_id
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project owners can delete projects"
  ON public.projects FOR DELETE
  USING (
    id IN (
      SELECT pm.project_id
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role = 'owner'
    )
  );

-- =====================================================
-- PROJECT_MEMBERS POLICIES
-- =====================================================

CREATE POLICY "Users can view project members"
  ON public.project_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project admins can add members"
  ON public.project_members FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT pm.project_id
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- TASKS POLICIES
-- =====================================================

CREATE POLICY "Users can read tasks in their projects"
  ON public.tasks FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT pm.project_id
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Project members can update tasks"
  ON public.tasks FOR UPDATE
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Project owners can delete tasks"
  ON public.tasks FOR DELETE
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- TASK ASSIGNMENTS POLICIES
-- =====================================================

CREATE POLICY "task_assignments_select"
  ON public.task_assignments FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "task_assignments_insert"
  ON public.task_assignments FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'editor')
      )
    )
  );

CREATE POLICY "task_assignments_delete"
  ON public.task_assignments FOR DELETE
  USING (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'editor')
      )
    )
  );

-- =====================================================
-- SUBTASKS POLICIES
-- =====================================================

CREATE POLICY "subtasks_select"
  ON public.subtasks FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "subtasks_all"
  ON public.subtasks FOR ALL
  USING (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- COMMENTS POLICIES
-- =====================================================

CREATE POLICY "comments_select"
  ON public.comments FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "comments_insert"
  ON public.comments FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- ATTACHMENTS POLICIES
-- =====================================================

CREATE POLICY "attachments_select"
  ON public.attachments FOR SELECT
  USING (
    (task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    ))
    OR
    (comment_id IN (
      SELECT c.id FROM public.comments c
      JOIN public.tasks t ON c.task_id = t.id
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    ))
  );

CREATE POLICY "attachments_insert"
  ON public.attachments FOR INSERT
  WITH CHECK (
    (task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    ))
    OR
    (comment_id IN (
      SELECT c.id FROM public.comments c
      JOIN public.tasks t ON c.task_id = t.id
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    ))
  );

-- =====================================================
-- TIME ENTRIES POLICIES
-- =====================================================

CREATE POLICY "time_entries_select"
  ON public.time_entries FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "time_entries_insert"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- ACTIVITY LOGS POLICIES
-- =====================================================

CREATE POLICY "activity_logs_select"
  ON public.activity_logs FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
    )
  );

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================

CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- =====================================================
-- WEBHOOKS POLICIES
-- =====================================================

CREATE POLICY "webhooks_select"
  ON public.webhooks FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "webhooks_insert"
  ON public.webhooks FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- SLACK INTEGRATIONS POLICIES
-- =====================================================

CREATE POLICY "slack_integrations_select"
  ON public.slack_integrations FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "slack_integrations_insert"
  ON public.slack_integrations FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "slack_integrations_update"
  ON public.slack_integrations FOR UPDATE
  USING (
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- MENTIONS POLICIES
-- =====================================================

CREATE POLICY "mentions_select"
  ON public.mentions FOR SELECT
  USING (mentioned_user_id = auth.uid() OR mentioner_user_id = auth.uid());

CREATE POLICY "mentions_insert"
  ON public.mentions FOR INSERT
  WITH CHECK (mentioner_user_id = auth.uid());

CREATE POLICY "mentions_update"
  ON public.mentions FOR UPDATE
  USING (mentioned_user_id = auth.uid());

-- =====================================================
-- ATTENTION ITEMS POLICIES
-- =====================================================

CREATE POLICY "attention_select"
  ON public.attention_items FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "attention_update"
  ON public.attention_items FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "attention_insert"
  ON public.attention_items FOR INSERT
  WITH CHECK (true); -- System can create attention items for any user

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies created successfully for public schema!';
  RAISE NOTICE '🔒 All 19 tables are now protected with Row Level Security';
  RAISE NOTICE '📋 Architecture: public schema only, no custom schemas';
  RAISE NOTICE '🎯 Query pattern: .from(''table_name'') - no schema qualifiers';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Policy Summary:';
  RAISE NOTICE '   - Profiles: 2 policies';
  RAISE NOTICE '   - Organizations: 4 policies';
  RAISE NOTICE '   - Organization Members: 4 policies';
  RAISE NOTICE '   - Teams: 4 policies';
  RAISE NOTICE '   - Team Members: 2 policies';
  RAISE NOTICE '   - Projects: 4 policies';
  RAISE NOTICE '   - Project Members: 2 policies';
  RAISE NOTICE '   - Tasks: 4 policies';
  RAISE NOTICE '   - Task Assignments: 3 policies';
  RAISE NOTICE '   - Subtasks: 2 policies';
  RAISE NOTICE '   - Comments: 2 policies';
  RAISE NOTICE '   - Attachments: 2 policies';
  RAISE NOTICE '   - Time Entries: 2 policies';
  RAISE NOTICE '   - Activity Logs: 1 policy';
  RAISE NOTICE '   - Notifications: 2 policies';
  RAISE NOTICE '   - Webhooks: 2 policies';
  RAISE NOTICE '   - Slack Integrations: 3 policies';
  RAISE NOTICE '   - Mentions: 3 policies';
  RAISE NOTICE '   - Attention Items: 3 policies';
END $$;
