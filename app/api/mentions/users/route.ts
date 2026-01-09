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

// GET users for mention autocomplete
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const projectId = searchParams.get('project_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20)

    const supabaseAdmin = getSupabaseAdmin()

    // If project_id is provided, only search within project members
    if (projectId) {
      // Verify user is a member of the project
      const { data: membership } = await supabaseAdmin
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
      }

      // Get project member user_ids (excluding current user)
      const { data: members, error: membersError } = await supabaseAdmin
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        .neq('user_id', user.id)

      if (membersError) {
        console.error('[API] Error fetching project members:', membersError)
        return NextResponse.json({ error: membersError.message }, { status: 500 })
      }

      const memberUserIds = (members || []).map(m => m.user_id)

      if (memberUserIds.length === 0) {
        return NextResponse.json({ users: [] })
      }

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', memberUserIds)

      if (profilesError) {
        console.error('[API] Error fetching profiles:', profilesError)
        return NextResponse.json({ error: profilesError.message }, { status: 500 })
      }

      // Filter by query and format results
      const users = (profiles || [])
        .filter((profile) => {
          if (!query) return true
          const searchLower = query.toLowerCase()
          return (
            profile.full_name?.toLowerCase().includes(searchLower) ||
            profile.email?.toLowerCase().includes(searchLower)
          )
        })
        .map((profile) => ({
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          mention_handle: generateMentionHandle(profile.full_name, profile.email),
        }))
        .slice(0, limit)

      return NextResponse.json({ users })
    }

    // No project_id - search all users the current user can see
    // (users in same projects)

    // Get all project_ids user is a member of
    const { data: userProjects } = await supabaseAdmin
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)

    const projectIds = (userProjects || []).map((p) => p.project_id)

    if (projectIds.length === 0) {
      return NextResponse.json({ users: [] })
    }

    // Get all user_ids in those projects (excluding current user)
    const { data: fellowMembers, error: membersError } = await supabaseAdmin
      .from('project_members')
      .select('user_id')
      .in('project_id', projectIds)
      .neq('user_id', user.id)

    if (membersError) {
      console.error('[API] Error fetching fellow members:', membersError)
      return NextResponse.json({ error: membersError.message }, { status: 500 })
    }

    // Get unique user_ids
    const uniqueUserIds = [...new Set((fellowMembers || []).map(m => m.user_id))]

    if (uniqueUserIds.length === 0) {
      return NextResponse.json({ users: [] })
    }

    // Fetch profiles for these users
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', uniqueUserIds)

    if (profilesError) {
      console.error('[API] Error fetching profiles:', profilesError)
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }

    // Filter by query and format results
    const users = (profiles || [])
      .filter((profile) => {
        if (!query) return true
        const searchLower = query.toLowerCase()
        return (
          profile.full_name?.toLowerCase().includes(searchLower) ||
          profile.email?.toLowerCase().includes(searchLower)
        )
      })
      .map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        avatar_url: profile.avatar_url,
        mention_handle: generateMentionHandle(profile.full_name, profile.email),
      }))
      .slice(0, limit)

    return NextResponse.json({ users })
  } catch (error) {
    console.error('[API] Error in GET /api/mentions/users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Generate a mention handle from name or email
function generateMentionHandle(fullName: string | null, email: string | null): string {
  if (fullName) {
    // Convert "John Doe" to "john.doe"
    return fullName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9._-]/g, '')
  }

  if (email) {
    // Use part before @
    return email.split('@')[0].toLowerCase()
  }

  return 'user'
}
