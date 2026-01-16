import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const tables = [
  'organizations',
  'attachments',
  'time_entries',
  'activity_logs',
  'project_members'
]

async function checkColumns() {
  console.log('\n🔍 Checking table columns in public schema...\n')

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        console.log(`❌ ${table}: ${error.message}`)
      } else if (data && data.length > 0) {
        console.log(`✅ ${table}:`)
        console.log(`   ${Object.keys(data[0]).join(', ')}`)
      } else {
        console.log(`⚠️  ${table}: No data (table empty)`)
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`)
    }
    console.log()
  }
}

checkColumns().then(() => process.exit(0))
