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

// POST - Add member to team
export async function POST(
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
    const { user_id, role = 'member' } = body

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get team to find organization
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('organization_id')
      .eq('id', teamId)
      .single()

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Check current user has permission
    const { data: membership } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only team owners and admins can add members' }, { status: 403 })
    }

    // Verify target user is in the organization
    const { data: targetOrgMembership } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', team.organization_id)
      .eq('user_id', user_id)
      .single()

    if (!targetOrgMembership) {
      return NextResponse.json({ error: 'User must be a member of the organization first' }, { status: 400 })
    }

    // Check if already a member
    const { data: existingMember } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .single()

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this team' }, { status: 400 })
    }

    // Add member
    const { data: newMember, error: insertError } = await supabaseAdmin
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id,
        role: ['owner', 'admin', 'member'].includes(role) ? role : 'member',
      })
      .select(`
        id,
        user_id,
        role,
        joined_at,
        user:profiles(id, full_name, email, avatar_url)
      `)
      .single()

    if (insertError) {
      console.error('[API] Error adding team member:', insertError)
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    return NextResponse.json({ member: newMember }, { status: 201 })
  } catch (error) {
    console.error('[API] Error in POST /api/teams/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove member from team
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

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('user_id')

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check current user has permission (or is removing themselves)
    const { data: membership } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    const isSelf = targetUserId === user.id
    const isAdmin = membership && ['owner', 'admin'].includes(membership.role)

    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Don't allow removing the last owner
    if (!isSelf) {
      const { data: targetMember } = await supabaseAdmin
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', targetUserId)
        .single()

      if (targetMember?.role === 'owner') {
        const { count } = await supabaseAdmin
          .from('team_members')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', teamId)
          .eq('role', 'owner')

        if (count && count <= 1) {
          return NextResponse.json({ error: 'Cannot remove the last owner' }, { status: 400 })
        }
      }
    }

    // Remove member
    const { error: deleteError } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', targetUserId)

    if (deleteError) {
      console.error('[API] Error removing team member:', deleteError)
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error in DELETE /api/teams/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update member role
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
    const { user_id, role } = body

    if (!user_id || !role) {
      return NextResponse.json({ error: 'User ID and role are required' }, { status: 400 })
    }

    if (!['owner', 'admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check current user is owner
    const { data: membership } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can change member roles' }, { status: 403 })
    }

    // Update role
    const { data: updatedMember, error: updateError } = await supabaseAdmin
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .select(`
        id,
        user_id,
        role,
        joined_at,
        user:profiles(id, full_name, email, avatar_url)
      `)
      .single()

    if (updateError) {
      console.error('[API] Error updating member role:', updateError)
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }

    return NextResponse.json({ member: updatedMember })
  } catch (error) {
    console.error('[API] Error in PATCH /api/teams/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
