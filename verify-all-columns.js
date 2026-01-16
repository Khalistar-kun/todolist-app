import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Expected columns for each table based on migrations
const expectedColumns = {
  profiles: ['id', 'email', 'full_name', 'avatar_url', 'bio', 'phone', 'timezone', 'language', 'notification_preferences', 'created_at', 'updated_at'],
  organizations: ['id', 'name', 'slug', 'description', 'logo_url', 'website', 'created_by', 'created_at', 'updated_at'],
  organization_members: ['id', 'organization_id', 'user_id', 'role', 'joined_at'],
  projects: ['id', 'name', 'description', 'organization_id', 'color', 'status', 'created_by', 'team_id', 'created_at', 'updated_at'],
  project_members: ['id', 'project_id', 'user_id', 'role', 'joined_at'],
  tasks: ['id', 'title', 'description', 'project_id', 'status', 'priority', 'stage_id', 'position', 'assigned_to', 'created_by', 'updated_by', 'due_date', 'start_date', 'completed_at', 'estimated_hours', 'actual_hours', 'tags', 'approval_status', 'approved_at', 'approved_by', 'rejection_reason', 'moved_to_done_at', 'moved_to_done_by', 'slack_thread_ts', 'slack_message_ts', 'slack_user_id', 'slack_user_name', 'created_by_slack', 'created_at', 'updated_at'],
  subtasks: ['id', 'task_id', 'title', 'completed', 'position', 'due_date', 'assigned_to', 'created_at', 'updated_at'],
  comments: ['id', 'task_id', 'content', 'created_by', 'project_id', 'created_at', 'updated_at'],
  attachments: ['id', 'task_id', 'comment_id', 'file_name', 'file_url', 'file_size', 'file_type', 'uploaded_by', 'created_at'],
  time_entries: ['id', 'task_id', 'user_id', 'start_time', 'end_time', 'duration', 'description', 'created_at'],
  activity_logs: ['id', 'project_id', 'task_id', 'user_id', 'action', 'entity_type', 'entity_id', 'changes', 'created_at'],
  notifications: ['id', 'user_id', 'type', 'title', 'message', 'data', 'is_read', 'created_at'],
  task_assignments: ['id', 'task_id', 'user_id', 'assigned_by', 'assigned_at'],
  webhooks: ['id', 'project_id', 'url', 'events', 'secret', 'enabled', 'created_at'],
  slack_integrations: ['id', 'project_id', 'webhook_url', 'channel_name', 'notify_on_task_create', 'notify_on_task_update', 'notify_on_task_delete', 'notify_on_task_move', 'notify_on_task_complete', 'created_by', 'created_at', 'updated_at'],
  teams: ['id', 'organization_id', 'name', 'description', 'color', 'image_url', 'created_by', 'created_at', 'updated_at'],
  team_members: ['id', 'team_id', 'user_id', 'role', 'joined_at'],
  mentions: ['id', 'mentioned_user_id', 'mentioner_user_id', 'task_id', 'comment_id', 'project_id', 'mention_context', 'created_at', 'read_at'],
  attention_items: ['id', 'user_id', 'attention_type', 'priority', 'task_id', 'comment_id', 'mention_id', 'project_id', 'actor_user_id', 'title', 'body', 'read_at', 'dismissed_at', 'actioned_at', 'dedup_key', 'created_at', 'updated_at'],
}

async function verifyColumns() {
  console.log('\n🔍 Verifying All Table Columns\n')
  console.log('═'.repeat(80))

  for (const [tableName, expected] of Object.entries(expectedColumns)) {
    try {
      // Query to get actual columns
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0)

      if (error) {
        console.log(`\n❌ ${tableName}`)
        console.log(`   Error: ${error.message}`)
        continue
      }

      // Get actual columns from the query metadata
      const { data: sampleData } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)

      const actualColumns = sampleData && sampleData.length > 0
        ? Object.keys(sampleData[0])
        : []

      // Compare
      const missing = expected.filter(col => !actualColumns.includes(col))
      const extra = actualColumns.filter(col => !expected.includes(col))

      if (missing.length === 0 && extra.length === 0) {
        console.log(`\n✅ ${tableName}`)
        console.log(`   All ${expected.length} columns present`)
      } else {
        console.log(`\n⚠️  ${tableName}`)
        console.log(`   Expected: ${expected.length} columns`)
        console.log(`   Found: ${actualColumns.length} columns`)

        if (missing.length > 0) {
          console.log(`   Missing: ${missing.join(', ')}`)
        }
        if (extra.length > 0) {
          console.log(`   Extra: ${extra.join(', ')}`)
        }
      }

      // Show actual columns for reference
      if (actualColumns.length > 0) {
        console.log(`   Columns: ${actualColumns.join(', ')}`)
      }

    } catch (err) {
      console.log(`\n❌ ${tableName}`)
      console.log(`   Exception: ${err.message}`)
    }
  }

  console.log('\n' + '═'.repeat(80))
  console.log('\n✨ Verification complete!\n')
}

verifyColumns()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Fatal error:', err)
    process.exit(1)
  })
