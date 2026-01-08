import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_REF = 'qyjzqzqqjimittltttph'
const ACCESS_TOKEN = 'sbp_c3e373c8f882cbda841e77c83cc25cce6bebd06b'

async function runSQL(sql) {
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
      console.error(`❌ Failed:`, error)
      return false
    }

    console.log(`✅ Success`)
    return true
  } catch (error) {
    console.error(`❌ Error:`, error.message)
    return false
  }
}

async function main() {
  const sqlPath = join(__dirname, 'sql', 'fix-blog-schema.sql')
  const sql = readFileSync(sqlPath, 'utf-8')

  console.log('🚀 Running fix-blog-schema.sql\n')

  await runSQL(sql)
}

main()
