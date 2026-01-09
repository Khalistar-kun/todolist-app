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

      // Get project members matching the query
      let membersQuery = supabaseAdmin
        .from('project_members')
        .select(`
          user_id,
          profile:profiles!user_id(
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .neq('user_id', user.id) // Exclude current user
        .limit(limit)

      const { data: members, error } = await membersQuery

      if (error) {
        console.error('[API] Error fetching project members:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Filter and format results
      const users = (members || [])
        .filter((m) => {
          if (!m.profile) return false
          const profile = m.profile as any
          if (!query) return true
          const searchLower = query.toLowerCase()
          return (
            profile.full_name?.toLowerCase().includes(searchLower) ||
            profile.email?.toLowerCase().includes(searchLower)
          )
        })
        .map((m) => {
          const profile = m.profile as any
          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            avatar_url: profile.avatar_url,
            // Generate mention handle from name or email
            mention_handle: generateMentionHandle(profile.full_name, profile.email),
          }
        })
        .slice(0, limit)

      return NextResponse.json({ users })
    }

    // No project_id - search all users the current user can see
    // (users in same projects or organizations)

    // Get all project_ids user is a member of
    const { data: userProjects } = await supabaseAdmin
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)

    const projectIds = (userProjects || []).map((p) => p.project_id)

    if (projectIds.length === 0) {
      return NextResponse.json({ users: [] })
    }

    // Get all users in those projects
    const { data: fellowMembers, error } = await supabaseAdmin
      .from('project_members')
      .select(`
        user_id,
        profile:profiles!user_id(
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .in('project_id', projectIds)
      .neq('user_id', user.id)

    if (error) {
      console.error('[API] Error fetching fellow members:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Deduplicate and filter
    const userMap = new Map<string, {
      id: string
      full_name: string | null
      email: string | null
      avatar_url: string | null
      mention_handle: string
    }>()

    for (const m of fellowMembers || []) {
      if (!m.profile) continue
      const profile = m.profile as any
      if (userMap.has(profile.id)) continue

      if (query) {
        const searchLower = query.toLowerCase()
        const matches =
          profile.full_name?.toLowerCase().includes(searchLower) ||
          profile.email?.toLowerCase().includes(searchLower)
        if (!matches) continue
      }

      userMap.set(profile.id, {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        avatar_url: profile.avatar_url,
        mention_handle: generateMentionHandle(profile.full_name, profile.email),
      })
    }

    const users = Array.from(userMap.values()).slice(0, limit)

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
