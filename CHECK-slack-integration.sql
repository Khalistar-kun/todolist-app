-- =====================================================
-- CHECK SLACK INTEGRATION CONFIGURATION
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

-- STEP 3: Check organization-level Slack configuration
SELECT
  '=== ORGANIZATION SLACK CONFIG ===' as section,
  si.id,
  si.organization_id,
  p.id as project_id,
  p.name as project_name,
  si.access_token IS NOT NULL as has_access_token,
  si.channel_id,
  si.channel_name,
  si.created_at
FROM organization_slack_integrations si
JOIN projects p ON p.organization_id = si.organization_id
WHERE p.id = '0afc2a12-1ca4-4555-8531-50faf687814c';

-- STEP 4: Check if organization_slack_integrations table exists
SELECT
  '=== ORG SLACK TABLE SCHEMA ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organization_slack_integrations'
ORDER BY ordinal_position;

-- STEP 5: Get project and organization info
SELECT
  '=== PROJECT INFO ===' as section,
  id,
  name,
  organization_id,
  created_at
FROM projects
WHERE id = '0afc2a12-1ca4-4555-8531-50faf687814c';

-- FINAL: Summary
DO $$
DECLARE
  v_has_project_slack BOOLEAN;
  v_has_org_slack BOOLEAN;
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

  -- Check org-level slack
  SELECT EXISTS(
    SELECT 1 FROM organization_slack_integrations si
    JOIN projects p ON p.organization_id = si.organization_id
    WHERE p.id = '0afc2a12-1ca4-4555-8531-50faf687814c'
      AND si.access_token IS NOT NULL
      AND si.channel_id IS NOT NULL
  ) INTO v_has_org_slack;

  IF v_has_org_slack THEN
    RAISE NOTICE '✅ Organization has Slack integration configured';
  ELSE
    RAISE NOTICE '❌ No organization-level Slack integration found';
  END IF;

  RAISE NOTICE '';
  IF NOT v_has_project_slack AND NOT v_has_org_slack THEN
    RAISE NOTICE '⚠️  NO SLACK INTEGRATION CONFIGURED';
    RAISE NOTICE '';
    RAISE NOTICE 'To fix this:';
    RAISE NOTICE '1. Go to Project Settings → Integrations → Slack';
    RAISE NOTICE '2. Connect your Slack workspace';
    RAISE NOTICE '3. Choose a channel for notifications';
    RAISE NOTICE '4. Enable notification types you want';
  END IF;
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
END $$;
