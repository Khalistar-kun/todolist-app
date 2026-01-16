import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_REF = 'qyjzqzqqjimittltttph'
const ACCESS_TOKEN = 'sbp_c3e373c8f882cbda841e77c83cc25cce6bebd06b'

async function runMigration(filepath, filename) {
  const sql = readFileSync(filepath, 'utf-8')

  console.log(`\n📄 Running: ${filename}`)
  console.log(`📝 SQL file size: ${sql.length} characters`)

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error(`   ❌ Failed: ${error}`)
      return false
    }

    const result = await response.json()
    console.log(`   ✅ Success`)
    return true
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`)
    return false
  }
}

async function main() {
  console.log('🚀 Running ALL database migrations from supabase/migrations...\n')

  const migrationsDir = join(__dirname, 'supabase', 'migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort() // Sort to ensure migrations run in order

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
      console.log('\n⚠️  Migration failed. Stopping execution to prevent cascading errors.')
      break
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Successful migrations: ${success}`)
  console.log(`❌ Failed migrations: ${failed}`)
  console.log('='.repeat(60))

  if (failed === 0) {
    console.log('\n🎉 All migrations completed successfully!')
    console.log('📊 Your database is now fully set up and ready to use.')
  } else {
    console.log('\n⚠️  Some migrations failed. Check the errors above.')
    console.log('💡 You may need to fix the failed migration and re-run.')
  }
}

main().catch(console.error)
