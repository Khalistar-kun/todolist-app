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

// GET - Get a single organization with members, announcements, and meetings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check if user is a member of this organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Organization not found or you are not a member' }, { status: 404 })
    }

    // Fetch organization details
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single()

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch all organization members
    const { data: membersData, error: membersError } = await supabaseAdmin
      .from('organization_members')
      .select('id, user_id, role, joined_at')
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: true })

    if (membersError) {
      console.error('[API] Error fetching members:', membersError)
    }

    // Fetch all teams in this organization
    const { data: orgTeams } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('organization_id', organizationId)

    const teamIds = orgTeams?.map(t => t.id) || []
    console.log('[API] Organization', organizationId, 'teams:', teamIds.length)

    // Fetch all projects in this organization's teams
    let projectIds: string[] = []
    if (teamIds.length > 0) {
      const { data: teamProjects } = await supabaseAdmin
        .from('projects')
        .select('id, name')
        .in('team_id', teamIds)

      projectIds = teamProjects?.map(p => p.id) || []
      console.log('[API] Projects in org teams:', projectIds.length, teamProjects?.map(p => p.name))
    }

    // Also fetch projects directly in this organization (without team)
    const { data: directProjects } = await supabaseAdmin
      .from('projects')
      .select('id, name')
      .eq('organization_id', organizationId)

    const directProjectIds = directProjects?.map(p => p.id) || []
    console.log('[API] Direct org projects:', directProjectIds.length, directProjects?.map(p => p.name))

    // Combine all project IDs
    const allProjectIds = [...new Set([...projectIds, ...directProjectIds])]
    console.log('[API] Total unique projects:', allProjectIds.length)

    // Fetch all project members from all projects
    let projectMembers: any[] = []
    if (allProjectIds.length > 0) {
      const { data: projMembers } = await supabaseAdmin
        .from('project_members')
        .select('id, user_id, role, joined_at, project_id')
        .in('project_id', allProjectIds)

      projectMembers = projMembers || []
      console.log('[API] Project members in org:', projectMembers.length)
    }

    // Create a map of org members by user_id
    const orgMemberMap = new Map(
      (membersData || []).map(m => [m.user_id, { ...m, source: 'organization' as const }])
    )

    // Add project members who aren't already org members
    const projectMembersByUser = new Map<string, any>()
    for (const pm of projectMembers) {
      if (!orgMemberMap.has(pm.user_id)) {
        if (!projectMembersByUser.has(pm.user_id)) {
          projectMembersByUser.set(pm.user_id, {
            id: `proj-${pm.user_id}`,
            user_id: pm.user_id,
            role: pm.role,
            joined_at: pm.joined_at,
            source: 'project' as const,
            project_ids: [pm.project_id],
          })
        } else {
          const existing = projectMembersByUser.get(pm.user_id)
          existing.project_ids.push(pm.project_id)
          // Use highest role
          const roleRank = { owner: 3, admin: 2, member: 1 }
          if ((roleRank[pm.role as keyof typeof roleRank] || 0) > (roleRank[existing.role as keyof typeof roleRank] || 0)) {
            existing.role = pm.role
          }
        }
      }
    }

    // Combine all unique user IDs for profile fetching
    const allUserIds = [
      ...Array.from(orgMemberMap.keys()),
      ...Array.from(projectMembersByUser.keys()),
    ]

    // Fetch profiles for all members
    let members: any[] = []
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', allUserIds)

      // Combine org members with their profiles
      const orgMembersWithProfiles = Array.from(orgMemberMap.values()).map(member => ({
        ...member,
        user: profiles?.find(p => p.id === member.user_id) || null
      }))

      // Combine project members with their profiles
      const projectMembersWithProfiles = Array.from(projectMembersByUser.values()).map(member => ({
        ...member,
        user: profiles?.find(p => p.id === member.user_id) || null
      }))

      members = [...orgMembersWithProfiles, ...projectMembersWithProfiles]
    }

    console.log('[API] Total org members:', members.length, '(org:', orgMemberMap.size, '+ project:', projectMembersByUser.size, ')')

    // Fetch announcements (table might not exist yet)
    let announcements: any[] = []
    try {
      const { data: announcementsData, error: announcementsError } = await supabaseAdmin
        .from('organization_announcements')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (announcementsError) {
        console.error('[API] Error fetching announcements:', announcementsError)
      } else if (announcementsData && announcementsData.length > 0) {
        // Fetch author profiles
        const authorIds = [...new Set(announcementsData.map(a => a.created_by))]
        const { data: authorProfiles } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .in('id', authorIds)

        announcements = announcementsData.map(announcement => ({
          ...announcement,
          author: authorProfiles?.find(p => p.id === announcement.created_by) || null
        }))
      }
    } catch (e) {
      console.error('[API] Announcements table may not exist:', e)
    }

    // Fetch upcoming meetings (table might not exist yet)
    let meetings: any[] = []
    try {
      const { data: meetingsData, error: meetingsError } = await supabaseAdmin
        .from('organization_meetings')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })

      if (meetingsError) {
        console.error('[API] Error fetching meetings:', meetingsError)
      } else {
        meetings = meetingsData || []
      }
    } catch (e) {
      console.error('[API] Meetings table may not exist:', e)
    }

    return NextResponse.json({
      organization: {
        ...organization,
        role: membership.role,
      },
      members: members || [],
      announcements,
      meetings,
    })
  } catch (error) {
    console.error('[API] Error in GET /api/organizations/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update organization details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, avatar_url, image_url } = body

    const supabaseAdmin = getSupabaseAdmin()

    // Check if user has admin/owner permissions
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Organization not found or you are not a member' }, { status: 404 })
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can edit organization details' }, { status: 403 })
    }

    // Build update object
    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    // Support both avatar_url and image_url - store as image_url in DB
    if (avatar_url !== undefined) updateData.image_url = avatar_url
    if (image_url !== undefined) updateData.image_url = image_url

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    if (updateData.name !== undefined && !updateData.name) {
      return NextResponse.json({ error: 'Organization name cannot be empty' }, { status: 400 })
    }

    const { data: updatedOrg, error: updateError } = await supabaseAdmin
      .from('organizations')
      .update(updateData)
      .eq('id', organizationId)
      .select()
      .single()

    if (updateError) {
      console.error('[API] Error updating organization:', updateError)
      console.error('[API] Update data was:', JSON.stringify(updateData))
      return NextResponse.json({ error: `Failed to update organization: ${updateError.message}` }, { status: 500 })
    }

    console.log(`[API] Organization updated: ${updatedOrg.name} by user ${user.id}`)

    return NextResponse.json({ organization: updatedOrg })
  } catch (error) {
    console.error('[API] Error in PATCH /api/organizations/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete an organization (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check if user is the owner of this organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Organization not found or you are not a member' }, { status: 404 })
    }

    if (membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only the organization owner can delete the organization' }, { status: 403 })
    }

    // Get organization details for logging
    const { data: organization } = await supabaseAdmin
      .from('organizations')
      .select('name, slug')
      .eq('id', organizationId)
      .single()

    // Delete related data in order (due to foreign key constraints)
    // 1. Delete org slack integrations
    await supabaseAdmin
      .from('org_slack_integrations')
      .delete()
      .eq('organization_id', organizationId)

    // 2. Delete organization meetings
    await supabaseAdmin
      .from('organization_meetings')
      .delete()
      .eq('organization_id', organizationId)

    // 3. Delete organization announcements
    await supabaseAdmin
      .from('organization_announcements')
      .delete()
      .eq('organization_id', organizationId)

    // 4. Delete notifications related to this org
    await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('organization_id', organizationId)

    // 5. Delete organization members
    await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('organization_id', organizationId)

    // 6. Update projects to remove organization reference (don't delete projects)
    await supabaseAdmin
      .from('projects')
      .update({ organization_id: null })
      .eq('organization_id', organizationId)

    // 7. Finally, delete the organization itself
    const { error: deleteError } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', organizationId)

    if (deleteError) {
      console.error('[API] Error deleting organization:', deleteError)
      return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 })
    }

    console.log(`[API] Organization deleted: ${organization?.name} (${organization?.slug}) by user ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Organization deleted successfully'
    })
  } catch (error) {
    console.error('[API] Error in DELETE /api/organizations/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
