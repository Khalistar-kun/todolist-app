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

async function getAuthenticatedUser(cookieStore: Awaited<ReturnType<typeof cookies>>) {
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

// GET user preferences
export async function GET() {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: preferences, error } = await supabaseAdmin
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[API] Error fetching preferences:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return preferences or defaults
    return NextResponse.json({
      preferences: preferences || {
        user_id: user.id,
        theme: 'system',
        email_notifications: true,
        push_notifications: true,
        weekly_digest: true,
        task_reminders: true,
        language: 'en',
        timezone: 'UTC',
      }
    })
  } catch (error) {
    console.error('[API] Error in GET /api/settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH update user preferences
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      theme,
      email_notifications,
      push_notifications,
      weekly_digest,
      task_reminders,
      language,
      timezone,
    } = body

    const supabaseAdmin = getSupabaseAdmin()

    // Check if preferences exist
    const { data: existingPrefs } = await supabaseAdmin
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let preferences
    let error

    if (existingPrefs) {
      // Update existing preferences
      const result = await supabaseAdmin
        .from('user_preferences')
        .update({
          theme: theme ?? undefined,
          email_notifications: email_notifications ?? undefined,
          push_notifications: push_notifications ?? undefined,
          weekly_digest: weekly_digest ?? undefined,
          task_reminders: task_reminders ?? undefined,
          language: language ?? undefined,
          timezone: timezone ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single()

      preferences = result.data
      error = result.error
    } else {
      // Insert new preferences
      const result = await supabaseAdmin
        .from('user_preferences')
        .insert({
          user_id: user.id,
          theme: theme ?? 'system',
          email_notifications: email_notifications ?? true,
          push_notifications: push_notifications ?? true,
          weekly_digest: weekly_digest ?? true,
          task_reminders: task_reminders ?? true,
          language: language ?? 'en',
          timezone: timezone ?? 'UTC',
        })
        .select()
        .single()

      preferences = result.data
      error = result.error
    }

    if (error) {
      console.error('[API] Error updating preferences:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('[API] Error in PATCH /api/settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
