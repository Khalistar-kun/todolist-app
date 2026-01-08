/**
 * Slack Integration Test Script
 *
 * This script tests the Slack webhook integration without needing the full app
 * Run with: npx tsx test-slack.ts
 */

import { createClient } from '@supabase/supabase-js'

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing environment variables!')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

if (!TEST_PROJECT_ID) {
  console.error('Missing TEST_PROJECT_ID environment variable!')
  console.error('Please set TEST_PROJECT_ID to your project UUID')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Slack message helpers
async function sendSlackMessage(webhookUrl: string, text: string, blocks?: any[]) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, blocks }),
  })

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${await response.text()}`)
  }

  return response.text()
}

async function testSlackConfig() {
  console.log('\n📋 Test 1: Fetching Slack Configuration')
  console.log('━'.repeat(50))

  const { data, error } = await supabase
    .from('slack_integrations')
    .select('webhook_url, channel_name')
    .eq('project_id', TEST_PROJECT_ID)
    .single()

  if (error || !data) {
    console.error('❌ Failed to fetch Slack config:', error?.message)
    return null
  }

  console.log('✅ Slack config found')
  console.log('   Channel:', data.channel_name || 'N/A')
  console.log('   Webhook:', data.webhook_url.substring(0, 50) + '...')

  return data
}

async function testTaskCreatedNotification(webhookUrl: string) {
  console.log('\n🆕 Test 2: Task Created Notification')
  console.log('━'.repeat(50))

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🆕 New Task Created',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Test Task from Integration Script*\n\n*Description:* This is a test notification from the Slack integration test script\n*Status:* ⏳ TODO\n*Assignees:* test@example.com\n*Due:* ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
      },
    },
  ]

  try {
    await sendSlackMessage(webhookUrl, '🆕 New task: Test Task from Integration Script', blocks)
    console.log('✅ Task created notification sent successfully')
  } catch (error) {
    console.error('❌ Failed to send notification:', error)
  }
}

async function testTaskUpdatedNotification(webhookUrl: string) {
  console.log('\n✏️ Test 3: Task Updated Notification')
  console.log('━'.repeat(50))

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '✏️ Task Updated',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Test Task from Integration Script*\n\n*Status:* ⏳ todo → 🔄 in progress\n*Description:* Updated description for testing`,
      },
    },
  ]

  try {
    await sendSlackMessage(webhookUrl, '✏️ Task updated: Test Task from Integration Script', blocks)
    console.log('✅ Task updated notification sent successfully')
  } catch (error) {
    console.error('❌ Failed to send notification:', error)
  }
}

async function testStatusChangedNotification(webhookUrl: string) {
  console.log('\n📋 Test 4: Status Changed Notification')
  console.log('━'.repeat(50))

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📋 Task Moved to DONE',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Test Task from Integration Script*\n\n🔄 in progress → ✅ done`,
      },
    },
  ]

  try {
    await sendSlackMessage(webhookUrl, '📋 Task moved to done: Test Task from Integration Script', blocks)
    console.log('✅ Status changed notification sent successfully')
  } catch (error) {
    console.error('❌ Failed to send notification:', error)
  }
}

async function testTaskDeletedNotification(webhookUrl: string) {
  console.log('\n🗑️ Test 5: Task Deleted Notification')
  console.log('━'.repeat(50))

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🗑️ Task Deleted',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Test Task from Integration Script*\n\nThis task has been deleted.`,
      },
    },
  ]

  try {
    await sendSlackMessage(webhookUrl, '🗑️ Task deleted: Test Task from Integration Script', blocks)
    console.log('✅ Task deleted notification sent successfully')
  } catch (error) {
    console.error('❌ Failed to send notification:', error)
  }
}

async function testThreading(webhookUrl: string) {
  console.log('\n🧵 Test 6: Threading Logic')
  console.log('━'.repeat(50))

  console.log('Sending initial message...')
  const blocks1 = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Initial Message* - This should start a new thread',
      },
    },
  ]

  try {
    await sendSlackMessage(webhookUrl, 'Initial Message', blocks1)
    console.log('✅ Initial message sent')

    console.log('\n⏳ Simulating same-day update...')
    console.log('   (Note: Webhooks don\'t return thread_ts, so this is a demonstration)')
    console.log('   In the app, same-day updates will use the stored thread_ts')

    const blocks2 = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Follow-up Message* - In the app, this would be threaded if same day',
        },
      },
    ]

    await sendSlackMessage(webhookUrl, 'Follow-up Message', blocks2)
    console.log('✅ Follow-up message sent')

    console.log('\n💡 Note: To test threading in the app:')
    console.log('   1. Create a task (gets initial slack_thread_ts)')
    console.log('   2. Update it within the same day (uses thread_ts)')
    console.log('   3. Check Slack - update should appear as reply')
  } catch (error) {
    console.error('❌ Failed to test threading:', error)
  }
}

async function testDatabaseFields() {
  console.log('\n🗄️ Test 7: Database Schema Verification')
  console.log('━'.repeat(50))

  try {
    // Try to query tasks with Slack fields
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, slack_thread_ts, slack_message_ts')
      .eq('project_id', TEST_PROJECT_ID)
      .limit(1)

    if (error) {
      console.error('❌ Failed to query Slack fields:', error.message)
      console.log('\n⚠️  You may need to run the migration:')
      console.log('   sql/add_slack_fields_to_tasks.sql')
      return
    }

    console.log('✅ Slack fields exist in tasks table')

    if (data && data.length > 0) {
      const task = data[0]
      console.log('\n   Sample task:')
      console.log('   ID:', task.id)
      console.log('   Title:', task.title)
      console.log('   slack_thread_ts:', task.slack_thread_ts || '(null)')
      console.log('   slack_message_ts:', task.slack_message_ts || '(null)')
    } else {
      console.log('\n   No tasks found in this project')
    }
  } catch (error) {
    console.error('❌ Database error:', error)
  }
}

async function main() {
  console.log('╔' + '═'.repeat(48) + '╗')
  console.log('║' + ' '.repeat(8) + 'Slack Integration Test Suite' + ' '.repeat(12) + '║')
  console.log('╚' + '═'.repeat(48) + '╝')
  console.log('\nProject ID:', TEST_PROJECT_ID)

  // Test 1: Fetch config
  const config = await testSlackConfig()
  if (!config) {
    console.log('\n⚠️  Please configure Slack integration first:')
    console.log('   1. Create Slack webhook at https://api.slack.com/apps')
    console.log('   2. Insert into slack_integrations table')
    console.log('   3. Run this test again')
    return
  }

  // Test 2-5: Send notifications
  await testTaskCreatedNotification(config.webhook_url)
  await new Promise(resolve => setTimeout(resolve, 1000)) // Rate limit friendly

  await testTaskUpdatedNotification(config.webhook_url)
  await new Promise(resolve => setTimeout(resolve, 1000))

  await testStatusChangedNotification(config.webhook_url)
  await new Promise(resolve => setTimeout(resolve, 1000))

  await testTaskDeletedNotification(config.webhook_url)
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test 6: Threading
  await testThreading(config.webhook_url)

  // Test 7: Database
  await testDatabaseFields()

  console.log('\n' + '━'.repeat(50))
  console.log('✅ All tests completed!')
  console.log('Check your Slack channel:', config.channel_name || 'N/A')
  console.log('━'.repeat(50) + '\n')
}

main().catch(console.error)
