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

// GET - Get pending invitations for the current user
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get user's email from profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    if (!profile?.email) {
      return NextResponse.json({ invitations: [] })
    }

    // Find pending invitations for this email
    const { data: invitations, error } = await supabaseAdmin
      .from('project_invitations')
      .select(`
        id,
        project_id,
        role,
        status,
        created_at,
        expires_at,
        token
      `)
      .eq('email', profile.email.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    if (error) {
      console.error('[API] Error fetching invitations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get project details for each invitation
    const invitationsWithProjects = await Promise.all(
      (invitations || []).map(async (inv) => {
        const { data: project } = await supabaseAdmin
          .from('projects')
          .select('id, name, color')
          .eq('id', inv.project_id)
          .single()

        const { data: inviter } = await supabaseAdmin
          .from('project_invitations')
          .select('invited_by')
          .eq('id', inv.id)
          .single()

        let inviterProfile = null
        if (inviter?.invited_by) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, email')
            .eq('id', inviter.invited_by)
            .single()
          inviterProfile = profile
        }

        return {
          ...inv,
          project,
          invited_by: inviterProfile,
        }
      })
    )

    return NextResponse.json({ invitations: invitationsWithProjects })
  } catch (error) {
    console.error('[API] Error in GET /api/invitations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Accept or decline an invitation
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { invitation_id, token, action } = body

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be accept or decline' }, { status: 400 })
    }

    if (!invitation_id && !token) {
      return NextResponse.json({ error: 'invitation_id or token is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get user's email
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    if (!profile?.email) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Find the invitation
    let query = supabaseAdmin
      .from('project_invitations')
      .select('*')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    if (invitation_id) {
      query = query.eq('id', invitation_id)
    } else if (token) {
      query = query.eq('token', token)
    }

    const { data: invitation, error: findError } = await query.single()

    if (findError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found or expired' }, { status: 404 })
    }

    // Verify the invitation is for this user's email
    if (invitation.email.toLowerCase() !== profile.email.toLowerCase()) {
      return NextResponse.json({ error: 'This invitation is not for your email address' }, { status: 403 })
    }

    if (action === 'decline') {
      // Update invitation status to declined
      await supabaseAdmin
        .from('project_invitations')
        .update({ status: 'declined' })
        .eq('id', invitation.id)

      return NextResponse.json({ success: true, message: 'Invitation declined' })
    }

    // Accept the invitation - add user to project
    const { data: existingMember } = await supabaseAdmin
      .from('project_members')
      .select('id')
      .eq('project_id', invitation.project_id)
      .eq('user_id', user.id)
      .single()

    if (existingMember) {
      // User is already a member, just mark invitation as accepted
      await supabaseAdmin
        .from('project_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      return NextResponse.json({
        success: true,
        message: 'You are already a member of this project',
        project_id: invitation.project_id,
      })
    }

    // Add user to project
    const { error: memberError } = await supabaseAdmin
      .from('project_members')
      .insert({
        project_id: invitation.project_id,
        user_id: user.id,
        role: invitation.role,
      })

    if (memberError) {
      console.error('[API] Error adding member:', memberError)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    // Update invitation status
    await supabaseAdmin
      .from('project_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    // Get project name for response
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('name')
      .eq('id', invitation.project_id)
      .single()

    console.log(`[API] User ${profile.email} accepted invitation to project ${invitation.project_id}`)

    return NextResponse.json({
      success: true,
      message: `You have joined "${project?.name || 'the project'}" as ${invitation.role}`,
      project_id: invitation.project_id,
    })
  } catch (error) {
    console.error('[API] Error in POST /api/invitations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Cancel a pending invitation (by project admin)
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('id')

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation id is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get the invitation
    const { data: invitation } = await supabaseAdmin
      .from('project_invitations')
      .select('project_id')
      .eq('id', invitationId)
      .single()

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Check if user has permission to cancel
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', invitation.project_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'You do not have permission to cancel invitations' }, { status: 403 })
    }

    // Delete the invitation
    await supabaseAdmin
      .from('project_invitations')
      .delete()
      .eq('id', invitationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error in DELETE /api/invitations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
