import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function listTodoaappTables() {
  console.log('\n📊 Querying TODOAAPP schema tables...\n')

  // Query information_schema for all tables in TODOAAPP schema
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns c
         WHERE c.table_schema = 'TODOAAPP' AND c.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'TODOAAPP'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
  })

  if (error) {
    // Fallback: Try direct fetch to Supabase API
    console.log('⚠️  RPC method not available, trying alternative...\n')

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/pg_tables`,
      {
        method: 'GET',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        }
      }
    )

    if (!response.ok) {
      console.log('❌ Cannot query schema. Listing expected tables from schema file:\n')

      const expectedTables = [
        'profiles',
        'organizations',
        'organization_members',
        'teams',
        'team_members',
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
        'mentions',
        'attention_items'
      ]

      console.log('Expected tables in TODOAAPP schema:')
      expectedTables.forEach((table, index) => {
        console.log(`  ${(index + 1).toString().padStart(2)}. ${table}`)
      })
      console.log(`\nTotal: ${expectedTables.length} tables`)
      console.log('\n💡 To verify actual tables exist, run the migration scripts in Supabase SQL Editor.')
      return
    }
  }

  if (data && data.length > 0) {
    console.log('✅ Tables found in TODOAAPP schema:\n')
    data.forEach((row, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${row.table_name.padEnd(25)} (${row.column_count} columns)`)
    })
    console.log(`\n📈 Total: ${data.length} tables`)
  } else {
    console.log('⚠️  No tables found in TODOAAPP schema.')
    console.log('\n💡 You may need to run create-todoaapp-schema.sql first.')
  }
}

listTodoaappTables()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })
