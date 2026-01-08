import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getOrgSlackConfig, notifyOrgMeeting } from '@/lib/org-slack'

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

// POST - Create meeting
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
      return NextResponse.json({ error: 'Only admins can schedule meetings' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, scheduled_at, duration_minutes, meeting_link } = body

    if (!title?.trim() || !scheduled_at) {
      return NextResponse.json({ error: 'Title and scheduled time are required' }, { status: 400 })
    }

    const { data: meeting, error } = await supabaseAdmin
      .from('organization_meetings')
      .insert({
        organization_id: organizationId,
        title: title.trim(),
        description: description?.trim() || null,
        scheduled_at,
        duration_minutes: duration_minutes || 60,
        meeting_link: meeting_link?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Error creating meeting:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notify all organization members about the new meeting
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    const { data: schedulerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const schedulerName = schedulerProfile?.full_name || schedulerProfile?.email || 'Someone'
    const orgName = orgData?.name || 'your organization'

    // Format the meeting time for the notification
    const meetingDate = new Date(scheduled_at)
    const formattedDate = meetingDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

    // Get all organization members except the scheduler
    const { data: allMembers } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)
      .neq('user_id', user.id)

    // Create notifications for all members
    if (allMembers && allMembers.length > 0) {
      const notifications = allMembers.map(member => ({
        user_id: member.user_id,
        type: 'new_meeting',
        title: 'New meeting scheduled',
        message: `${schedulerName} scheduled a meeting in ${orgName}: "${title.trim()}" on ${formattedDate}`,
        data: {
          organization_id: organizationId,
          organization_name: orgName,
          meeting_id: meeting.id,
          scheduled_at,
          scheduled_by: user.id,
        },
      }))

      await supabaseAdmin.from('notifications').insert(notifications)
    }

    // Send Slack notification if configured
    const slackConfig = await getOrgSlackConfig(supabaseAdmin, organizationId)
    if (slackConfig) {
      await notifyOrgMeeting(
        slackConfig,
        orgName,
        title.trim(),
        description?.trim() || null,
        scheduled_at,
        duration_minutes || 60,
        meeting_link?.trim() || null,
        schedulerName
      )
    }

    return NextResponse.json({ meeting }, { status: 201 })
  } catch (error) {
    console.error('[API] Error in POST /api/organizations/[id]/meetings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
