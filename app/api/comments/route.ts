import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getUniqueMentions } from '@/lib/mentions/parser'

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
      .from('TODOAAPP.comments')
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

// Helper to resolve mention handles to user IDs
async function resolveMentionsToUserIds(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  mentionHandles: string[],
  projectId: string
): Promise<Map<string, string>> {
  // Map of mention_handle -> user_id
  const resolvedMentions = new Map<string, string>()

  if (mentionHandles.length === 0) return resolvedMentions

  // Get all project members
  const { data: members } = await supabaseAdmin
    .from('TODOAAPP.project_members')
    .select('user_id')
    .eq('project_id', projectId)

  if (!members || members.length === 0) return resolvedMentions

  const memberUserIds = members.map(m => m.user_id)

  // Get profiles for these users
  const { data: profiles } = await supabaseAdmin
    .from('TODOAAPP.profiles')
    .select('id, full_name, email')
    .in('id', memberUserIds)

  if (!profiles) return resolvedMentions

  // Match mention handles to profiles
  for (const profile of profiles) {
    // Generate possible handles for this user
    const possibleHandles: string[] = []

    if (profile.full_name) {
      // "John Doe" -> "john.doe"
      possibleHandles.push(
        profile.full_name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '.')
          .replace(/[^a-z0-9._-]/g, '')
      )
    }

    if (profile.email) {
      // "john@example.com" -> "john"
      possibleHandles.push(profile.email.split('@')[0].toLowerCase())
    }

    // Check if any of our mention handles match
    for (const handle of mentionHandles) {
      if (possibleHandles.includes(handle.toLowerCase())) {
        resolvedMentions.set(handle.toLowerCase(), profile.id)
      }
    }
  }

  return resolvedMentions
}

// POST create a new comment and handle mentions
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
      .from('TODOAAPP.project_members')
      .select('id, role')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    // Get task info for notification
    const { data: task } = await supabaseAdmin
      .from('TODOAAPP.tasks')
      .select('title')
      .eq('id', task_id)
      .single()

    // Get commenter's profile
    const { data: commenterProfile } = await supabaseAdmin
      .from('TODOAAPP.profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single()

    const commenterName = commenterProfile?.full_name || user.email || 'Someone'

    // Create the comment
    const { data: comment, error: commentError } = await supabaseAdmin
      .from('TODOAAPP.comments')
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

    // Get project name for notification
    const { data: project } = await supabaseAdmin
      .from('TODOAAPP.projects')
      .select('name')
      .eq('id', project_id)
      .single()

    const projectName = project?.name || 'a project'
    const taskTitle = task?.title || 'a task'

    // ===== MENTION PROCESSING =====
    // Extract @mentions from comment content
    const mentionHandles = getUniqueMentions(content)
    const mentionedUserIds = new Set<string>()

    if (mentionHandles.length > 0) {
      console.log(`[API] Found ${mentionHandles.length} mentions in comment:`, mentionHandles)

      // Resolve mention handles to user IDs
      const resolvedMentions = await resolveMentionsToUserIds(
        supabaseAdmin,
        mentionHandles,
        project_id
      )

      console.log(`[API] Resolved ${resolvedMentions.size} mentions to user IDs`)

      // Create mention records and notifications for each mentioned user
      for (const [handle, mentionedUserId] of resolvedMentions) {
        // Skip if mentioning yourself
        if (mentionedUserId === user.id) {
          console.log(`[API] Skipping self-mention for handle: @${handle}`)
          continue
        }

        // Track unique mentioned users (deduplication)
        if (mentionedUserIds.has(mentionedUserId)) {
          console.log(`[API] Skipping duplicate mention for user: ${mentionedUserId}`)
          continue
        }
        mentionedUserIds.add(mentionedUserId)

        // Create mention record in the mentions table
        const { error: mentionError } = await supabaseAdmin
          .from('TODOAAPP.mentions')
          .insert({
            mentioned_user_id: mentionedUserId,
            mentioner_user_id: user.id,
            task_id,
            comment_id: comment.id,
            project_id,
            mention_context: content.trim().slice(0, 200),
          })

        if (mentionError) {
          console.error(`[API] Error creating mention record:`, mentionError)
          // Continue - don't fail the whole request
        }

        // Create attention item for the mentioned user
        const { error: attentionError } = await supabaseAdmin
          .from('TODOAAPP.attention_items')
          .insert({
            user_id: mentionedUserId,
            attention_type: 'mention',
            priority: 'high',
            title: `${commenterName} mentioned you`,
            body: `"${content.trim().slice(0, 100)}${content.length > 100 ? '...' : ''}"`,
            task_id,
            comment_id: comment.id,
            project_id,
            actor_user_id: user.id,
            dedup_key: `mention:${comment.id}:${mentionedUserId}`,
          })

        if (attentionError) {
          console.error(`[API] Error creating attention item:`, attentionError)
          // Continue - don't fail the whole request
        }

        // Create notification for the mentioned user
        const { error: notifError } = await supabaseAdmin
          .from('TODOAAPP.notifications')
          .insert({
            user_id: mentionedUserId,
            type: 'mention',
            title: 'You were mentioned',
            message: `${commenterName} mentioned you in a comment on "${taskTitle}"`,
            data: {
              project_id,
              project_name: projectName,
              task_id,
              task_title: taskTitle,
              comment_id: comment.id,
              mentioner_id: user.id,
              mentioner_name: commenterName,
              mention_context: content.trim().slice(0, 100),
            },
          })

        if (notifError) {
          console.error(`[API] Error creating mention notification:`, notifError)
        } else {
          console.log(`[API] Created mention notification for user: ${mentionedUserId}`)
        }
      }
    }

    // ===== REGULAR COMMENT NOTIFICATIONS =====
    // Notify other project members about the comment (excluding commenter and already-mentioned users)
    const { data: projectMembers } = await supabaseAdmin
      .from('TODOAAPP.project_members')
      .select('user_id')
      .eq('project_id', project_id)
      .neq('user_id', user.id)

    if (projectMembers && projectMembers.length > 0) {
      // Filter out users who were already notified via mention
      const membersToNotify = projectMembers.filter(
        member => !mentionedUserIds.has(member.user_id)
      )

      if (membersToNotify.length > 0) {
        const notifications = membersToNotify.map(member => ({
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
          .from('TODOAAPP.notifications')
          .insert(notifications)

        if (notifError) {
          console.error('[API] Error creating comment notifications:', notifError)
        } else {
          console.log(`[API] Created ${notifications.length} comment notifications`)
        }
      }
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('[API] Error in POST /api/comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE a comment (also cleans up related mentions)
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
      .from('TODOAAPP.comments')
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
        .from('TODOAAPP.project_members')
        .select('role')
        .eq('project_id', comment.project_id)
        .eq('user_id', user.id)
        .single()

      const isAdmin = membership && ['admin', 'owner'].includes(membership.role)

      if (!isAdmin) {
        return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403 })
      }
    }

    // Delete related mentions (cascade should handle this if FK is set, but be explicit)
    await supabaseAdmin
      .from('TODOAAPP.mentions')
      .delete()
      .eq('comment_id', id)

    // Delete related attention items
    await supabaseAdmin
      .from('TODOAAPP.attention_items')
      .delete()
      .eq('comment_id', id)

    // Delete the comment
    const { error } = await supabaseAdmin
      .from('TODOAAPP.comments')
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

// PATCH update a comment (handles mention changes)
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, content } = body

    if (!id || !content?.trim()) {
      return NextResponse.json({ error: 'id and content are required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get the existing comment
    const { data: existingComment } = await supabaseAdmin
      .from('TODOAAPP.comments')
      .select('created_by, project_id, task_id, content')
      .eq('id', id)
      .single()

    if (!existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Only the author can edit
    if (existingComment.created_by !== user.id) {
      return NextResponse.json({ error: 'Not authorized to edit this comment' }, { status: 403 })
    }

    // Get old mentions
    const oldMentionHandles = getUniqueMentions(existingComment.content)
    const newMentionHandles = getUniqueMentions(content)

    // Find newly added mentions (in new but not in old)
    const addedMentions = newMentionHandles.filter(h => !oldMentionHandles.includes(h))

    // Update the comment
    const { data: updatedComment, error: updateError } = await supabaseAdmin
      .from('TODOAAPP.comments')
      .update({ content: content.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        author:profiles!created_by(id, full_name, avatar_url)
      `)
      .single()

    if (updateError) {
      console.error('[API] Error updating comment:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Process newly added mentions
    if (addedMentions.length > 0) {
      console.log(`[API] Found ${addedMentions.length} new mentions after edit:`, addedMentions)

      const resolvedMentions = await resolveMentionsToUserIds(
        supabaseAdmin,
        addedMentions,
        existingComment.project_id
      )

      // Get task and project info for notifications
      const { data: task } = await supabaseAdmin
        .from('TODOAAPP.tasks')
        .select('title')
        .eq('id', existingComment.task_id)
        .single()

      const { data: project } = await supabaseAdmin
        .from('TODOAAPP.projects')
        .select('name')
        .eq('id', existingComment.project_id)
        .single()

      const { data: commenterProfile } = await supabaseAdmin
        .from('TODOAAPP.profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const commenterName = commenterProfile?.full_name || user.email || 'Someone'
      const taskTitle = task?.title || 'a task'
      const projectName = project?.name || 'a project'

      for (const [handle, mentionedUserId] of resolvedMentions) {
        if (mentionedUserId === user.id) continue

        // Create mention record
        await supabaseAdmin.from('TODOAAPP.mentions').insert({
          mentioned_user_id: mentionedUserId,
          mentioner_user_id: user.id,
          task_id: existingComment.task_id,
          comment_id: id,
          project_id: existingComment.project_id,
          mention_context: content.trim().slice(0, 200),
        })

        // Create attention item
        await supabaseAdmin.from('TODOAAPP.attention_items').insert({
          user_id: mentionedUserId,
          attention_type: 'mention',
          priority: 'high',
          title: `${commenterName} mentioned you`,
          body: `"${content.trim().slice(0, 100)}${content.length > 100 ? '...' : ''}"`,
          task_id: existingComment.task_id,
          comment_id: id,
          project_id: existingComment.project_id,
          actor_user_id: user.id,
          dedup_key: `mention:${id}:${mentionedUserId}:edit:${Date.now()}`,
        })

        // Create notification
        await supabaseAdmin.from('TODOAAPP.notifications').insert({
          user_id: mentionedUserId,
          type: 'mention',
          title: 'You were mentioned',
          message: `${commenterName} mentioned you in a comment on "${taskTitle}"`,
          data: {
            project_id: existingComment.project_id,
            project_name: projectName,
            task_id: existingComment.task_id,
            task_title: taskTitle,
            comment_id: id,
            mentioner_id: user.id,
            mentioner_name: commenterName,
            mention_context: content.trim().slice(0, 100),
          },
        })

        console.log(`[API] Created notification for newly mentioned user: ${mentionedUserId}`)
      }
    }

    return NextResponse.json({ comment: updatedComment })
  } catch (error) {
    console.error('[API] Error in PATCH /api/comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
