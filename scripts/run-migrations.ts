import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

// Migrations to run in order (excluding base schema which should already exist)
const migrations = [
  'add_avatar_system.sql',
  'add_slack_fields_to_tasks.sql',
  'blog-schema.sql',
  'add_workflow_rules.sql'
]

async function runMigration(filename: string): Promise<boolean> {
  const filePath = path.join(process.cwd(), 'sql', filename)

  console.log(`\n📄 Running migration: ${filename}`)

  if (!fs.existsSync(filePath)) {
    console.error(`   ❌ File not found: ${filePath}`)
    return false
  }

  const sql = fs.readFileSync(filePath, 'utf-8')

  // Split SQL into individual statements (simple split on semicolon)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`   Found ${statements.length} SQL statements`)

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    // Skip comments
    if (statement.startsWith('--') || statement.startsWith('/*')) {
      continue
    }

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement })

      if (error) {
        // Check if error is about already existing objects (which is okay)
        if (
          error.message.includes('already exists') ||
          error.message.includes('duplicate key value')
        ) {
          console.log(`   ⚠️  Statement ${i + 1}: Already exists (skipping)`)
          successCount++
        } else {
          console.error(`   ❌ Statement ${i + 1} failed:`, error.message)
          failCount++
        }
      } else {
        successCount++
      }
    } catch (err: any) {
      console.error(`   ❌ Statement ${i + 1} error:`, err.message)
      failCount++
    }
  }

  console.log(`   ✅ Success: ${successCount}/${statements.length}`)
  if (failCount > 0) {
    console.log(`   ⚠️  Failed: ${failCount}/${statements.length}`)
  }

  return failCount === 0
}

async function main() {
  console.log('🚀 Starting database migrations...\n')
  console.log('📍 Supabase URL:', supabaseUrl)
  console.log('📍 Using service role key\n')

  let successfulMigrations = 0
  let failedMigrations = 0

  for (const migration of migrations) {
    const success = await runMigration(migration)
    if (success) {
      successfulMigrations++
    } else {
      failedMigrations++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Migration Summary:')
  console.log('   ✅ Successful:', successfulMigrations)
  console.log('   ❌ Failed:', failedMigrations)
  console.log('='.repeat(60))

  if (failedMigrations === 0) {
    console.log('\n🎉 All migrations completed successfully!')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some migrations failed. Please check the errors above.')
    process.exit(1)
  }
}

main()
