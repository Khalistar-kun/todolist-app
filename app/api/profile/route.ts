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

// GET profile
export async function GET() {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[API] Error fetching profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return profile or default values
    return NextResponse.json({
      profile: profile || {
        id: user.id,
        email: user.email,
        full_name: null,
        avatar_url: null,
        bio: null,
      }
    })
  } catch (error) {
    console.error('[API] Error in GET /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH update profile
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { full_name, avatar_url, bio, profile_completed } = body

    const supabaseAdmin = getSupabaseAdmin()

    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    let profile
    let error

    if (existingProfile) {
      // Update existing profile
      const updateData: Record<string, any> = {
        full_name: full_name ?? null,
        avatar_url: avatar_url ?? null,
        bio: bio ?? null,
        updated_at: new Date().toISOString(),
      }

      // Only update profile_completed if explicitly set to true
      if (profile_completed === true) {
        updateData.profile_completed = true
      }

      const result = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single()

      profile = result.data
      error = result.error
    } else {
      // Insert new profile
      const result = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: full_name ?? null,
          avatar_url: avatar_url ?? null,
          bio: bio ?? null,
          profile_completed: profile_completed ?? false,
        })
        .select()
        .single()

      profile = result.data
      error = result.error
    }

    if (error) {
      console.error('[API] Error updating profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('[API] Error in PATCH /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
