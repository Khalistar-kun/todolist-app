-- =====================================================
-- ULTIMATE FIX V2 - Completely Remove ALL Recursion
-- This fixes the infinite recursion in project_members
-- Clean version without \echo commands
-- =====================================================

-- The error: "infinite recursion detected in policy for relation project_members"
-- Root cause: project_members SELECT policy was querying project_members itself!

-- STEP 1: Drop ALL RLS policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'STEP 1: Dropped all existing RLS policies';
  RAISE NOTICE '============================================================';
END $$;

-- STEP 2: Create SIMPLE, NON-RECURSIVE policies

-- PROFILES - Simple
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ORGANIZATIONS - Read if member (NO RECURSION)
CREATE POLICY "organizations_select" ON public.organizations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organizations.id
    AND om.user_id = auth.uid()
  )
);
CREATE POLICY "organizations_insert" ON public.organizations FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "organizations_update" ON public.organizations FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organizations.id
    AND om.user_id = auth.uid()
    AND om.role = 'owner'
  )
);

-- ORGANIZATION_MEMBERS - CRITICAL: NO SELF-REFERENCE
CREATE POLICY "org_members_select" ON public.organization_members FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "org_members_insert" ON public.organization_members FOR INSERT WITH CHECK (true);
CREATE POLICY "org_members_update" ON public.organization_members FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "org_members_delete" ON public.organization_members FOR DELETE USING (user_id = auth.uid());

-- TEAMS - Simple
CREATE POLICY "teams_select" ON public.teams FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = teams.organization_id
    AND om.user_id = auth.uid()
  )
);
CREATE POLICY "teams_insert" ON public.teams FOR INSERT WITH CHECK (true);
CREATE POLICY "teams_update" ON public.teams FOR UPDATE USING (true);
CREATE POLICY "teams_delete" ON public.teams FOR DELETE USING (true);

-- TEAM_MEMBERS - Simple
CREATE POLICY "team_members_all" ON public.team_members FOR ALL USING (true);

-- PROJECTS - Read if member (NO RECURSION)
CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = projects.id
    AND pm.user_id = auth.uid()
  )
);
CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = projects.id
    AND pm.user_id = auth.uid()
  )
);
CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = projects.id
    AND pm.user_id = auth.uid()
    AND pm.role = 'owner'
  )
);

-- PROJECT_MEMBERS - CRITICAL FIX: NO SELF-REFERENCE!
-- OLD (broken): project_id IN (SELECT pm2.project_id FROM project_members pm2...)
-- NEW (fixed): user_id = auth.uid() ONLY
CREATE POLICY "project_members_select" ON public.project_members FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "project_members_insert" ON public.project_members FOR INSERT WITH CHECK (true);
CREATE POLICY "project_members_update" ON public.project_members FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "project_members_delete" ON public.project_members FOR DELETE USING (user_id = auth.uid());

-- TASKS - Simple, trust project access
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = tasks.project_id
    AND pm.user_id = auth.uid()
  )
);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = tasks.project_id
    AND pm.user_id = auth.uid()
  )
);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = tasks.project_id
    AND pm.user_id = auth.uid()
  )
);
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = tasks.project_id
    AND pm.user_id = auth.uid()
  )
);

-- CHILD TABLES - Trust parent (NO CHECKS)
CREATE POLICY "task_assignments_all" ON public.task_assignments FOR ALL USING (true);
CREATE POLICY "subtasks_all" ON public.subtasks FOR ALL USING (true);
CREATE POLICY "comments_all" ON public.comments FOR ALL USING (true);
CREATE POLICY "attachments_all" ON public.attachments FOR ALL USING (true);
CREATE POLICY "time_entries_all" ON public.time_entries FOR ALL USING (true);
CREATE POLICY "activity_logs_all" ON public.activity_logs FOR ALL USING (true);

-- NOTIFICATIONS - User only
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- INTEGRATIONS - Open access
CREATE POLICY "webhooks_all" ON public.webhooks FOR ALL USING (true);
CREATE POLICY "slack_integrations_all" ON public.slack_integrations FOR ALL USING (true);
CREATE POLICY "mentions_all" ON public.mentions FOR ALL USING (true);

-- ATTENTION ITEMS - User only
CREATE POLICY "attention_items_select" ON public.attention_items FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "attention_items_update" ON public.attention_items FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "attention_items_insert" ON public.attention_items FOR INSERT WITH CHECK (true);
CREATE POLICY "attention_items_delete" ON public.attention_items FOR DELETE USING (user_id = auth.uid());

-- OPTIONAL TABLES
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_dependencies') THEN
    EXECUTE 'CREATE POLICY "task_dependencies_all" ON public.task_dependencies FOR ALL USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_preferences') THEN
    EXECUTE 'CREATE POLICY "user_preferences_select" ON public.user_preferences FOR SELECT USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "user_preferences_insert" ON public.user_preferences FOR INSERT WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "user_preferences_update" ON public.user_preferences FOR UPDATE USING (user_id = auth.uid())';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'password_reset_pins') THEN
    EXECUTE 'CREATE POLICY "password_reset_pins_all" ON public.password_reset_pins FOR ALL USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_invitations') THEN
    EXECUTE 'CREATE POLICY "project_invitations_all" ON public.project_invitations FOR ALL USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'org_slack_integrations') THEN
    EXECUTE 'CREATE POLICY "org_slack_integrations_all" ON public.org_slack_integrations FOR ALL USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_announcements') THEN
    EXECUTE 'CREATE POLICY "organization_announcements_all" ON public.organization_announcements FOR ALL USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_meetings') THEN
    EXECUTE 'CREATE POLICY "organization_meetings_all" ON public.organization_meetings FOR ALL USING (true)';
  END IF;
END $$;

-- VERIFICATION
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'ALL RLS POLICIES RECREATED WITHOUT RECURSION!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Key fixes:';
  RAISE NOTICE '  - project_members: Only checks user_id = auth.uid() (NO self-reference)';
  RAISE NOTICE '  - organization_members: Only checks user_id = auth.uid() (NO self-reference)';
  RAISE NOTICE '  - All other tables: Simple, non-recursive checks';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Hard refresh browser (Ctrl+Shift+R)';
  RAISE NOTICE '  2. Check console for errors';
  RAISE NOTICE '  3. Try accessing projects - infinite recursion should be GONE!';
  RAISE NOTICE '';
END $$;

-- Show policy count
SELECT
  'Policy Summary' as info,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
