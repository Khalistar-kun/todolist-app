import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function checkColumns() {
  try {
    // Get one row to see what columns exist
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .limit(1)

    if (error) {
      console.error('Error:', error.message)
      return
    }

    if (data && data.length > 0) {
      console.log('\n✅ Organizations table columns:')
      console.log(Object.keys(data[0]).join(', '))
    } else {
      console.log('\n⚠️  No organizations found. Checking schema...')
    }
  } catch (err) {
    console.error('Exception:', err.message)
  }
}

checkColumns().then(() => process.exit(0))
