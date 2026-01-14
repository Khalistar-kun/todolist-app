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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    const supabaseAdmin = getSupabaseAdmin()

    // Run all queries in parallel for better performance
    const [projectResult, membershipResult, membersResult, taskCountsResult] = await Promise.all([
      // Get project with only needed columns
      supabaseAdmin
        .from('projects')
        .select('id, name, description, color, status, organization_id, workflow_stages, created_at, image_url')
        .eq('id', projectId)
        .single(),

      // Verify user is a member
      supabaseAdmin
        .from('project_members')
        .select('id, role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single(),

      // Get members (profiles will be fetched separately to avoid JOIN issues)
      supabaseAdmin
        .from('project_members')
        .select('id, role, joined_at, user_id')
        .eq('project_id', projectId),

      // Get task stage_id and approval_status for completed count
      supabaseAdmin
        .from('tasks')
        .select('stage_id, approval_status')
        .eq('project_id', projectId)
    ])

    const { data: project, error: projectError } = projectResult
    const { data: membership } = membershipResult
    const { data: members, error: membersError } = membersResult
    const { data: tasks } = taskCountsResult

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    // Log if members query failed (helps debugging)
    if (membersError) {
      console.error('[API] Error fetching members:', membersError)
    }

    // Fetch profiles for each member (parallel to avoid N+1 but ensure correct data)
    const memberProfiles = await Promise.all(
      (members || []).map(async (member) => {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .eq('id', member.user_id)
          .single()

        return {
          ...member,
          user: profile || { id: member.user_id, full_name: null, email: '', avatar_url: null }
        }
      })
    )

    const tasksCount = tasks?.length || 0
    // Find the "Done" stage - it's typically the last stage or has id 'done'
    const workflowStages = project.workflow_stages || [
      { id: 'todo', name: 'To Do', color: '#6B7280' },
      { id: 'in_progress', name: 'In Progress', color: '#3B82F6' },
      { id: 'review', name: 'Review', color: '#F59E0B' },
      { id: 'done', name: 'Done', color: '#10B981' },
    ]
    // The "Done" stage is either explicitly named 'done' or is the last stage
    const doneStage = workflowStages.find((s: any) => s.id === 'done' || s.name?.toLowerCase() === 'done')
      || workflowStages[workflowStages.length - 1]
    const doneStageId = doneStage?.id || 'done'
    // Only count tasks in Done stage that are APPROVED as completed
    const completedTasksCount = tasks?.filter(t =>
      t.stage_id === doneStageId && t.approval_status === 'approved'
    ).length || 0
    // Count tasks pending approval (in Done but not yet approved)
    const pendingApprovalCount = tasks?.filter(t =>
      t.stage_id === doneStageId && t.approval_status === 'pending'
    ).length || 0

    return NextResponse.json({
      project: {
        ...project,
        members: memberProfiles,
        tasks_count: tasksCount,
        completed_tasks_count: completedTasksCount,
        pending_approval_count: pendingApprovalCount,
      }
    })
  } catch (error) {
    console.error('[API] Error in GET /api/projects/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update project details (name, description, image)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, image_url } = body

    const supabaseAdmin = getSupabaseAdmin()

    // Check if user has edit permissions (owner or admin)
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Project not found or you are not a member' }, { status: 404 })
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can edit project details' }, { status: 403 })
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (image_url !== undefined) updateData.image_url = image_url

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Validate name is not empty if provided
    if (updateData.name !== undefined && !updateData.name) {
      return NextResponse.json({ error: 'Project name cannot be empty' }, { status: 400 })
    }

    // Update the project
    const { data: updatedProject, error: updateError } = await supabaseAdmin
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select('id, name, description, image_url, color, status')
      .single()

    if (updateError) {
      console.error('[API] Error updating project:', updateError)
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }

    console.log(`[API] Project updated: ${updatedProject.name} by user ${user.id}`)

    return NextResponse.json({
      success: true,
      project: updatedProject
    })
  } catch (error) {
    console.error('[API] Error in PATCH /api/projects/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a project (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check if user is the owner of this project
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Project not found or you are not a member' }, { status: 404 })
    }

    if (membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only the project owner can delete the project' }, { status: 403 })
    }

    // Get project details for logging
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single()

    // Delete related data in order (due to foreign key constraints)
    // 1. Delete task comments
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('project_id', projectId)

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map(t => t.id)
      await supabaseAdmin
        .from('task_comments')
        .delete()
        .in('task_id', taskIds)
    }

    // 2. Delete tasks
    await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('project_id', projectId)

    // 3. Delete project slack integrations
    await supabaseAdmin
      .from('project_slack_integrations')
      .delete()
      .eq('project_id', projectId)

    // 4. Delete project invitations
    await supabaseAdmin
      .from('invitations')
      .delete()
      .eq('project_id', projectId)

    // 5. Delete notifications related to this project
    await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('data->>project_id', projectId)

    // 6. Delete project members
    await supabaseAdmin
      .from('project_members')
      .delete()
      .eq('project_id', projectId)

    // 7. Finally, delete the project itself
    const { error: deleteError } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (deleteError) {
      console.error('[API] Error deleting project:', deleteError)
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
    }

    console.log(`[API] Project deleted: ${project?.name} by user ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully'
    })
  } catch (error) {
    console.error('[API] Error in DELETE /api/projects/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
