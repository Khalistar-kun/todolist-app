import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
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

async function getAuthenticatedUser(cookieStore: any) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: any) {
          cookiesToSet.forEach(({ name, value, options }: any) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
  return supabase.auth.getUser()
}

// POST /api/tasks/[id]/approve - Approve a task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: taskId } = await params
    const supabaseAdmin = getSupabaseAdmin()

    // Get task info
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, title, project_id, stage_id, approval_status')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check if task is in Done stage and pending approval
    if (task.stage_id !== 'done') {
      return NextResponse.json(
        { error: 'Task must be in Done stage to be approved' },
        { status: 400 }
      )
    }

    if (task.approval_status !== 'pending') {
      return NextResponse.json(
        { error: 'Task is not pending approval' },
        { status: 400 }
      )
    }

    // Check if user is owner/admin of the project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', task.project_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only project owners or admins can approve tasks' },
        { status: 403 }
      )
    }

    // Approve the task
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from('tasks')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        completed_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single()

    if (updateError) {
      console.error('[API] Error approving task:', updateError)
      return NextResponse.json(
        { error: 'Failed to approve task' },
        { status: 500 }
      )
    }

    // Send Slack notification for task approval
    try {
      await sendSlackApprovalNotification(supabaseAdmin, task.project_id, updatedTask, user.id, 'approved')
    } catch (slackError) {
      console.error('[API] Error sending Slack notification:', slackError)
      // Don't fail the request if Slack notification fails
    }

    return NextResponse.json({ task: updatedTask })
  } catch (error) {
    console.error('[API] Error in POST /api/tasks/[id]/approve:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tasks/[id]/approve - Reject a task (sends it back)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: taskId } = await params
    const body = await request.json().catch(() => ({}))
    const { reason, returnStageId = 'todo' } = body

    const supabaseAdmin = getSupabaseAdmin()

    // Get task info
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, title, project_id, stage_id, approval_status')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check if task is pending approval
    if (task.approval_status !== 'pending') {
      return NextResponse.json(
        { error: 'Task is not pending approval' },
        { status: 400 }
      )
    }

    // Check if user is owner/admin of the project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', task.project_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only project owners or admins can reject tasks' },
        { status: 403 }
      )
    }

    // Reject the task and move it back to the specified stage
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from('tasks')
      .update({
        approval_status: 'rejected',
        rejection_reason: reason || null,
        stage_id: returnStageId,
        moved_to_done_at: null,
        moved_to_done_by: null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single()

    if (updateError) {
      console.error('[API] Error rejecting task:', updateError)
      return NextResponse.json(
        { error: 'Failed to reject task' },
        { status: 500 }
      )
    }

    // Send Slack notification for task rejection
    try {
      await sendSlackApprovalNotification(supabaseAdmin, task.project_id, updatedTask, user.id, 'rejected', reason)
    } catch (slackError) {
      console.error('[API] Error sending Slack notification:', slackError)
      // Don't fail the request if Slack notification fails
    }

    return NextResponse.json({ task: updatedTask })
  } catch (error) {
    console.error('[API] Error in DELETE /api/tasks/[id]/approve:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to send Slack notifications for approval actions
async function sendSlackApprovalNotification(
  supabase: any,
  projectId: string,
  task: any,
  userId: string,
  action: 'approved' | 'rejected',
  reason?: string
) {
  // Get project Slack integration
  const { data: integration } = await supabase
    .from('slack_integrations')
    .select('webhook_url, channel_id, access_token')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .single()

  if (!integration) {
    return // No Slack integration configured
  }

  // Get project name
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .single()

  // Get user who performed the action
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single()

  const userName = profile?.full_name || profile?.email || 'Someone'
  const projectName = project?.name || 'Unknown Project'

  // Build the message based on action
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
  const taskUrl = `${baseUrl}/app/projects/${projectId}?task=${task.id}`

  let message: any

  if (action === 'approved') {
    message = {
      text: `Task Approved and Completed: ${task.title}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Task Approved and Completed',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Task:*\n<${taskUrl}|${task.title}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Project:*\n${projectName}`,
            },
            {
              type: 'mrkdwn',
              text: `*Approved by:*\n${userName}`,
            },
            {
              type: 'mrkdwn',
              text: `*Approved at:*\n${new Date().toLocaleString()}`,
            },
          ],
        },
      ],
    }
  } else {
    message = {
      text: `Task Rejected: ${task.title}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Task Rejected',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Task:*\n<${taskUrl}|${task.title}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Project:*\n${projectName}`,
            },
            {
              type: 'mrkdwn',
              text: `*Rejected by:*\n${userName}`,
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
              text: 'Task has been returned for further work',
            },
          ],
        },
      ],
    }
  }

  // Send via webhook or API
  if (integration.webhook_url) {
    await fetch(integration.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })
  } else if (integration.access_token && integration.channel_id) {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: integration.channel_id,
        ...message,
      }),
    })
  }
}
