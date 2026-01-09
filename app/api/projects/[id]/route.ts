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
        .select('id, name, description, color, status, organization_id, workflow_stages, created_at')
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

      // Get task status counts
      supabaseAdmin
        .from('tasks')
        .select('status')
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
    const completedTasksCount = tasks?.filter(t => t.status === 'done').length || 0

    return NextResponse.json({
      project: {
        ...project,
        members: memberProfiles,
        tasks_count: tasksCount,
        completed_tasks_count: completedTasksCount,
      }
    })
  } catch (error) {
    console.error('[API] Error in GET /api/projects/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
