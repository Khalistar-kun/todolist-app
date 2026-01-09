import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Slack notification helper
async function sendSlackNotification(
  supabaseAdmin: any,
  projectId: string,
  notificationType: 'create' | 'update' | 'delete' | 'move' | 'complete',
  message: { text: string; blocks?: any[] }
) {
  try {
    // Get Slack integration for this project (only needed columns)
    const { data: slackIntegration } = await supabaseAdmin
      .from('slack_integrations')
      .select('access_token, webhook_url, channel_id, notify_on_task_create, notify_on_task_update, notify_on_task_delete, notify_on_task_move, notify_on_task_complete')
      .eq('project_id', projectId)
      .single()

    if (!slackIntegration) return // No Slack integration configured

    // Check if we have access token (new method) or webhook URL (legacy)
    if (!slackIntegration.access_token && !slackIntegration.webhook_url) return

    // Check if this notification type is enabled
    const typeMap: Record<string, string> = {
      create: 'notify_on_task_create',
      update: 'notify_on_task_update',
      delete: 'notify_on_task_delete',
      move: 'notify_on_task_move',
      complete: 'notify_on_task_complete',
    }

    if (!slackIntegration[typeMap[notificationType]]) return // Notification type disabled

    let response: Response

    // Use access token method (chat.postMessage API) if available
    if (slackIntegration.access_token && slackIntegration.channel_id) {
      response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${slackIntegration.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: slackIntegration.channel_id,
          text: message.text,
          blocks: message.blocks,
        }),
      })

      const result = await response.json()
      if (!result.ok) {
        console.error('[Slack] Failed to send notification:', result.error)
      } else {
        console.log('[Slack] Notification sent successfully via API')
      }
    } else if (slackIntegration.webhook_url) {
      // Fallback to webhook method (legacy)
      response = await fetch(slackIntegration.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message.text,
          blocks: message.blocks,
        }),
      })

      if (!response.ok) {
        console.error('[Slack] Failed to send notification:', await response.text())
      } else {
        console.log('[Slack] Notification sent successfully via webhook')
      }
    }
  } catch (error) {
    console.error('[Slack] Error sending notification:', error)
  }
}

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

// GET tasks for a project
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify user is a member of the project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    // Get tasks with only needed columns (avoid over-fetching)
    const { data: tasks, error } = await supabaseAdmin
      .from('tasks')
      .select('id, title, description, status, stage_id, priority, position, due_date, tags, created_at, created_by')
      .eq('project_id', projectId)
      .order('position', { ascending: true })

    if (error) {
      console.error('[API] Error fetching tasks:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tasks: tasks || [] })
  } catch (error) {
    console.error('[API] Error in GET /api/tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create a new task
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { project_id, title, description, stage_id, priority, due_date, tags } = body

    if (!project_id || !title) {
      return NextResponse.json(
        { error: 'project_id and title are required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify user is a member of the project with edit permissions
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('id, role')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    // Check if user has permission to create tasks (member or higher)
    const canEdit = ['member', 'admin', 'owner'].includes(membership.role)
    if (!canEdit) {
      return NextResponse.json({ error: 'Viewers cannot create tasks' }, { status: 403 })
    }

    // Create the task
    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        project_id,
        title,
        description: description || null,
        stage_id: stage_id || 'todo',
        priority: priority || 'medium',
        due_date: due_date || null,
        tags: tags || [],
        created_by: user.id,
        status: 'todo',
        position: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Error creating task:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[API] Created task:', task.id)

    // Send Slack notification for task creation
    sendSlackNotification(supabaseAdmin, project_id, 'create', {
      text: `New task created: ${title}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: 'New Task Created', emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${title}*${description ? `\n${description}` : ''}`,
          },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `*Priority:* ${priority || 'medium'}` },
            { type: 'mrkdwn', text: `*Stage:* ${stage_id || 'todo'}` },
          ],
        },
      ],
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('[API] Error in POST /api/tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH update a task
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Task id is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get the task to verify project membership and track changes
    const { data: existingTask } = await supabaseAdmin
      .from('tasks')
      .select('project_id, title, stage_id, status')
      .eq('id', id)
      .single()

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Verify user is a member of the project with edit permissions
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('id, role')
      .eq('project_id', existingTask.project_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    // Check if user has permission to update tasks (member or higher)
    const canEdit = ['member', 'admin', 'owner'].includes(membership.role)
    if (!canEdit) {
      return NextResponse.json({ error: 'Viewers cannot update tasks' }, { status: 403 })
    }

    // Track if stage is changing (for notifications)
    const isStageChanging = updates.stage_id && updates.stage_id !== existingTask.stage_id
    const oldStageId = existingTask.stage_id

    // Update the task (only include fields that exist in the schema)
    const allowedFields = ['title', 'description', 'status', 'stage_id', 'priority', 'due_date', 'tags', 'custom_fields', 'completed_at']
    const filteredUpdates: Record<string, any> = {}

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }

    // Always update the updated_at timestamp
    filteredUpdates.updated_at = new Date().toISOString()

    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API] Error updating task:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send notifications if task stage changed
    if (isStageChanging) {
      console.log('[API] Task stage is changing, preparing notification...')
      try {
        // Get project info and workflow stages
        const { data: project } = await supabaseAdmin
          .from('projects')
          .select('name, workflow_stages')
          .eq('id', existingTask.project_id)
          .single()

        // Get the user who moved the task along with their role
        const { data: moverProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single()

        // Get the mover's role in the project
        const moverRole = membership.role
        const roleLabels: Record<string, string> = {
          owner: 'Owner',
          admin: 'Admin',
          member: 'Member',
          viewer: 'Viewer',
        }
        const moverRoleLabel = roleLabels[moverRole] || moverRole

        const moverName = moverProfile?.full_name || moverProfile?.email || 'Someone'
        const projectName = project?.name || 'a project'

        // Get stage names from workflow
        const stages = project?.workflow_stages || [
          { id: 'todo', name: 'To Do' },
          { id: 'in_progress', name: 'In Progress' },
          { id: 'review', name: 'Review' },
          { id: 'done', name: 'Done' },
        ]
        const oldStageName = stages.find((s: any) => s.id === oldStageId)?.name || oldStageId
        const newStageName = stages.find((s: any) => s.id === updates.stage_id)?.name || updates.stage_id

        // Get the project owner to notify them (if they didn't move the task themselves)
        const { data: ownerMember } = await supabaseAdmin
          .from('project_members')
          .select('user_id')
          .eq('project_id', existingTask.project_id)
          .eq('role', 'owner')
          .single()

        console.log('[API] Owner member:', ownerMember, 'Current user:', user.id)

        // Notify the project owner if they're not the one who moved the task
        if (ownerMember && ownerMember.user_id !== user.id) {
          console.log('[API] Creating notification for owner:', ownerMember.user_id)
          const { data: notifData, error: notifError } = await supabaseAdmin.from('notifications').insert({
            user_id: ownerMember.user_id,
            type: 'task_moved',
            title: 'Task moved',
            message: `${moverName} (${moverRoleLabel}) moved "${existingTask.title}" from ${oldStageName} to ${newStageName} in ${projectName}`,
            data: {
              project_id: existingTask.project_id,
              project_name: projectName,
              task_id: id,
              task_title: existingTask.title,
              old_stage: oldStageId,
              old_stage_name: oldStageName,
              new_stage: updates.stage_id,
              new_stage_name: newStageName,
              moved_by: user.id,
              moved_by_name: moverName,
              moved_by_role: moverRole,
            },
          }).select().single()

          if (notifError) {
            console.error('[API] Error inserting notification:', notifError)
          } else {
            console.log('[API] Notification created successfully:', notifData?.id)
          }
        } else {
          console.log('[API] Not creating notification - owner moved the task or no owner found')
        }

        // Send Slack notification for task move
        sendSlackNotification(supabaseAdmin, existingTask.project_id, 'move', {
          text: `Task moved: ${existingTask.title}`,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: 'Task Moved', emoji: true },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${existingTask.title}*\n${oldStageName} → ${newStageName}`,
              },
            },
            {
              type: 'context',
              elements: [
                { type: 'mrkdwn', text: `Moved by *${moverName}*` },
              ],
            },
          ],
        })
      } catch (notifyError) {
        // Don't fail the request if notification fails
        console.error('[API] Error sending task move notifications:', notifyError)
      }
    } else if (Object.keys(filteredUpdates).length > 1) {
      // Send Slack notification for general updates (not just timestamp)
      sendSlackNotification(supabaseAdmin, existingTask.project_id, 'update', {
        text: `Task updated: ${existingTask.title}`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: 'Task Updated', emoji: true },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${task.title}*`,
            },
          },
        ],
      })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('[API] Error in PATCH /api/tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE a task
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Task id is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get the task to verify project membership and for Slack notification
    const { data: existingTask } = await supabaseAdmin
      .from('tasks')
      .select('project_id, title')
      .eq('id', id)
      .single()

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Verify user is a member of the project with delete permissions
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('id, role')
      .eq('project_id', existingTask.project_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    // Check if user has permission to delete tasks (admin or owner only)
    const canDelete = ['admin', 'owner'].includes(membership.role)
    if (!canDelete) {
      return NextResponse.json({ error: 'Only admins and owners can delete tasks' }, { status: 403 })
    }

    // Store task title before deletion for Slack notification
    const taskTitle = existingTask.title
    const taskProjectId = existingTask.project_id

    // Delete the task
    const { error } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[API] Error deleting task:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send Slack notification for task deletion
    sendSlackNotification(supabaseAdmin, taskProjectId, 'delete', {
      text: `Task deleted: ${taskTitle}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: 'Task Deleted', emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${taskTitle}*\nThis task has been removed.`,
          },
        },
      ],
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error in DELETE /api/tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
