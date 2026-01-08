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

// POST - Invite member to organization
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
      return NextResponse.json({ error: 'Only admins can invite members' }, { status: 403 })
    }

    const body = await request.json()
    const { email, role } = body

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Validate role
    const validRoles = ['member', 'admin']
    const memberRole = validRoles.includes(role) ? role : 'member'

    // Find user by email
    const { data: targetUser } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found with that email' }, { status: 404 })
    }

    // Check if already a member
    const { data: existingMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', targetUser.id)
      .single()

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 })
    }

    // Add member
    const { data: newMember, error } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: targetUser.id,
        role: memberRole,
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Error adding member:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create notification for the invited user
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    const { data: inviterProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'Someone'
    const orgName = orgData?.name || 'an organization'

    // Get invited user's name
    const { data: invitedProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', targetUser.id)
      .single()

    const invitedName = invitedProfile?.full_name || invitedProfile?.email || 'A new member'

    // Notify the invited user
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: targetUser.id,
        type: 'organization_invite',
        title: "You've been added to an organization",
        message: `${inviterName} added you to ${orgName} as ${memberRole}`,
        data: {
          organization_id: organizationId,
          organization_name: orgName,
          role: memberRole,
          invited_by: user.id,
        },
      })

    // Get organization owner to notify them (if they didn't do the inviting)
    const { data: ownerMember } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('role', 'owner')
      .single()

    if (ownerMember && ownerMember.user_id !== user.id) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: ownerMember.user_id,
          type: 'member_added',
          title: 'New member added to organization',
          message: `${inviterName} added ${invitedName} to ${orgName}`,
          data: {
            organization_id: organizationId,
            organization_name: orgName,
            new_member_id: targetUser.id,
            added_by: user.id,
          },
        })
    }

    return NextResponse.json({ member: newMember }, { status: 201 })
  } catch (error) {
    console.error('[API] Error in POST /api/organizations/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
