/**
 * Script to update all Supabase table references from public schema to TODOAAPP schema
 *
 * Usage: node update-schema-references.js
 *
 * This will update all .from('table_name') calls to .from('TODOAAPP.table_name')
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Tables to update
const tables = [
  'profiles',
  'organizations',
  'organization_members',
  'teams',
  'team_members',
  'projects',
  'project_members',
  'tasks',
  'task_assignments',
  'subtasks',
  'comments',
  'attachments',
  'time_entries',
  'activity_logs',
  'notifications',
  'webhooks',
  'slack_integrations',
  'mentions',
  'attention_items',
]

// Directories to search
const dirsToSearch = [
  path.join(__dirname, 'app', 'api'),
  path.join(__dirname, 'lib'),
]

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  let updated = false

  // Update .from('table_name') to .from('TODOAAPP.table_name')
  tables.forEach(table => {
    // Pattern 1: .from('table_name')
    const pattern1 = new RegExp(`\\.from\\(['"]${table}['"]\\)`, 'g')
    if (pattern1.test(content)) {
      content = content.replace(pattern1, `.from('TODOAAPP.${table}')`)
      updated = true
    }

    // Pattern 2: .from("table_name")
    const pattern2 = new RegExp(`\\.from\\(["']${table}["']\\)`, 'g')
    if (pattern2.test(content)) {
      content = content.replace(pattern2, `.from('TODOAAPP.${table}')`)
      updated = true
    }

    // Skip if already has TODOAAPP prefix
    content = content.replace(new RegExp(`TODOAAPP\\.TODOAAPP\\.${table}`, 'g'), `TODOAAPP.${table}`)
  })

  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8')
    return true
  }
  return false
}

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir)

  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (file !== 'node_modules' && file !== '.next') {
        walkDir(filePath, fileList)
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath)
    }
  })

  return fileList
}

function main() {
  console.log('🔍 Updating schema references from public to TODOAAPP...\n')

  let totalUpdated = 0

  dirsToSearch.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`⚠️  Directory not found: ${dir}`)
      return
    }

    console.log(`📁 Scanning: ${dir}`)
    const files = walkDir(dir)

    files.forEach(file => {
      if (updateFile(file)) {
        const relativePath = path.relative(__dirname, file)
        console.log(`   ✅ Updated: ${relativePath}`)
        totalUpdated++
      }
    })
  })

  console.log(`\n✨ Complete! Updated ${totalUpdated} file(s)`)
  console.log('\n📋 Next steps:')
  console.log('   1. Review the changes with git diff')
  console.log('   2. Run your TypeScript compiler to check for errors')
  console.log('   3. Test your API endpoints')
  console.log('   4. Commit the changes')
}

main()
