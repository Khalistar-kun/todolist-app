/**
 * Slack Integration Library
 * Handles sending notifications to Slack webhooks with threading support
 */

import type { Task, TaskStatus } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SlackConfig = {
  webhook_url: string
  channel_name?: string | null
}

export type SlackMessageResponse = {
  ok: boolean
  error?: string
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
 * Send a Slack notification
 */
async function sendSlackMessage(
  webhookUrl: string,
  text: string,
  blocks?: any[],
  threadTs?: string
): Promise<SlackMessageResponse> {
  try {
    const payload: any = {
      text,
      blocks: blocks || undefined,
    }

    // Add thread_ts if posting in a thread
    if (threadTs) {
      payload.thread_ts = threadTs
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Slack webhook error:', errorText)
      return { ok: false, error: errorText }
    }

    // Slack webhooks return "ok" for success
    const result = await response.text()
    return { ok: result === 'ok' }
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
    config.webhook_url,
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
    config.webhook_url,
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
    config.webhook_url,
    `🗑️ Task deleted: ${task.title}`,
    blocks,
    threadTs
  )
}

/**
 * Notify about status change (special case for drag & drop)
 */
export async function notifyStatusChanged(
  config: SlackConfig,
  task: Task,
  oldStatus: TaskStatus,
  newStatus: TaskStatus
): Promise<SlackMessageResponse> {
  const useThread = shouldUseThread(task)
  const threadTs = useThread ? (task.slack_thread_ts || undefined) : undefined

  const statusEmoji = {
    todo: '⏳',
    in_progress: '🔄',
    done: '✅'
  }

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📋 Task Moved to ${newStatus.replace('_', ' ').toUpperCase()}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${task.title}*\n\n${statusEmoji[oldStatus]} ${oldStatus.replace('_', ' ')} → ${statusEmoji[newStatus]} ${newStatus.replace('_', ' ')}`,
      },
    },
  ]

  return sendSlackMessage(
    config.webhook_url,
    `📋 Task moved to ${newStatus.replace('_', ' ')}: ${task.title}`,
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
 */
export async function getSlackConfig(
  supabase: SupabaseClient,
  projectId: string
): Promise<SlackConfig | null> {
  try {
    const { data, error } = await supabase
      .from('slack_integrations')
      .select('webhook_url, channel_name')
      .eq('project_id', projectId)
      .single()

    if (error || !data) {
      return null
    }

    return {
      webhook_url: data.webhook_url,
      channel_name: data.channel_name,
    }
  } catch (error) {
    console.error('Failed to fetch Slack config:', error)
    return null
  }
}

/**
 * Update task with Slack thread information after posting
 * Since we're using webhooks (not the API), we generate a timestamp for threading logic
 */
export async function updateTaskSlackThread(
  supabase: SupabaseClient,
  taskId: string,
  isNewThread: boolean = true
): Promise<void> {
  try {
    // Generate timestamp in Slack format (seconds.microseconds)
    const now = Date.now()
    const messageTs = `${Math.floor(now / 1000)}.${String(now % 1000).padStart(6, '0')}`

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
