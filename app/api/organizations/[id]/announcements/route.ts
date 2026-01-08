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

// POST - Create announcement
export async function POST(
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

    // Check if user is admin/owner
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only admins can post announcements' }, { status: 403 })
    }

    const body = await request.json()
    const { title, content } = body

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const { data: announcement, error } = await supabaseAdmin
      .from('organization_announcements')
      .insert({
        organization_id: organizationId,
        title: title.trim(),
        content: content.trim(),
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Error creating announcement:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notify all organization members about the new announcement
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    const { data: posterProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const posterName = posterProfile?.full_name || posterProfile?.email || 'Someone'
    const orgName = orgData?.name || 'your organization'

    // Get all organization members except the poster
    const { data: allMembers } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)
      .neq('user_id', user.id)

    // Create notifications for all members
    if (allMembers && allMembers.length > 0) {
      const notifications = allMembers.map(member => ({
        user_id: member.user_id,
        type: 'new_announcement',
        title: 'New announcement posted',
        message: `${posterName} posted an announcement in ${orgName}: "${title.trim()}"`,
        data: {
          organization_id: organizationId,
          organization_name: orgName,
          announcement_id: announcement.id,
          posted_by: user.id,
        },
      }))

      await supabaseAdmin.from('notifications').insert(notifications)
    }

    return NextResponse.json({ announcement }, { status: 201 })
  } catch (error) {
    console.error('[API] Error in POST /api/organizations/[id]/announcements:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
