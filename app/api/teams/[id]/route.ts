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
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
  return supabase.auth.getUser()
}

// GET - Get team details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get team with organization info
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select(`
        id,
        name,
        description,
        color,
        image_url,
        organization_id,
        created_by,
        created_at,
        updated_at,
        organization:organizations(id, name)
      `)
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Verify user has access (is org member or team member)
    const { data: membership } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    const { data: orgMembership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', team.organization_id)
      .eq('user_id', user.id)
      .single()

    if (!membership && !orgMembership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get team members
    const { data: teamMembers } = await supabaseAdmin
      .from('team_members')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        user:profiles(id, full_name, email, avatar_url)
      `)
      .eq('team_id', teamId)

    // Get team projects
    const { data: projects } = await supabaseAdmin
      .from('projects')
      .select('id, name, description, color, image_url, status, created_at')
      .eq('team_id', teamId)
      .order('updated_at', { ascending: false })

    // Get all project members from team's projects
    const projectIds = projects?.map(p => p.id) || []
    let projectMembers: any[] = []

    console.log('[API] Team projects:', projectIds.length, 'projects', projectIds)

    if (projectIds.length > 0) {
      const { data: projMembers, error: projMembersError } = await supabaseAdmin
        .from('project_members')
        .select(`
          id,
          user_id,
          role,
          joined_at,
          project_id,
          user:profiles(id, full_name, email, avatar_url)
        `)
        .in('project_id', projectIds)

      if (projMembersError) {
        console.error('[API] Error fetching project members:', projMembersError)
      }
      console.log('[API] Project members found:', projMembers?.length || 0, 'for projects', projectIds)
      console.log('[API] Project members data:', JSON.stringify(projMembers?.map(pm => ({ user_id: pm.user_id, email: pm.user?.email }))))
      projectMembers = projMembers || []
    }

    // Create a map of team members by user_id
    const teamMemberMap = new Map(
      (teamMembers || []).map(m => [m.user_id, { ...m, source: 'team' as const }])
    )
    console.log('[API] Team members user_ids:', Array.from(teamMemberMap.keys()))

    // Add project members who aren't already team members
    const projectMembersByUser = new Map<string, any>()
    for (const pm of projectMembers) {
      console.log('[API] Checking project member:', pm.user_id, 'already in team?', teamMemberMap.has(pm.user_id))
      if (!teamMemberMap.has(pm.user_id)) {
        // If user is in multiple projects, keep track of all their project roles
        if (!projectMembersByUser.has(pm.user_id)) {
          projectMembersByUser.set(pm.user_id, {
            id: `proj-${pm.user_id}`,
            user_id: pm.user_id,
            role: pm.role,
            joined_at: pm.joined_at,
            user: pm.user,
            source: 'project' as const,
            project_ids: [pm.project_id],
          })
        } else {
          // Add to existing entry's project list
          const existing = projectMembersByUser.get(pm.user_id)
          existing.project_ids.push(pm.project_id)
          // Use the highest role among projects (owner > admin > member)
          const roleRank = { owner: 3, admin: 2, member: 1 }
          if ((roleRank[pm.role as keyof typeof roleRank] || 0) > (roleRank[existing.role as keyof typeof roleRank] || 0)) {
            existing.role = pm.role
          }
        }
      }
    }

    // Combine team members and project-only members
    const allMembers = [
      ...(teamMembers || []).map(m => ({ ...m, source: 'team' as const })),
      ...Array.from(projectMembersByUser.values()),
    ]

    console.log('[API] Team members:', teamMembers?.length || 0, 'Project-only members:', projectMembersByUser.size, 'Total:', allMembers.length)

    return NextResponse.json({
      team: {
        ...team,
        user_role: membership?.role || null,
        members: allMembers,
        projects: projects || [],
      }
    })
  } catch (error) {
    console.error('[API] Error in GET /api/teams/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update team
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, color, image_url } = body

    const supabaseAdmin = getSupabaseAdmin()

    // Check user has edit permission
    const { data: membership } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only team owners and admins can edit team details' }, { status: 403 })
    }

    // Build update object
    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (color !== undefined) updateData.color = color
    if (image_url !== undefined) updateData.image_url = image_url

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    if (updateData.name !== undefined && !updateData.name) {
      return NextResponse.json({ error: 'Team name cannot be empty' }, { status: 400 })
    }

    const { data: updatedTeam, error: updateError } = await supabaseAdmin
      .from('teams')
      .update(updateData)
      .eq('id', teamId)
      .select()
      .single()

    if (updateError) {
      console.error('[API] Error updating team:', updateError)
      return NextResponse.json({ error: 'Failed to update team' }, { status: 500 })
    }

    return NextResponse.json({ team: updatedTeam })
  } catch (error) {
    console.error('[API] Error in PATCH /api/teams/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check user is team owner
    const { data: membership } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only team owners can delete teams' }, { status: 403 })
    }

    // Delete team (cascades to team_members, projects get team_id set to null)
    const { error: deleteError } = await supabaseAdmin
      .from('teams')
      .delete()
      .eq('id', teamId)

    if (deleteError) {
      console.error('[API] Error deleting team:', deleteError)
      return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error in DELETE /api/teams/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
