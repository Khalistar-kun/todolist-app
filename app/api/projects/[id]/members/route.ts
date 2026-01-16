import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/email-service'

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

// Role hierarchy for permission checks
const roleHierarchy: Record<string, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
}

function canManageRole(userRole: string, targetRole: string): boolean {
  // User can only assign roles lower than their own
  return roleHierarchy[userRole] > roleHierarchy[targetRole]
}

function canManageMembers(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

// GET - List all members of a project
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

    // Verify user is a member of the project
    const { data: membership } = await supabaseAdmin
      .from('TODOAAPP.project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    // Get all members with their profiles
    const { data: members, error } = await supabaseAdmin
      .from('TODOAAPP.project_members')
      .select('id, user_id, role, joined_at')
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('[API] Error fetching members:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch profiles for each member
    const membersWithProfiles = await Promise.all(
      (members || []).map(async (member) => {
        const { data: profile } = await supabaseAdmin
          .from('TODOAAPP.profiles')
          .select('id, full_name, email, avatar_url')
          .eq('id', member.user_id)
          .single()

        return {
          ...member,
          user: profile || { id: member.user_id, full_name: null, email: '', avatar_url: null }
        }
      })
    )

    // Get pending invitations (only for admins/owners)
    let pendingInvitations: any[] = []
    if (canManageMembers(membership.role)) {
      const { data: invitations } = await supabaseAdmin
        .from('project_invitations')
        .select('id, email, role, status, created_at, expires_at')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      pendingInvitations = invitations || []
    }

    return NextResponse.json({
      members: membersWithProfiles,
      pendingInvitations,
      currentUserRole: membership.role
    })
  } catch (error) {
    console.error('[API] Error in GET /api/projects/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to send invitation email using SMTP
async function sendInvitationEmail(
  to: string,
  inviterName: string,
  projectName: string,
  role: string,
  inviteToken: string
): Promise<{ sent: boolean; error?: string }> {
  console.log('[Email] Attempting to send invitation email to:', to)

  try {
    const result = await emailService.sendProjectInvitationEmail(
      to,
      inviterName,
      projectName,
      role,
      inviteToken
    )

    if (result.success) {
      console.log('[Email] Invitation email sent successfully to', to, 'messageId:', result.messageId)
      return { sent: true }
    } else {
      console.error('[Email] Failed to send invitation email:', result.error)
      return { sent: false, error: result.error }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Email] Error sending invitation email:', errorMessage)
    return { sent: false, error: errorMessage }
  }
}

// POST - Add a new member to the project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('[API] POST /api/projects/[id]/members called')
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    const { email, role = 'member' } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!['viewer', 'member', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be viewer, member, or admin' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check current user's role
    const { data: currentMembership } = await supabaseAdmin
      .from('TODOAAPP.project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!currentMembership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    if (!canManageMembers(currentMembership.role)) {
      return NextResponse.json({ error: 'You do not have permission to add members' }, { status: 403 })
    }

    if (!canManageRole(currentMembership.role, role)) {
      return NextResponse.json({ error: 'You cannot assign a role equal to or higher than your own' }, { status: 403 })
    }

    // Get project info for the invitation email
    const { data: project } = await supabaseAdmin
      .from('TODOAAPP.projects')
      .select('name')
      .eq('id', projectId)
      .single()

    // Get inviter's profile
    const { data: inviterProfile } = await supabaseAdmin
      .from('TODOAAPP.profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'Someone'
    const projectName = project?.name || 'a project'

    // Find the user by email in profiles
    const { data: targetProfile } = await supabaseAdmin
      .from('TODOAAPP.profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .single()

    if (targetProfile) {
      // User exists with a profile - add them directly
      // Check if user is already a member
      const { data: existingMember } = await supabaseAdmin
        .from('TODOAAPP.project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', targetProfile.id)
        .single()

      if (existingMember) {
        return NextResponse.json({ error: 'User is already a member of this project' }, { status: 400 })
      }

      // Add the member directly
      const { data: newMember, error: insertError } = await supabaseAdmin
        .from('TODOAAPP.project_members')
        .insert({
          project_id: projectId,
          user_id: targetProfile.id,
          role,
        })
        .select()
        .single()

      if (insertError) {
        console.error('[API] Error adding member:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      console.log(`[API] Added member ${targetProfile.email} to project ${projectId} as ${role}`)

      // Create a notification for the added user
      await supabaseAdmin.from('TODOAAPP.notifications').insert({
        user_id: targetProfile.id,
        type: 'project_invite',
        title: 'Added to project',
        message: `${inviterName} added you to "${projectName}" as ${role}`,
        data: {
          project_id: projectId,
          project_name: projectName,
          invited_by: user.id,
          invited_by_name: inviterName,
          role,
        },
      })

      return NextResponse.json({
        member: {
          ...newMember,
          user: targetProfile
        }
      }, { status: 201 })
    }

    // User doesn't have a profile yet - create an invitation
    console.log(`[API] User ${email} not found, creating invitation`)

    // Check if there's already a pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from('project_invitations')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('email', email)
      .single()

    if (existingInvite) {
      if (existingInvite.status === 'pending') {
        return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 400 })
      }
      // If previous invite was declined/expired, delete it so we can create a new one
      await supabaseAdmin
        .from('project_invitations')
        .delete()
        .eq('id', existingInvite.id)
    }

    // Create the invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('project_invitations')
      .insert({
        project_id: projectId,
        email: email.toLowerCase(),
        role,
        invited_by: user.id,
      })
      .select()
      .single()

    if (inviteError) {
      console.error('[API] Error creating invitation:', inviteError)
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    console.log(`[API] Created invitation for ${email} to project ${projectId}`)

    // Send invitation email
    const emailResult = await sendInvitationEmail(
      email,
      inviterName,
      projectName,
      role,
      invitation.token
    )

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expires_at: invitation.expires_at,
        email_sent: emailResult.sent,
        email_error: emailResult.error,
      },
      message: emailResult.sent
        ? `Invitation email sent to ${email}. They will be added when they sign up or log in.`
        : `Invitation created for ${email}, but email could not be sent${emailResult.error ? `: ${emailResult.error}` : ''}. Share the invite link manually.`
    }, { status: 201 })
  } catch (error) {
    console.error('[API] Error in POST /api/projects/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update a member's role
export async function PATCH(
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
    const body = await request.json()
    const { user_id, role } = body

    if (!user_id || !role) {
      return NextResponse.json({ error: 'user_id and role are required' }, { status: 400 })
    }

    if (!['viewer', 'member', 'admin', 'owner'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check current user's role
    const { data: currentMembership } = await supabaseAdmin
      .from('TODOAAPP.project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!currentMembership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    if (!canManageMembers(currentMembership.role)) {
      return NextResponse.json({ error: 'You do not have permission to update members' }, { status: 403 })
    }

    // Get target member's current role
    const { data: targetMembership } = await supabaseAdmin
      .from('TODOAAPP.project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user_id)
      .single()

    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Cannot change owner's role unless you're also an owner
    if (targetMembership.role === 'owner' && currentMembership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can modify other owners' }, { status: 403 })
    }

    // Cannot promote someone to a role equal or higher than your own (except owner promoting to owner)
    if (role !== 'owner' && !canManageRole(currentMembership.role, role)) {
      return NextResponse.json({ error: 'You cannot assign a role equal to or higher than your own' }, { status: 403 })
    }

    // Special case: transferring ownership
    if (role === 'owner') {
      if (currentMembership.role !== 'owner') {
        return NextResponse.json({ error: 'Only owners can transfer ownership' }, { status: 403 })
      }
      // When transferring ownership, demote current owner to admin
      await supabaseAdmin
        .from('TODOAAPP.project_members')
        .update({ role: 'admin' })
        .eq('project_id', projectId)
        .eq('user_id', user.id)
    }

    // Update the member's role
    const { data: updatedMember, error: updateError } = await supabaseAdmin
      .from('TODOAAPP.project_members')
      .update({ role })
      .eq('project_id', projectId)
      .eq('user_id', user_id)
      .select()
      .single()

    if (updateError) {
      console.error('[API] Error updating member:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`[API] Updated member ${user_id} role to ${role} in project ${projectId}`)

    return NextResponse.json({ member: updatedMember })
  } catch (error) {
    console.error('[API] Error in PATCH /api/projects/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a member from the project
export async function DELETE(
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
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('user_id')

    if (!targetUserId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check current user's role
    const { data: currentMembership } = await supabaseAdmin
      .from('TODOAAPP.project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!currentMembership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    // Users can remove themselves (leave project)
    const isLeavingProject = targetUserId === user.id

    if (!isLeavingProject && !canManageMembers(currentMembership.role)) {
      return NextResponse.json({ error: 'You do not have permission to remove members' }, { status: 403 })
    }

    // Get target member's role
    const { data: targetMembership } = await supabaseAdmin
      .from('TODOAAPP.project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', targetUserId)
      .single()

    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Cannot remove the last owner
    if (targetMembership.role === 'owner') {
      const { data: owners } = await supabaseAdmin
        .from('TODOAAPP.project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('role', 'owner')

      if (owners && owners.length <= 1) {
        return NextResponse.json({
          error: 'Cannot remove the last owner. Transfer ownership first.'
        }, { status: 400 })
      }
    }

    // Admins cannot remove other admins or owners (unless leaving themselves)
    if (!isLeavingProject &&
        currentMembership.role !== 'owner' &&
        roleHierarchy[targetMembership.role] >= roleHierarchy[currentMembership.role]) {
      return NextResponse.json({
        error: 'You cannot remove members with a role equal to or higher than your own'
      }, { status: 403 })
    }

    // Remove the member
    const { error: deleteError } = await supabaseAdmin
      .from('TODOAAPP.project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', targetUserId)

    if (deleteError) {
      console.error('[API] Error removing member:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    console.log(`[API] Removed member ${targetUserId} from project ${projectId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error in DELETE /api/projects/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
