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

    // Fetch all members
    const { data: membersData, error: membersError } = await supabaseAdmin
      .from('organization_members')
      .select('id, user_id, role, joined_at')
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: true })

    if (membersError) {
      console.error('[API] Error fetching members:', membersError)
    }

    // Fetch profiles for all members
    let members: any[] = []
    if (membersData && membersData.length > 0) {
      const userIds = membersData.map(m => m.user_id)
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .in('id', userIds)

      // Combine members with their profiles
      members = membersData.map(member => ({
        ...member,
        user: profiles?.find(p => p.id === member.user_id) || null
      }))
    }

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
