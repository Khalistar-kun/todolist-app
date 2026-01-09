import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/app'

  // If there is no code, redirect to the home page with an error
  if (!code) {
    console.error('[Auth Callback] Missing code parameter')
    return NextResponse.redirect(`${origin}/auth/signin?error=missing_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[Auth Callback] Exchange code error:', error)
      return NextResponse.redirect(`${origin}/auth/signin?error=${encodeURIComponent(error.message)}`)
    }

    // Check if this is a new user (from OAuth) and create profile if needed
    if (data.user) {
      const supabaseAdmin = getSupabaseAdmin()

      // Check if profile exists
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single()

      if (!existingProfile) {
        console.log('[Auth Callback] Creating profile for new OAuth user:', data.user.email)

        // Extract name from user metadata
        const fullName = data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split('@')[0] ||
          'User'

        const avatarUrl = data.user.user_metadata?.avatar_url ||
          data.user.user_metadata?.picture ||
          null

        // Create profile with profile_completed = false for new users
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email!,
            full_name: fullName,
            avatar_url: avatarUrl,
            profile_completed: false,
          })

        if (profileError) {
          console.error('[Auth Callback] Error creating profile:', profileError)
          // Don't fail the auth, just log the error
        } else {
          // Create default organization for new user
          const { data: orgData, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({
              name: `${fullName}'s Workspace`,
              slug: `${fullName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`,
              created_by: data.user.id,
            })
            .select()
            .single()

          if (orgError) {
            console.error('[Auth Callback] Error creating organization:', orgError)
          } else if (orgData) {
            // Add user as owner of the organization
            const { error: memberError } = await supabaseAdmin
              .from('organization_members')
              .insert({
                organization_id: orgData.id,
                user_id: data.user.id,
                role: 'owner',
              })

            if (memberError) {
              console.error('[Auth Callback] Error adding user to organization:', memberError)
            }
          }
        }

        // Redirect new users to profile setup page
        return NextResponse.redirect(`${origin}/auth/setup-profile`)
      }
    }

    // Redirect to the app after successful authentication
    return NextResponse.redirect(`${origin}${next}`)
  } catch (error) {
    console.error('[Auth Callback] Unexpected error:', error)
    return NextResponse.redirect(`${origin}/auth/signin?error=unknown_error`)
  }
}
