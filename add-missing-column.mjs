import { readFileSync } from 'fs'

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
      console.error(`❌ ${label}:`, error)
      return false
    }

    console.log(`✅ ${label}`)
    return true
  } catch (error) {
    console.error(`❌ ${label}:`, error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Adding missing schema_markup column to blog_faqs\n')

  await runSQL(`
    ALTER TABLE public.blog_faqs
    ADD COLUMN IF NOT EXISTS schema_markup JSONB;
  `, 'Add schema_markup column')

  console.log('\n✅ Done!')
}

main()
