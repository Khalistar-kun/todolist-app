/**
 * Script to revert all Supabase table references from TODOAAPP schema back to public schema
 *
 * Usage: node revert-to-public-schema.js
 *
 * This will update all .from('TODOAAPP.table_name') calls to .from('table_name')
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

  // Update .from('TODOAAPP.table_name') to .from('table_name')
  tables.forEach(table => {
    // Pattern: .from('TODOAAPP.table_name') or .from("TODOAAPP.table_name")
    const pattern = new RegExp(`\\.from\\(['"](TODOAAPP\\.)?${table}['"]\\)`, 'g')
    const newValue = `.from('${table}')`

    if (content.match(pattern)) {
      content = content.replace(pattern, newValue)
      updated = true
    }
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
  console.log('🔄 Reverting schema references from TODOAAPP back to public...\n')

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
        console.log(`   ✅ Reverted: ${relativePath}`)
        totalUpdated++
      }
    })
  })

  console.log(`\n✨ Complete! Reverted ${totalUpdated} file(s)`)
  console.log('\n📋 Next steps:')
  console.log('   1. Review the changes with git diff')
  console.log('   2. Test your application')
  console.log('   3. Commit the changes if everything works')
}

main()
