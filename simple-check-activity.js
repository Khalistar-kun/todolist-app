import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function check() {
  // Try to select with specific columns
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, project_id, task_id, user_id, action, entity_type, entity_id, old_values, new_values, created_at')
    .limit(1)

  if (error) {
    console.log('\n❌ Error selecting from activity_logs:')
    console.log(error.message)
    console.log('\nThis suggests the table might not exist or columns are different.')
  } else {
    console.log('\n✅ Successfully queried activity_logs table')
    console.log('Columns exist: id, project_id, task_id, user_id, action, entity_type, entity_id, old_values, new_values, created_at')
  }
}

check().then(() => process.exit(0))
