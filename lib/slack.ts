/**
 * Slack Integration Library
 * Handles sending notifications to Slack using the chat.postMessage API with access tokens
 */

import type { Task, TaskStatus } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SlackConfig = {
  access_token: string
  channel_id: string
  channel_name?: string | null
}

export type SlackMessageResponse = {
  ok: boolean
  error?: string
  ts?: string // Message timestamp from Slack API
}

export type TaskChangeType = 'created' | 'updated' | 'deleted' | 'status_changed'

export type TaskChanges = {
  title?: { old: string; new: string }
  description?: { old: string | null; new: string | null }
  assignees?: { old: string[]; new: string[] }
  due_at?: { old: string | null; new: string | null }
  status?: { old: TaskStatus; new: TaskStatus }
}

/**
 * Determines if we should post in a thread or create a new message
 * Same-day updates go in thread, different day creates new message
 */
export function shouldUseThread(task: Task | null): boolean {
  if (!task || !task.slack_thread_ts || !task.slack_message_ts) {
    return false
  }

  // Extract date from Slack message timestamp (format: 1234567890.123456)
  const messageDate = new Date(parseFloat(task.slack_message_ts) * 1000)
  const today = new Date()

  // Check if message was sent today
  return (
    messageDate.getDate() === today.getDate() &&
    messageDate.getMonth() === today.getMonth() &&
    messageDate.getFullYear() === today.getFullYear()
  )
}

/**
 * Format task details for Slack message
 */
function formatTaskDetails(task: Partial<Task>): string {
  const parts: string[] = []

  if (task.description) {
    parts.push(`*Description:* ${task.description}`)
  }

  if (task.status) {
    const statusEmoji = {
      todo: '⏳',
      in_progress: '🔄',
      done: '✅'
    }
    parts.push(`*Status:* ${statusEmoji[task.status]} ${task.status.replace('_', ' ').toUpperCase()}`)
  }

  if (task.assignees && task.assignees.length > 0) {
    parts.push(`*Assignees:* ${task.assignees.join(', ')}`)
  }

  if (task.due_at) {
    const dueDate = new Date(task.due_at)
    parts.push(`*Due:* ${dueDate.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })}`)
  }

  return parts.join('\n')
}

/**
 * Format changes for update notification
 */
function formatChanges(changes: TaskChanges): string {
  const parts: string[] = []

  if (changes.title) {
    parts.push(`*Title:* ~${changes.title.old}~ → ${changes.title.new}`)
  }

  if (changes.description) {
    parts.push(`*Description:* ${changes.description.new || '(removed)'}`)
  }

  if (changes.status) {
    const statusEmoji = {
      todo: '⏳',
      in_progress: '🔄',
      done: '✅'
    }
    parts.push(`*Status:* ${statusEmoji[changes.status.old]} ${changes.status.old.replace('_', ' ')} → ${statusEmoji[changes.status.new]} ${changes.status.new.replace('_', ' ')}`)
  }

  if (changes.assignees) {
    parts.push(`*Assignees:* ${changes.assignees.new.join(', ') || '(none)'}`)
  }

  if (changes.due_at) {
    const newDue = changes.due_at.new
      ? new Date(changes.due_at.new).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : '(removed)'
    parts.push(`*Due:* ${newDue}`)
  }

  return parts.join('\n')
}

/**
 * Send a Slack message using chat.postMessage API
 */
async function sendSlackMessage(
  accessToken: string,
  channelId: string,
  text: string,
  blocks?: any[],
  threadTs?: string
): Promise<SlackMessageResponse> {
  try {
    const payload: any = {
      channel: channelId,
      text,
      blocks: blocks || undefined,
    }

    // Add thread_ts if posting in a thread
    if (threadTs) {
      payload.thread_ts = threadTs
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!result.ok) {
      console.error('Slack API error:', result.error)
      return { ok: false, error: result.error }
    }

    return { ok: true, ts: result.ts }
  } catch (error) {
    console.error('Failed to send Slack message:', error)
    return { ok: false, error: String(error) }
  }
}

/**
 * Notify about task creation
 */
export async function notifyTaskCreated(
  config: SlackConfig,
  task: Partial<Task>
): Promise<SlackMessageResponse> {
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
        text: `*${task.title}*\n\n${formatTaskDetails(task)}`,
      },
    },
  ]

  return sendSlackMessage(
    config.access_token,
    config.channel_id,
    `🆕 New task: ${task.title}`,
    blocks
  )
}

/**
 * Notify about task update
 */
export async function notifyTaskUpdated(
  config: SlackConfig,
  task: Task,
  changes: TaskChanges
): Promise<SlackMessageResponse> {
  const useThread = shouldUseThread(task)
  const threadTs = useThread ? (task.slack_thread_ts || undefined) : undefined

  const changesList = formatChanges(changes)
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: useThread ? '✏️ Task Updated' : '✏️ Task Updated (New Day)',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${task.title}*\n\n${changesList}`,
      },
    },
  ]

  return sendSlackMessage(
    config.access_token,
    config.channel_id,
    `✏️ Task updated: ${task.title}`,
    blocks,
    threadTs
  )
}

/**
 * Notify about task deletion
 */
export async function notifyTaskDeleted(
  config: SlackConfig,
  task: Task
): Promise<SlackMessageResponse> {
  const useThread = shouldUseThread(task)
  const threadTs = useThread ? (task.slack_thread_ts || undefined) : undefined

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
        text: `*${task.title}*\n\nThis task has been deleted.`,
      },
    },
  ]

  return sendSlackMessage(
    config.access_token,
    config.channel_id,
    `🗑️ Task deleted: ${task.title}`,
    blocks,
    threadTs
  )
}

/**
 * Notify about status change (special case for drag & drop)
 * NOTE: For tasks moving to Done, this will show "Pending Approval" not "Completed"
 */
export async function notifyStatusChanged(
  config: SlackConfig,
  task: Task,
  oldStatus: TaskStatus,
  newStatus: TaskStatus,
  movedBy?: string
): Promise<SlackMessageResponse> {
  const useThread = shouldUseThread(task)
  const threadTs = useThread ? (task.slack_thread_ts || undefined) : undefined

  const statusEmoji = {
    todo: '⏳',
    in_progress: '🔄',
    review: '👁️',
    done: '⏰'  // Clock for pending, not checkmark
  }

  // If moving to done, show as pending approval, not completed
  const isDone = newStatus === 'done'
  const headerText = isDone
    ? '⏰ Task Marked as Done (Pending Approval)'
    : `📋 Task Moved to ${newStatus.replace('_', ' ').toUpperCase()}`

  const statusText = isDone
    ? `${statusEmoji[oldStatus] || '📋'} ${(oldStatus || 'unknown').replace('_', ' ')} → ⏰ Done (Pending Approval)`
    : `${statusEmoji[oldStatus] || '📋'} ${(oldStatus || 'unknown').replace('_', ' ')} → ${statusEmoji[newStatus] || '📋'} ${newStatus.replace('_', ' ')}`

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: headerText,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${task.title}*\n\n${statusText}`,
      },
    },
  ]

  // Add who moved it if available
  if (movedBy) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Moved by: ${movedBy}`,
        },
      ],
    })
  }

  // Add note about approval for done tasks
  if (isDone) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '⚠️ _This task requires owner/admin approval to be marked as completed._',
        },
      ],
    })
  }

  return sendSlackMessage(
    config.access_token,
    config.channel_id,
    isDone
      ? `⏰ Task marked as done (pending approval): ${task.title}`
      : `📋 Task moved to ${newStatus.replace('_', ' ')}: ${task.title}`,
    blocks,
    threadTs
  )
}

/**
 * Notify about task approval
 */
export async function notifyTaskApproved(
  config: SlackConfig,
  task: Task,
  approvedBy: string,
  projectName?: string
): Promise<SlackMessageResponse> {
  const useThread = shouldUseThread(task)
  const threadTs = useThread ? (task.slack_thread_ts || undefined) : undefined

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '✅ Task Approved and Completed',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Task:*\n${task.title}`,
        },
        {
          type: 'mrkdwn',
          text: `*Project:*\n${projectName || 'Unknown'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Approved by:*\n${approvedBy}`,
        },
        {
          type: 'mrkdwn',
          text: `*Approved at:*\n${new Date().toLocaleString()}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '✅ _This task is now included in the completed count._',
        },
      ],
    },
  ]

  return sendSlackMessage(
    config.access_token,
    config.channel_id,
    `✅ Task approved and completed: ${task.title}`,
    blocks,
    threadTs
  )
}

/**
 * Notify about task rejection
 */
export async function notifyTaskRejected(
  config: SlackConfig,
  task: Task,
  rejectedBy: string,
  reason?: string,
  returnStage?: string,
  projectName?: string
): Promise<SlackMessageResponse> {
  const useThread = shouldUseThread(task)
  const threadTs = useThread ? (task.slack_thread_ts || undefined) : undefined

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '❌ Task Rejected',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Task:*\n${task.title}`,
        },
        {
          type: 'mrkdwn',
          text: `*Project:*\n${projectName || 'Unknown'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Rejected by:*\n${rejectedBy}`,
        },
        {
          type: 'mrkdwn',
          text: `*Reason:*\n${reason || 'No reason provided'}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📋 _Task has been returned to ${returnStage?.replace('_', ' ') || 'To Do'} for further work._`,
        },
      ],
    },
  ]

  return sendSlackMessage(
    config.access_token,
    config.channel_id,
    `❌ Task rejected: ${task.title}`,
    blocks,
    threadTs
  )
}

/**
 * Main helper to detect changes between old and new task
 */
export function detectTaskChanges(
  oldTask: Task,
  newTask: Partial<Task>
): TaskChanges {
  const changes: TaskChanges = {}

  if (newTask.title && newTask.title !== oldTask.title) {
    changes.title = { old: oldTask.title, new: newTask.title }
  }

  if (newTask.description !== undefined && newTask.description !== oldTask.description) {
    changes.description = { old: oldTask.description || null, new: newTask.description }
  }

  if (newTask.status && newTask.status !== oldTask.status) {
    changes.status = { old: oldTask.status, new: newTask.status }
  }

  if (newTask.assignees && JSON.stringify(newTask.assignees) !== JSON.stringify(oldTask.assignees)) {
    changes.assignees = { old: oldTask.assignees, new: newTask.assignees }
  }

  if (newTask.due_at !== undefined && newTask.due_at !== oldTask.due_at) {
    changes.due_at = { old: oldTask.due_at || null, new: newTask.due_at }
  }

  return changes
}

/**
 * Check if there are any significant changes to notify about
 */
export function hasSignificantChanges(changes: TaskChanges): boolean {
  return Object.keys(changes).length > 0
}

/**
 * Fetch Slack configuration for a project
 * First checks project-level config, then falls back to organization-level config
 */
export async function getSlackConfig(
  supabase: SupabaseClient,
  projectId: string
): Promise<SlackConfig | null> {
  try {
    // First, try to get project-level Slack integration
    const { data: projectConfig, error: projectError } = await supabase
      .from('slack_integrations')
      .select('access_token, channel_id, channel_name')
      .eq('project_id', projectId)
      .single()

    if (!projectError && projectConfig?.access_token && projectConfig?.channel_id) {
      return {
        access_token: projectConfig.access_token,
        channel_id: projectConfig.channel_id,
        channel_name: projectConfig.channel_name,
      }
    }

    // Fall back to organization-level Slack integration
    // First get the project's organization_id
    const { data: project, error: projFetchError } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single()

    if (projFetchError || !project?.organization_id) {
      return null
    }

    // Get organization Slack config
    const { data: orgConfig, error: orgError } = await supabase
      .from('organization_slack_integrations')
      .select('access_token, channel_id, channel_name')
      .eq('organization_id', project.organization_id)
      .single()

    if (orgError || !orgConfig?.access_token || !orgConfig?.channel_id) {
      return null
    }

    return {
      access_token: orgConfig.access_token,
      channel_id: orgConfig.channel_id,
      channel_name: orgConfig.channel_name,
    }
  } catch (error) {
    console.error('Failed to fetch Slack config:', error)
    return null
  }
}

/**
 * Update task with Slack thread information after posting
 */
export async function updateTaskSlackThread(
  supabase: SupabaseClient,
  taskId: string,
  messageTs: string,
  isNewThread: boolean = true
): Promise<void> {
  try {
    const updates: any = {
      slack_message_ts: messageTs,
    }

    // Only set thread_ts on first message (not on thread replies)
    if (isNewThread) {
      updates.slack_thread_ts = messageTs
    }

    await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
  } catch (error) {
    console.error('Failed to update task Slack thread:', error)
  }
}
