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

// GET - Fetch Slack integration for an organization
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

    // Verify user is a member of the organization
    const { data: membership } = await supabaseAdmin
      .from('TODOAAPP.organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
    }

    // Get Slack integration
    const { data: integration, error } = await supabaseAdmin
      .from('org_slack_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[API] Error fetching org Slack integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ integration: integration || null })
  } catch (error) {
    console.error('[API] Error in GET /api/organizations/[id]/slack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update Slack integration
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

    const body = await request.json()
    const {
      access_token,
      channel_id,
      channel_name,
      notify_on_announcement = true,
      notify_on_meeting = true,
      notify_on_member_join = true,
      notify_on_member_leave = true,
    } = body

    if (!access_token) {
      return NextResponse.json({ error: 'Access Token is required' }, { status: 400 })
    }

    if (!channel_id) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }

    // Validate access token format (supports xoxb-, xoxp-, and xoxe.xoxp- formats)
    if (!access_token.startsWith('xoxb-') && !access_token.startsWith('xoxp-') && !access_token.startsWith('xoxe.xoxp-')) {
      return NextResponse.json({ error: 'Invalid Slack Access Token format' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify user is an admin or owner of the organization
    const { data: membership } = await supabaseAdmin
      .from('TODOAAPP.organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
    }

    if (!['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only admins and owners can configure Slack integration' }, { status: 403 })
    }

    // Get organization name for the test message
    const { data: orgData } = await supabaseAdmin
      .from('TODOAAPP.organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    const orgName = orgData?.name || 'your organization'

    // Test the access token by sending a test message via chat.postMessage API
    try {
      const testResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: channel_id,
          text: `TodoList organization "${orgName}" connected successfully! You will now receive notifications in this channel.`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: 'Organization Connected',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${orgName}* is now connected to Slack. You will receive notifications for:\n• New announcements\n• Scheduled meetings\n• Member changes`,
              },
            },
          ],
        }),
      })

      const testResult = await testResponse.json()

      if (!testResult.ok) {
        console.error('[API] Slack API error:', testResult.error)
        let errorMessage = 'Failed to connect to Slack. '

        switch (testResult.error) {
          case 'channel_not_found':
            errorMessage += 'Channel not found. Please check the Channel ID.'
            break
          case 'not_in_channel':
            errorMessage += 'Bot is not in the channel. Please invite the bot to the channel first.'
            break
          case 'invalid_auth':
            errorMessage += 'Invalid access token. Please check your token.'
            break
          case 'token_revoked':
            errorMessage += 'Access token has been revoked. Please generate a new token.'
            break
          case 'missing_scope':
            errorMessage += 'Missing required permissions. Please add "chat:write" scope to your Slack app and reinstall it to your workspace.'
            break
          default:
            errorMessage += testResult.error || 'Please check your settings.'
        }

        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }
    } catch (testError) {
      console.error('[API] Slack test failed:', testError)
      return NextResponse.json({ error: 'Failed to connect to Slack. Please check your access token.' }, { status: 400 })
    }

    // Upsert the integration
    const { data: integration, error } = await supabaseAdmin
      .from('org_slack_integrations')
      .upsert({
        organization_id: organizationId,
        access_token,
        channel_id,
        channel_name: channel_name || null,
        notify_on_announcement,
        notify_on_meeting,
        notify_on_member_join,
        notify_on_member_leave,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id',
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Error saving org Slack integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ integration, message: 'Slack integration configured successfully' })
  } catch (error) {
    console.error('[API] Error in POST /api/organizations/[id]/slack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove Slack integration
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

    // Verify user is an admin or owner of the organization
    const { data: membership } = await supabaseAdmin
      .from('TODOAAPP.organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
    }

    if (!['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only admins and owners can remove Slack integration' }, { status: 403 })
    }

    // Delete the integration
    const { error } = await supabaseAdmin
      .from('org_slack_integrations')
      .delete()
      .eq('organization_id', organizationId)

    if (error) {
      console.error('[API] Error deleting org Slack integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Slack integration removed' })
  } catch (error) {
    console.error('[API] Error in DELETE /api/organizations/[id]/slack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
