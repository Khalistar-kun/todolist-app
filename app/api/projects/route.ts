import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Create admin client directly here
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

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // Create server-side supabase client to get the user
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, description, color, workflow_stages } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    // Get admin client
    const supabaseAdmin = getSupabaseAdmin()

    // Step 1: Check if user already has an organization
    console.log('[API] Checking for existing organization for user:', user.id)
    const { data: existingMembership } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    let finalOrgId: string

    if (existingMembership?.organization_id) {
      console.log('[API] Found existing organization:', existingMembership.organization_id)
      finalOrgId = existingMembership.organization_id
    } else {
      // Step 2: Create a new organization for the user
      console.log('[API] Creating new organization for user')
      const userEmail = user.email || 'user'
      const username = userEmail.split('@')[0]
      const slug = `${username}-workspace-${Date.now()}`

      const { data: newOrg, error: createOrgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: `${username}'s Workspace`,
          slug: slug,
          description: 'Personal workspace',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (createOrgError) {
        console.error('[API] Failed to create organization:', createOrgError)
        return NextResponse.json(
          { error: `Failed to create workspace: ${createOrgError.message}` },
          { status: 500 }
        )
      }

      finalOrgId = newOrg.id
      console.log('[API] Created organization:', finalOrgId)

      // Step 3: Add user as organization owner
      const { error: orgMemberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: finalOrgId,
          user_id: user.id,
          role: 'owner',
        })

      if (orgMemberError) {
        console.error('[API] Failed to add org member:', orgMemberError)
        // Continue anyway, the org was created
      }
    }

    // Step 4: Create the project
    console.log('[API] Creating project in organization:', finalOrgId)
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .insert({
        name,
        description: description || null,
        color: color || '#3B82F6',
        organization_id: finalOrgId,
        created_by: user.id,
        workflow_stages: workflow_stages || [
          { id: 'todo', name: 'To Do', color: '#6B7280' },
          { id: 'in_progress', name: 'In Progress', color: '#3B82F6' },
          { id: 'review', name: 'Review', color: '#F59E0B' },
          { id: 'done', name: 'Done', color: '#10B981' },
        ],
      })
      .select()
      .single()

    if (projectError) {
      console.error('[API] Failed to create project:', projectError)
      return NextResponse.json(
        { error: `Failed to create project: ${projectError.message}` },
        { status: 500 }
      )
    }

    console.log('[API] Created project:', project.id)

    // Step 5: Add user as project owner
    const { error: projectMemberError } = await supabaseAdmin
      .from('project_members')
      .insert({
        project_id: project.id,
        user_id: user.id,
        role: 'owner',
      })

    if (projectMemberError) {
      console.error('[API] Failed to add project member:', projectMemberError)
      // Project was created, so return success but log the error
    }

    console.log('[API] Project creation complete')
    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('[API] Error creating project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get admin client with correct schema
    const supabaseAdmin = getSupabaseAdmin()

    // Get user's projects using admin client
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('project_members')
      .select(`
        project_id,
        role,
        project:projects(*)
      `)
      .eq('user_id', user.id)

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 }
      )
    }

    const rawProjects = memberships?.map(m => m.project).filter(Boolean) || []

    // Fetch task counts for all projects in parallel
    const projectsWithCounts = await Promise.all(
      rawProjects.map(async (project: any) => {
        // Get all tasks for this project
        const { data: tasks } = await supabaseAdmin
          .from('tasks')
          .select('stage_id, approval_status')
          .eq('project_id', project.id)

        const tasksCount = tasks?.length || 0

        // Find the "Done" stage
        const workflowStages = project.workflow_stages || [
          { id: 'todo', name: 'To Do', color: '#6B7280' },
          { id: 'in_progress', name: 'In Progress', color: '#3B82F6' },
          { id: 'review', name: 'Review', color: '#F59E0B' },
          { id: 'done', name: 'Done', color: '#10B981' },
        ]
        const doneStage = workflowStages.find((s: any) => s.id === 'done' || s.name?.toLowerCase() === 'done')
          || workflowStages[workflowStages.length - 1]
        const doneStageId = doneStage?.id || 'done'

        // Count completed tasks (in Done stage AND approved)
        const completedTasksCount = tasks?.filter((t: any) =>
          t.stage_id === doneStageId && t.approval_status === 'approved'
        ).length || 0

        // Count pending approval tasks
        const pendingApprovalCount = tasks?.filter((t: any) =>
          t.stage_id === doneStageId && t.approval_status === 'pending'
        ).length || 0

        return {
          ...project,
          tasks_count: tasksCount,
          completed_tasks_count: completedTasksCount,
          pending_approval_count: pendingApprovalCount,
        }
      })
    )

    return NextResponse.json({ projects: projectsWithCounts })
  } catch (error) {
    console.error('[API] Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
