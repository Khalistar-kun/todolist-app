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
