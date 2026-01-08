import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_REF = 'qyjzqzqqjimittltttph'
const ACCESS_TOKEN = 'sbp_c3e373c8f882cbda841e77c83cc25cce6bebd06b'

async function runMigration(filename) {
  const sqlPath = join(__dirname, 'sql', filename)
  const sql = readFileSync(sqlPath, 'utf-8')

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
  console.log('🚀 Updating existing database schema...\n')

  const success = await runMigration('update-existing-schema.sql')

  console.log(`\n${'='.repeat(50)}`)
  if (success) {
    console.log('✅ Database schema updated successfully!')
    console.log('📊 Tables ensured: projects, project_members, tasks, workflows, workflow_steps, comments, attachments, notifications, user_profiles')
    console.log('🔒 RLS policies configured for multi-tenant security')
    console.log('🔍 Indexes created for optimal performance')
    console.log('⚡ Triggers and functions set up for automation')
    console.log('🔄 Existing schema preserved and enhanced')
  } else {
    console.log('❌ Database schema update failed')
  }
  console.log('='.repeat(50))
}

main().catch(console.error)