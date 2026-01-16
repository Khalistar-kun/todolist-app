import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function checkActivityLogs() {
  console.log('\n🔍 Checking activity_logs columns...\n')

  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .limit(1)

  if (error) {
    console.log(`❌ Error: ${error.message}`)
  } else if (data && data.length > 0) {
    console.log('✅ Columns in public.activity_logs:')
    console.log(Object.keys(data[0]).join(', '))
  } else {
    console.log('⚠️  No data in activity_logs (empty table)')
    console.log('Cannot determine columns from empty table')
  }
}

checkActivityLogs().then(() => process.exit(0))
