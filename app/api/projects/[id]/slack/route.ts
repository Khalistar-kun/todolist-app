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

// GET - Fetch Slack integration for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify user is a member of the project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    // Get Slack integration
    const { data: integration, error } = await supabaseAdmin
      .from('slack_integrations')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[API] Error fetching Slack integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ integration: integration || null })
  } catch (error) {
    console.error('[API] Error in GET /api/projects/[id]/slack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update Slack integration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      webhook_url,
      channel_name,
      notify_on_task_create = true,
      notify_on_task_update = true,
      notify_on_task_delete = true,
      notify_on_task_move = true,
      notify_on_task_complete = true,
    } = body

    if (!webhook_url) {
      return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 })
    }

    // Validate webhook URL format
    if (!webhook_url.startsWith('https://hooks.slack.com/')) {
      return NextResponse.json({ error: 'Invalid Slack webhook URL' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify user is an admin or owner of the project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    if (!['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only admins and owners can configure Slack integration' }, { status: 403 })
    }

    // Test the webhook before saving
    try {
      const testResponse = await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'TodoList app connected successfully! You will now receive task notifications in this channel.',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: 'TodoList Connected',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Your TodoList project is now connected to Slack. You will receive notifications for task updates in this channel.',
              },
            },
          ],
        }),
      })

      if (!testResponse.ok) {
        return NextResponse.json({ error: 'Failed to verify webhook. Please check the URL.' }, { status: 400 })
      }
    } catch (testError) {
      console.error('[API] Webhook test failed:', testError)
      return NextResponse.json({ error: 'Failed to connect to Slack. Please check the webhook URL.' }, { status: 400 })
    }

    // Upsert the integration
    const { data: integration, error } = await supabaseAdmin
      .from('slack_integrations')
      .upsert({
        project_id: projectId,
        webhook_url,
        channel_name: channel_name || null,
        notify_on_task_create,
        notify_on_task_update,
        notify_on_task_delete,
        notify_on_task_move,
        notify_on_task_complete,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id',
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Error saving Slack integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ integration, message: 'Slack integration configured successfully' })
  } catch (error) {
    console.error('[API] Error in POST /api/projects/[id]/slack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove Slack integration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify user is an admin or owner of the project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    if (!['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only admins and owners can remove Slack integration' }, { status: 403 })
    }

    // Delete the integration
    const { error } = await supabaseAdmin
      .from('slack_integrations')
      .delete()
      .eq('project_id', projectId)

    if (error) {
      console.error('[API] Error deleting Slack integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Slack integration removed' })
  } catch (error) {
    console.error('[API] Error in DELETE /api/projects/[id]/slack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
