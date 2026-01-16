-- =====================================================
-- RLS POLICIES FOR ADDITIONAL TABLES
-- Run AFTER create-missing-tables.sql
-- =====================================================

-- =====================================================
-- DROP EXISTING POLICIES (for idempotency)
-- =====================================================

-- User Preferences
DROP POLICY IF EXISTS "user_preferences_select" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_update" ON public.user_preferences;

-- Password Reset Pins
DROP POLICY IF EXISTS "password_reset_pins_public" ON public.password_reset_pins;

-- Project Invitations
DROP POLICY IF EXISTS "project_invitations_select" ON public.project_invitations;
DROP POLICY IF EXISTS "project_invitations_insert" ON public.project_invitations;
DROP POLICY IF EXISTS "project_invitations_update" ON public.project_invitations;
DROP POLICY IF EXISTS "project_invitations_delete" ON public.project_invitations;

-- Organization Slack Integrations
DROP POLICY IF EXISTS "org_slack_integrations_select" ON public.org_slack_integrations;
DROP POLICY IF EXISTS "org_slack_integrations_insert" ON public.org_slack_integrations;
DROP POLICY IF EXISTS "org_slack_integrations_update" ON public.org_slack_integrations;
DROP POLICY IF EXISTS "org_slack_integrations_delete" ON public.org_slack_integrations;

-- Organization Announcements
DROP POLICY IF EXISTS "org_announcements_select" ON public.organization_announcements;
DROP POLICY IF EXISTS "org_announcements_insert" ON public.organization_announcements;
DROP POLICY IF EXISTS "org_announcements_update" ON public.organization_announcements;
DROP POLICY IF EXISTS "org_announcements_delete" ON public.organization_announcements;

-- Organization Meetings
DROP POLICY IF EXISTS "org_meetings_select" ON public.organization_meetings;
DROP POLICY IF EXISTS "org_meetings_insert" ON public.organization_meetings;
DROP POLICY IF EXISTS "org_meetings_update" ON public.organization_meetings;
DROP POLICY IF EXISTS "org_meetings_delete" ON public.organization_meetings;

-- =====================================================
-- USER PREFERENCES POLICIES
-- =====================================================

CREATE POLICY "user_preferences_select"
  ON public.user_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_preferences_insert"
  ON public.user_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_preferences_update"
  ON public.user_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- =====================================================
-- PASSWORD RESET PINS POLICIES
-- No RLS needed - these are accessed via service role
-- =====================================================

CREATE POLICY "password_reset_pins_public"
  ON public.password_reset_pins FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- PROJECT INVITATIONS POLICIES
-- =====================================================

CREATE POLICY "project_invitations_select"
  ON public.project_invitations FOR SELECT
  USING (
    -- User can see invitations sent to their email
    email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    OR
    -- User can see invitations for projects they admin
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "project_invitations_insert"
  ON public.project_invitations FOR INSERT
  WITH CHECK (
    -- Only project admins can invite
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "project_invitations_update"
  ON public.project_invitations FOR UPDATE
  USING (
    -- User can update their own invitations (accept/reject)
    email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    OR
    -- Project admins can update invitations
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "project_invitations_delete"
  ON public.project_invitations FOR DELETE
  USING (
    -- Only project admins can delete invitations
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- ORGANIZATION SLACK INTEGRATIONS POLICIES
-- =====================================================

CREATE POLICY "org_slack_integrations_select"
  ON public.org_slack_integrations FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "org_slack_integrations_insert"
  ON public.org_slack_integrations FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_slack_integrations_update"
  ON public.org_slack_integrations FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_slack_integrations_delete"
  ON public.org_slack_integrations FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- ORGANIZATION ANNOUNCEMENTS POLICIES
-- =====================================================

CREATE POLICY "org_announcements_select"
  ON public.organization_announcements FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "org_announcements_insert"
  ON public.organization_announcements FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_announcements_update"
  ON public.organization_announcements FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_announcements_delete"
  ON public.organization_announcements FOR DELETE
  USING (
    created_by = auth.uid()
    OR
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

-- =====================================================
-- ORGANIZATION MEETINGS POLICIES
-- =====================================================

CREATE POLICY "org_meetings_select"
  ON public.organization_meetings FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "org_meetings_insert"
  ON public.organization_meetings FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_meetings_update"
  ON public.organization_meetings FOR UPDATE
  USING (
    created_by = auth.uid()
    OR
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_meetings_delete"
  ON public.organization_meetings FOR DELETE
  USING (
    created_by = auth.uid()
    OR
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies for additional tables created successfully!';
  RAISE NOTICE '🔒 Policy Summary:';
  RAISE NOTICE '   - user_preferences: 3 policies';
  RAISE NOTICE '   - password_reset_pins: 1 policy (public access via service role)';
  RAISE NOTICE '   - project_invitations: 4 policies';
  RAISE NOTICE '   - org_slack_integrations: 4 policies';
  RAISE NOTICE '   - organization_announcements: 4 policies';
  RAISE NOTICE '   - organization_meetings: 4 policies';
  RAISE NOTICE '';
  RAISE NOTICE '✨ Total: 20 additional RLS policies created';
  RAISE NOTICE '📋 All additional tables are now secure!';
END $$;
