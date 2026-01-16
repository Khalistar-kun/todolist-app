import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function getSchema() {
  console.log('\n🔍 Getting activity_logs schema from information_schema...\n')

  // Query information_schema to get column names
  const query = `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_logs'
    ORDER BY ordinal_position;
  `

  try {
    const { data, error } = await supabase.rpc('exec', { sql: query })

    if (error) {
      console.log('❌ Error:', error.message)
      console.log('\nTrying alternative method...')

      // Alternative: Check if table exists and what we can infer
      const { data: tables } = await supabase.rpc('exec', {
        sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs'"
      })

      if (tables && tables.length > 0) {
        console.log('✅ Table exists in public schema')
      } else {
        console.log('⚠️  Table does not exist in public schema')
      }
    } else {
      console.log('✅ Columns in public.activity_logs:')
      data.forEach(col => {
        console.log(`   ${col.column_name} (${col.data_type})`)
      })
    }
  } catch (err) {
    console.log('❌ Exception:', err.message)
  }
}

getSchema().then(() => process.exit(0))
