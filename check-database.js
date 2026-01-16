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

async function checkDatabase() {
  console.log('\n🔍 Checking Supabase Database Tables...\n')

  // List of tables we expect to have
  const expectedTables = [
    'profiles',
    'organizations',
    'organization_members',
    'projects',
    'project_members',
    'tasks',
    'task_assignments',
    'subtasks',
    'comments',
    'attachments',
    'time_entries',
    'activity_logs',
    'notifications',
    'webhooks',
    'slack_integrations',
    'teams',
    'team_members',
    'mentions',
    'attention_items',
  ]

  console.log('Expected tables:', expectedTables.length)
  console.log('─'.repeat(60))

  const results = []

  for (const table of expectedTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count', { count: 'exact', head: true })
        .limit(0)

      if (error) {
        results.push({ table, status: '❌', message: error.message })
      } else {
        results.push({ table, status: '✅', message: 'Table exists' })
      }
    } catch (err) {
      results.push({ table, status: '❌', message: err.message })
    }
  }

  // Print results
  const existingTables = results.filter(r => r.status === '✅')
  const missingTables = results.filter(r => r.status === '❌')

  console.log('\n📊 Results:\n')
  results.forEach(({ table, status, message }) => {
    console.log(`${status} ${table.padEnd(25)} ${message}`)
  })

  console.log('\n' + '─'.repeat(60))
  console.log(`\n✅ Existing: ${existingTables.length}/${expectedTables.length}`)
  console.log(`❌ Missing:  ${missingTables.length}/${expectedTables.length}\n`)

  if (missingTables.length > 0) {
    console.log('⚠️  Missing tables:')
    missingTables.forEach(({ table }) => {
      console.log(`   - ${table}`)
    })
    console.log('\n💡 Run safe-migration.sql in Supabase SQL Editor to create them.\n')
  } else {
    console.log('🎉 All tables exist!\n')
  }

  // Check for enum types
  console.log('\n🔍 Checking Enum Types...\n')

  const enumTypes = [
    'task_priority',
    'task_status',
    'project_role',
    'notification_type',
    'webhook_event',
    'attention_type',
    'attention_priority',
  ]

  try {
    const { data: types, error } = await supabase.rpc('check_enum_types', {
      type_names: enumTypes
    }).catch(() => ({ data: null, error: 'Function not available' }))

    if (error || !types) {
      console.log('ℹ️  Cannot check enum types (requires custom function)')
      console.log('   Expected enum types:', enumTypes.join(', '))
    }
  } catch (err) {
    console.log('ℹ️  Enum type check skipped\n')
  }
}

checkDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
