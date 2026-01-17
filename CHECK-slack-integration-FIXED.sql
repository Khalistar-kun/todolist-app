-- =====================================================
-- CHECK SLACK INTEGRATION CONFIGURATION (FIXED)
-- Handles missing organization_slack_integrations table
-- =====================================================

-- STEP 1: Check if slack_integrations table exists
SELECT
  '=== SLACK_INTEGRATIONS TABLE SCHEMA ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'slack_integrations'
ORDER BY ordinal_position;

-- STEP 2: Check project-level Slack configuration
SELECT
  '=== PROJECT SLACK CONFIG ===' as section,
  id,
  project_id,
  access_token IS NOT NULL as has_access_token,
  webhook_url IS NOT NULL as has_webhook_url,
  channel_id,
  channel_name,
  notify_on_task_create,
  notify_on_task_update,
  notify_on_task_delete,
  notify_on_task_move,
  notify_on_task_complete,
  created_at
FROM slack_integrations
WHERE project_id = '0afc2a12-1ca4-4555-8531-50faf687814c';

-- STEP 3: Get project info
SELECT
  '=== PROJECT INFO ===' as section,
  id,
  name,
  organization_id,
  created_at
FROM projects
WHERE id = '0afc2a12-1ca4-4555-8531-50faf687814c';

-- STEP 4: Check if organization_slack_integrations table exists
DO $$
DECLARE
  v_table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organization_slack_integrations'
  ) INTO v_table_exists;

  IF v_table_exists THEN
    RAISE NOTICE 'ℹ️  organization_slack_integrations table exists';
  ELSE
    RAISE NOTICE '⚠️  organization_slack_integrations table does NOT exist';
    RAISE NOTICE '   Only project-level Slack integration is available';
  END IF;
END $$;

-- STEP 5: If org table exists, check it
DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_has_org_slack BOOLEAN;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organization_slack_integrations'
  ) INTO v_table_exists;

  IF v_table_exists THEN
    -- Table exists, check for config
    EXECUTE format('
      SELECT EXISTS (
        SELECT 1 FROM organization_slack_integrations si
        JOIN projects p ON p.organization_id = si.organization_id
        WHERE p.id = %L
          AND si.access_token IS NOT NULL
          AND si.channel_id IS NOT NULL
      )', '0afc2a12-1ca4-4555-8531-50faf687814c')
    INTO v_has_org_slack;

    IF v_has_org_slack THEN
      RAISE NOTICE '✅ Organization has Slack integration configured';

      -- Show the config
      RAISE NOTICE '=== ORGANIZATION SLACK CONFIG ===';
      FOR v_table_exists IN
        EXECUTE format('
          SELECT si.id, si.organization_id, si.channel_id, si.channel_name
          FROM organization_slack_integrations si
          JOIN projects p ON p.organization_id = si.organization_id
          WHERE p.id = %L', '0afc2a12-1ca4-4555-8531-50faf687814c')
      LOOP
        NULL;  -- Config will be displayed by the query
      END LOOP;
    ELSE
      RAISE NOTICE '❌ No organization-level Slack integration found';
    END IF;
  END IF;
END $$;

-- FINAL: Summary
DO $$
DECLARE
  v_has_project_slack BOOLEAN;
  v_table_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'SLACK INTEGRATION DIAGNOSTIC SUMMARY';
  RAISE NOTICE '============================================================';

  -- Check project-level slack
  SELECT EXISTS(
    SELECT 1 FROM slack_integrations
    WHERE project_id = '0afc2a12-1ca4-4555-8531-50faf687814c'
      AND access_token IS NOT NULL
      AND channel_id IS NOT NULL
  ) INTO v_has_project_slack;

  IF v_has_project_slack THEN
    RAISE NOTICE '✅ Project has Slack integration configured';
  ELSE
    RAISE NOTICE '❌ No project-level Slack integration found';
  END IF;

  -- Check if org table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organization_slack_integrations'
  ) INTO v_table_exists;

  RAISE NOTICE '';
  IF NOT v_has_project_slack THEN
    RAISE NOTICE '⚠️  NO SLACK INTEGRATION CONFIGURED FOR THIS PROJECT';
    RAISE NOTICE '';
    RAISE NOTICE 'To set up Slack notifications:';
    RAISE NOTICE '1. Go to your Slack workspace';
    RAISE NOTICE '2. Create a Slack app at https://api.slack.com/apps';
    RAISE NOTICE '3. Add OAuth scopes: chat:write, channels:read';
    RAISE NOTICE '4. Install app to workspace and get OAuth token';
    RAISE NOTICE '5. Insert into database:';
    RAISE NOTICE '';
    RAISE NOTICE 'INSERT INTO slack_integrations (';
    RAISE NOTICE '  project_id, access_token, channel_id, channel_name,';
    RAISE NOTICE '  notify_on_task_create, notify_on_task_update';
    RAISE NOTICE ') VALUES (';
    RAISE NOTICE '  ''0afc2a12-1ca4-4555-8531-50faf687814c'',';
    RAISE NOTICE '  ''xoxb-your-oauth-token'',';
    RAISE NOTICE '  ''C01234567'',  -- Channel ID from Slack';
    RAISE NOTICE '  ''general'',    -- Channel name';
    RAISE NOTICE '  true, true      -- Enable notifications';
    RAISE NOTICE ');';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✅ Slack is configured! Notifications should work.';
    RAISE NOTICE '';
    RAISE NOTICE 'If notifications are not appearing in Slack:';
    RAISE NOTICE '1. Check that the access_token is valid';
    RAISE NOTICE '2. Verify the channel_id is correct';
    RAISE NOTICE '3. Ensure notification flags are enabled';
    RAISE NOTICE '4. Check server logs for Slack API errors';
  END IF;

  IF NOT v_table_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE 'ℹ️  Note: Organization-level Slack integration is not set up.';
    RAISE NOTICE '   Only project-level integration is available.';
  END IF;

  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
END $$;
