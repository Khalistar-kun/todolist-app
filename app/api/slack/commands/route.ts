import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * Slack Slash Command Handler
 *
 * Handles commands like:
 * /todolist create Buy groceries
 * /todolist list
 * /todolist help
 */
export async function POST(request: NextRequest) {
  try {
    // Slack sends data as form-urlencoded
    const formData = await request.formData()

    const token = formData.get('token') as string
    const command = formData.get('command') as string
    const text = formData.get('text') as string || ''
    const userId = formData.get('user_id') as string
    const userName = formData.get('user_name') as string
    const channelId = formData.get('channel_id') as string
    const channelName = formData.get('channel_name') as string
    const responseUrl = formData.get('response_url') as string

    // Verify the request is from Slack (optional but recommended)
    // You should verify using signing secret in production
    // const signingSecret = process.env.SLACK_SIGNING_SECRET

    const supabaseAdmin = getSupabaseAdmin()

    // Find the project connected to this channel
    const { data: slackIntegration } = await supabaseAdmin
      .from('slack_integrations')
      .select('project_id, access_token')
      .eq('channel_id', channelId)
      .single()

    if (!slackIntegration) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `This channel is not connected to any TodoList project. Please connect a project to this channel first in the TodoList app settings.`
      })
    }

    // Parse the command
    const args = text.trim().split(/\s+/)
    const subCommand = args[0]?.toLowerCase() || 'help'
    const taskTitle = args.slice(1).join(' ')

    switch (subCommand) {
      case 'create':
      case 'add':
      case 'new': {
        if (!taskTitle) {
          return NextResponse.json({
            response_type: 'ephemeral',
            text: `Please provide a task title. Usage: \`${command} create Buy groceries\``
          })
        }

        // Create the task
        const { data: task, error } = await supabaseAdmin
          .from('tasks')
          .insert({
            project_id: slackIntegration.project_id,
            title: taskTitle,
            status: 'todo',
            created_by_slack: true,
            slack_user_id: userId,
            slack_user_name: userName,
          })
          .select()
          .single()

        if (error) {
          console.error('[Slack Command] Error creating task:', error)
          return NextResponse.json({
            response_type: 'ephemeral',
            text: `Failed to create task: ${error.message}`
          })
        }

        // Send notification to the channel about the new task
        if (slackIntegration.access_token) {
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${slackIntegration.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: channelId,
              text: `New task created by @${userName}`,
              blocks: [
                {
                  type: 'header',
                  text: {
                    type: 'plain_text',
                    text: '🆕 Task Created from Slack',
                    emoji: true,
                  },
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*${taskTitle}*\n\nCreated by <@${userId}>`,
                  },
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: `Status: ⏳ To Do`,
                    },
                  ],
                },
              ],
            }),
          })
        }

        return NextResponse.json({
          response_type: 'ephemeral',
          text: `✅ Task created successfully: *${taskTitle}*`
        })
      }

      case 'list':
      case 'tasks': {
        // Get recent tasks
        const { data: tasks, error } = await supabaseAdmin
          .from('tasks')
          .select('id, title, status, created_at')
          .eq('project_id', slackIntegration.project_id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) {
          return NextResponse.json({
            response_type: 'ephemeral',
            text: `Failed to fetch tasks: ${error.message}`
          })
        }

        if (!tasks || tasks.length === 0) {
          return NextResponse.json({
            response_type: 'ephemeral',
            text: `No tasks found in this project.`
          })
        }

        const statusEmoji: Record<string, string> = {
          todo: '⏳',
          in_progress: '🔄',
          done: '✅'
        }

        const taskList = tasks.map((t, i) =>
          `${i + 1}. ${statusEmoji[t.status] || '📋'} ${t.title}`
        ).join('\n')

        return NextResponse.json({
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '📋 Recent Tasks',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: taskList,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Showing ${tasks.length} most recent tasks`,
                },
              ],
            },
          ],
        })
      }

      case 'todo':
      case 'doing':
      case 'done': {
        // Get tasks by status
        const statusMap: Record<string, string> = {
          todo: 'todo',
          doing: 'in_progress',
          done: 'done'
        }
        const status = statusMap[subCommand]

        const { data: tasks, error } = await supabaseAdmin
          .from('tasks')
          .select('id, title, status')
          .eq('project_id', slackIntegration.project_id)
          .eq('status', status)
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) {
          return NextResponse.json({
            response_type: 'ephemeral',
            text: `Failed to fetch tasks: ${error.message}`
          })
        }

        const statusLabels: Record<string, string> = {
          todo: '⏳ To Do',
          in_progress: '🔄 In Progress',
          done: '✅ Done'
        }

        if (!tasks || tasks.length === 0) {
          return NextResponse.json({
            response_type: 'ephemeral',
            text: `No tasks with status "${statusLabels[status]}" found.`
          })
        }

        const taskList = tasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n')

        return NextResponse.json({
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: statusLabels[status],
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: taskList,
              },
            },
          ],
        })
      }

      case 'help':
      default: {
        return NextResponse.json({
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '📋 TodoList Commands',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Available Commands:*\n\n` +
                  `• \`${command} create <title>\` - Create a new task\n` +
                  `• \`${command} list\` - Show recent tasks\n` +
                  `• \`${command} todo\` - Show To Do tasks\n` +
                  `• \`${command} doing\` - Show In Progress tasks\n` +
                  `• \`${command} done\` - Show completed tasks\n` +
                  `• \`${command} help\` - Show this help message`,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `💡 Example: \`${command} create Review pull request\``,
                },
              ],
            },
          ],
        })
      }
    }
  } catch (error) {
    console.error('[Slack Command] Error:', error)
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'An error occurred while processing your command. Please try again.'
    })
  }
}

// Slack also sends GET requests to verify the URL
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'TodoList Slack Command Handler' })
}
