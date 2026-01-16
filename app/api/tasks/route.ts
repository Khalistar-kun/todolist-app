import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/* =========================
   SUPABASE HELPERS
========================= */

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getAuthenticatedUser(cookieStore: any) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: any[]) => {
          cookiesToSet.forEach(c =>
            cookieStore.set(c.name, c.value, c.options)
          )
        },
      },
    }
  )
  return supabase.auth.getUser()
}

/* =========================
   SLACK (NON-BLOCKING)
========================= */

async function sendSlackNotification(
  supabase: any,
  projectId: string,
  type: 'create' | 'update' | 'delete' | 'move' | 'complete',
  message: { text: string; blocks?: any[] }
) {
  try {
    const { data: slack } = await supabase
      .from('slack_integrations')
      .select(
        'access_token, webhook_url, channel_id, notify_on_task_create, notify_on_task_update, notify_on_task_delete, notify_on_task_move, notify_on_task_complete'
      )
      .eq('project_id', projectId)
      .single()

    if (!slack) return

    const flags: Record<string, string> = {
      create: 'notify_on_task_create',
      update: 'notify_on_task_update',
      delete: 'notify_on_task_delete',
      move: 'notify_on_task_move',
      complete: 'notify_on_task_complete',
    }

    if (!slack[flags[type]]) return

    if (slack.access_token && slack.channel_id) {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${slack.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: slack.channel_id, ...message }),
      })
    } else if (slack.webhook_url) {
      await fetch(slack.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })
    }
  } catch (err) {
    console.error('[Slack]', err)
  }
}

/* =========================
   GET TASKS
========================= */

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const { data: { user } } = await getAuthenticatedUser(cookieStore)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const stageId = searchParams.get('stage_id')
    const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500)
    const offset = Number(searchParams.get('offset') ?? 0)

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: member } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let query = supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .order('position', { ascending: true })
      .range(offset, offset + limit - 1)

    if (stageId) query = query.eq('stage_id', stageId)

    const { data, count } = await query

    return NextResponse.json({
      tasks: data ?? [],
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        hasMore: offset + limit < (count ?? 0),
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/* =========================
   CREATE TASK (FIXED)
========================= */

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const { data: { user } } = await getAuthenticatedUser(cookieStore)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    const {
      project_id,
      title,
      description = null,
      stage_id,
      priority = 'medium',
      due_date = null,
      tags = [],
      color = null,
      assignees = [],
    } = body

    if (!project_id || !title) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Project + workflow
    const { data: project } = await supabase
      .from('projects')
      .select('workflow_stages')
      .eq('id', project_id)
      .single()

    if (!project || !Array.isArray(project.workflow_stages)) {
      return NextResponse.json({ error: 'Invalid project configuration' }, { status: 400 })
    }

    const stages = project.workflow_stages
    const validStageIds = stages.map((s: any) => s.id)

    const resolvedStageId =
      stage_id && validStageIds.includes(stage_id)
        ? stage_id
        : stages[0].id

    // Role check
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['member', 'admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Safe enums
    const safePriority = ['low', 'medium', 'high'].includes(priority)
      ? priority
      : 'medium'

    const safeTags = Array.isArray(tags) ? tags.map(String) : []

    // Position
    const { data: lastTask } = await supabase
      .from('tasks')
      .select('position')
      .eq('project_id', project_id)
      .eq('stage_id', resolvedStageId)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const position = (lastTask?.position ?? 0) + 1

    // INSERT TASK
    const { data: task, error: insertError } = await supabase
      .from('tasks')
      .insert({
        project_id,
        title,
        description,
        stage_id: resolvedStageId,
        priority: safePriority,
        due_date,
        tags: safeTags,
        created_by: user.id,
        status: 'todo',
        position,
        color,
      })
      .select()
      .single()

    if (insertError || !task) {
      console.error('[TASK INSERT FAILED]', insertError)
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    /* ========= FIXED ASSIGNEES HANDLING ========= */

    const safeAssignees = Array.isArray(assignees)
      ? assignees
          .map((a: any) => {
            if (!a) return null
            if (typeof a === 'string') return a
            if (typeof a === 'object') return a.id ?? a.value ?? null
            return null
          })
          .filter(Boolean)
      : []

    if (safeAssignees.length > 0) {
      await supabase.from('task_assignments').insert(
        safeAssignees.map((uid: string) => ({
          task_id: task.id,
          user_id: uid,
          assigned_by: user.id,
        }))
      )
    }

    void sendSlackNotification(supabase, project_id, 'create', {
      text: `New task: ${title}`,
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/* =========================
   UPDATE TASK
========================= */

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const { data: { user } } = await getAuthenticatedUser(cookieStore)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, ...updates } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: existing } = await supabase
      .from('tasks')
      .select('project_id')
      .eq('id', id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    updates.updated_at = new Date().toISOString()
    updates.updated_by = user.id

    const { data: task } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    return NextResponse.json({ task })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/* =========================
   DELETE TASK
========================= */

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const { data: { user } } = await getAuthenticatedUser(cookieStore)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: task } = await supabase
      .from('tasks')
      .select('project_id, title')
      .eq('id', id)
      .single()

    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await supabase.from('tasks').delete().eq('id', id)

    void sendSlackNotification(supabase, task.project_id, 'delete', {
      text: `Task deleted: ${task.title}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
