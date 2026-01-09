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

// GET comments for a task
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('task_id')

    if (!taskId) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get comments with author info
    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select(`
        *,
        author:profiles!created_by(id, full_name, avatar_url)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[API] Error fetching comments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ comments: comments || [] })
  } catch (error) {
    console.error('[API] Error in GET /api/comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create a new comment and notify project members
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { task_id, project_id, content } = body

    if (!task_id || !project_id || !content?.trim()) {
      return NextResponse.json(
        { error: 'task_id, project_id, and content are required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify user is a member of the project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('id, role')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    // Get task info for notification
    const { data: task } = await supabaseAdmin
      .from('tasks')
      .select('title')
      .eq('id', task_id)
      .single()

    // Get commenter's profile
    const { data: commenterProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single()

    const commenterName = commenterProfile?.full_name || user.email || 'Someone'

    // Create the comment
    const { data: comment, error: commentError } = await supabaseAdmin
      .from('comments')
      .insert({
        task_id,
        project_id,
        content: content.trim(),
        created_by: user.id,
      })
      .select(`
        *,
        author:profiles!created_by(id, full_name, avatar_url)
      `)
      .single()

    if (commentError) {
      console.error('[API] Error creating comment:', commentError)
      return NextResponse.json({ error: commentError.message }, { status: 500 })
    }

    // Get all project members to notify (except the commenter)
    const { data: projectMembers } = await supabaseAdmin
      .from('project_members')
      .select('user_id')
      .eq('project_id', project_id)
      .neq('user_id', user.id)

    // Get project name for notification
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('name')
      .eq('id', project_id)
      .single()

    const projectName = project?.name || 'a project'
    const taskTitle = task?.title || 'a task'

    // Create notifications for all project members
    if (projectMembers && projectMembers.length > 0) {
      const notifications = projectMembers.map(member => ({
        user_id: member.user_id,
        type: 'comment_added',
        title: 'New comment',
        message: `${commenterName} commented on "${taskTitle}" in ${projectName}`,
        data: {
          project_id,
          project_name: projectName,
          task_id,
          task_title: taskTitle,
          comment_id: comment.id,
          commenter_id: user.id,
          commenter_name: commenterName,
          comment_preview: content.trim().slice(0, 100) + (content.length > 100 ? '...' : ''),
        },
      }))

      const { error: notifError } = await supabaseAdmin
        .from('notifications')
        .insert(notifications)

      if (notifError) {
        console.error('[API] Error creating notifications:', notifError)
        // Don't fail the request, just log the error
      } else {
        console.log(`[API] Created ${notifications.length} notifications for comment`)
      }
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('[API] Error in POST /api/comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE a comment
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
      return NextResponse.json({ error: 'Comment id is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get the comment to verify ownership
    const { data: comment } = await supabaseAdmin
      .from('comments')
      .select('created_by, project_id')
      .eq('id', id)
      .single()

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Check if user is the comment author or a project admin
    const isAuthor = comment.created_by === user.id

    if (!isAuthor) {
      const { data: membership } = await supabaseAdmin
        .from('project_members')
        .select('role')
        .eq('project_id', comment.project_id)
        .eq('user_id', user.id)
        .single()

      const isAdmin = membership && ['admin', 'owner'].includes(membership.role)

      if (!isAdmin) {
        return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403 })
      }
    }

    // Delete the comment
    const { error } = await supabaseAdmin
      .from('comments')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[API] Error deleting comment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error in DELETE /api/comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
