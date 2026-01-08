import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_REF = 'qyjzqzqqjimittltttph'
const ACCESS_TOKEN = 'sbp_c3e373c8f882cbda841e77c83cc25cce6bebd06b'

const migrations = [
  'add_avatar_system.sql',
  'add_slack_fields_to_tasks.sql',
  'blog-schema.sql',
  'add_workflow_rules.sql',
]

async function runMigration(filename) {
  const sqlPath = join(__dirname, 'sql', filename)
  const sql = readFileSync(sqlPath, 'utf-8')

  console.log(`\n📄 Running: ${filename}`)

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
  console.log('🚀 Running database migrations...\n')

  let success = 0
  let failed = 0

  for (const migration of migrations) {
    const result = await runMigration(migration)
    if (result) success++
    else failed++
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`✅ Success: ${success}`)
  console.log(`❌ Failed: ${failed}`)
  console.log('='.repeat(50))
}

main()
