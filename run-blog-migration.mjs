import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_REF = 'qyjzqzqqjimittltttph'
const ACCESS_TOKEN = 'sbp_c3e373c8f882cbda841e77c83cc25cce6bebd06b'

async function runSQL(sql, label) {
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
      console.error(`   ❌ ${label}: ${error}`)
      return false
    }

    console.log(`   ✅ ${label}`)
    return true
  } catch (error) {
    console.error(`   ❌ ${label}: ${error.message}`)
    return false
  }
}

async function main() {
  const sqlPath = join(__dirname, 'sql', 'blog-schema.sql')
  const fullSQL = readFileSync(sqlPath, 'utf-8')

  // Split by semicolons and filter out comments and empty statements
  const statements = fullSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== '')

  console.log(`🚀 Running blog-schema.sql (${statements.length} statements)\n`)

  let success = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    // Skip pure comment blocks
    if (statement.match(/^\/\*.*\*\/$/s)) {
      skipped++
      continue
    }

    const preview = statement.substring(0, 60).replace(/\s+/g, ' ')
    const label = `[${i + 1}/${statements.length}] ${preview}...`

    const result = await runSQL(statement + ';', label)
    if (result) {
      success++
    } else {
      // Check if it's an "already exists" error
      failed++
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Success: ${success}`)
  console.log(`⏭️  Skipped: ${skipped}`)
  console.log(`❌ Failed: ${failed}`)
  console.log('='.repeat(60))
}

main()
