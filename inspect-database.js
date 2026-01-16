import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function inspectDatabase() {
  console.log('\n🔍 Detailed Database Inspection\n')
  console.log('═'.repeat(80))

  // Test basic connection
  console.log('\n📡 Testing Database Connection...\n')
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true })
      .limit(0)

    if (error) {
      console.log('❌ Connection failed:', error.message)
      console.log('   Error details:', JSON.stringify(error, null, 2))
    } else {
      console.log('✅ Database connection successful')
    }
  } catch (err) {
    console.log('❌ Connection error:', err.message)
  }

  // Check table columns and structure
  console.log('\n📋 Checking Table Structures...\n')
  console.log('─'.repeat(80))

  const tablesToCheck = [
    { name: 'profiles', key: 'id' },
    { name: 'organizations', key: 'id' },
    { name: 'projects', key: 'id' },
    { name: 'tasks', key: 'id' },
    { name: 'comments', key: 'id' },
    { name: 'activity_logs', key: 'id' },
    { name: 'notifications', key: 'id' },
    { name: 'task_assignments', key: 'id' },
    { name: 'slack_integrations', key: 'id' },
    { name: 'teams', key: 'id' },
    { name: 'mentions', key: 'id' },
    { name: 'attention_items', key: 'id' },
  ]

  for (const table of tablesToCheck) {
    try {
      // Try to select a single row to see the structure
      const { data, error } = await supabase
        .from(table.name)
        .select('*')
        .limit(1)

      if (error) {
        console.log(`❌ ${table.name.padEnd(25)} Error: ${error.message}`)
        console.log(`   Code: ${error.code}, Details: ${error.details || 'none'}`)
      } else {
        const rowCount = data.length
        const columns = rowCount > 0 ? Object.keys(data[0]).length : 'unknown'
        console.log(`✅ ${table.name.padEnd(25)} Rows: ${rowCount}, Columns: ${columns}`)

        if (rowCount > 0) {
          console.log(`   Sample columns: ${Object.keys(data[0]).slice(0, 5).join(', ')}...`)
        }
      }
    } catch (err) {
      console.log(`❌ ${table.name.padEnd(25)} Exception: ${err.message}`)
    }
  }

  // Check for RLS policies
  console.log('\n🔒 Checking Row Level Security (RLS)...\n')
  console.log('─'.repeat(80))

  // Try to query without authentication (should fail with RLS enabled)
  const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const testTables = ['profiles', 'tasks', 'organizations']

  for (const table of testTables) {
    try {
      const { data, error } = await anonClient
        .from(table)
        .select('*')
        .limit(1)

      if (error && error.code === 'PGRST301') {
        console.log(`✅ ${table.padEnd(25)} RLS is properly enabled`)
      } else if (error) {
        console.log(`⚠️  ${table.padEnd(25)} RLS check inconclusive: ${error.message}`)
      } else {
        console.log(`⚠️  ${table.padEnd(25)} RLS might be too permissive (got ${data.length} rows)`)
      }
    } catch (err) {
      console.log(`⚠️  ${table.padEnd(25)} Error checking RLS: ${err.message}`)
    }
  }

  // Check specific columns that might be problematic
  console.log('\n🔍 Checking Specific Column Issues...\n')
  console.log('─'.repeat(80))

  // Check if tasks table has all required Slack columns
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('slack_user_id, slack_user_name, created_by_slack, slack_thread_ts, slack_message_ts')
      .limit(1)

    if (error) {
      console.log('❌ Tasks table Slack columns:', error.message)
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('   ⚠️  Missing Slack integration columns - run safe-migration.sql')
      }
    } else {
      console.log('✅ Tasks table has all Slack columns')
    }
  } catch (err) {
    console.log('❌ Error checking tasks columns:', err.message)
  }

  // Check if tasks table has approval workflow columns
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('approval_status, approved_at, approved_by, moved_to_done_at, moved_to_done_by')
      .limit(1)

    if (error) {
      console.log('❌ Tasks table approval columns:', error.message)
    } else {
      console.log('✅ Tasks table has all approval workflow columns')
    }
  } catch (err) {
    console.log('❌ Error checking approval columns:', err.message)
  }

  // Check if teams are properly linked to projects
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('team_id')
      .limit(1)

    if (error) {
      console.log('❌ Projects table team_id column:', error.message)
    } else {
      console.log('✅ Projects table has team_id foreign key')
    }
  } catch (err) {
    console.log('❌ Error checking projects team_id:', err.message)
  }

  // Check notifications table for is_read column
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('is_read')
      .limit(1)

    if (error) {
      console.log('❌ Notifications table is_read column:', error.message)
      if (error.message.includes('column "read"')) {
        console.log('   ⚠️  Using reserved keyword "read" instead of "is_read"')
      }
    } else {
      console.log('✅ Notifications table uses correct is_read column')
    }
  } catch (err) {
    console.log('❌ Error checking notifications:', err.message)
  }

  console.log('\n═'.repeat(80))
  console.log('\n✨ Inspection complete!\n')
}

inspectDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Fatal error:', err)
    console.error('Stack:', err.stack)
    process.exit(1)
  })
