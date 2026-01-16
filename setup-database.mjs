import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration(filepath, filename) {
  const sql = readFileSync(filepath, 'utf-8')

  console.log(`\n📄 Running: ${filename}`)
  console.log(`📝 SQL file size: ${sql.length} characters`)

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // If exec_sql doesn't exist, try direct query
      const { error: queryError } = await supabase.from('_raw_query').select(sql)
      if (queryError) {
        console.error(`   ❌ Failed: ${queryError.message}`)
        return false
      }
    }

    console.log(`   ✅ Success`)
    return true
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`)
    return false
  }
}

async function main() {
  console.log('🚀 Setting up database using Supabase client...\n')
  console.log(`📡 Connected to: ${supabaseUrl}\n`)

  const migrationsDir = join(__dirname, 'supabase', 'migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  console.log(`Found ${files.length} migration files\n`)

  let success = 0
  let failed = 0

  for (const file of files) {
    const filepath = join(migrationsDir, file)
    const result = await runMigration(filepath, file)
    if (result) {
      success++
    } else {
      failed++
      console.log('\n⚠️  Migration failed. Continuing with next migration...')
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Successful migrations: ${success}`)
  console.log(`❌ Failed migrations: ${failed}`)
  console.log('='.repeat(60))

  if (failed === 0) {
    console.log('\n🎉 All migrations completed successfully!')
  } else {
    console.log('\n⚠️  Some migrations failed. Your database may be partially set up.')
    console.log('💡 You may need to apply migrations manually in Supabase SQL Editor.')
  }
}

main().catch(console.error)
