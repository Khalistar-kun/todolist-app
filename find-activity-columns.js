import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Try different column combinations
const columnSets = [
  ['id', 'created_at'],
  ['id', 'project_id', 'task_id', 'user_id', 'action', 'created_at'],
  ['id', 'project_id', 'task_id', 'user_id', 'action', 'old_values', 'new_values', 'created_at'],
  ['id', 'project_id', 'task_id', 'user_id', 'action', 'changes', 'created_at'],
]

async function findColumns() {
  console.log('\n🔍 Testing different column combinations...\n')

  for (const cols of columnSets) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(cols.join(', '))
      .limit(1)

    if (!error) {
      console.log(`✅ FOUND! Columns that work:`)
      console.log(`   ${cols.join(', ')}`)
      return
    }
  }

  // If all fail, try wildcard
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .limit(1)

  if (error) {
    console.log(`❌ Table might not exist: ${error.message}`)
  } else if (data && data.length > 0) {
    console.log(`✅ Actual columns in activity_logs:`)
    console.log(`   ${Object.keys(data[0]).join(', ')}`)
  } else {
    console.log(`⚠️  Table exists but is empty, cannot determine columns`)
  }
}

findColumns().then(() => process.exit(0))
