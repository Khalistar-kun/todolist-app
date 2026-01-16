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

// GET - List teams for user (optionally filtered by organization)
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')

    const supabaseAdmin = getSupabaseAdmin()

    // Get teams user is a member of
    let query = supabaseAdmin
      .from('TODOAAPP.team_members')
      .select(`
        team_id,
        role,
        joined_at,
        team:teams(
          id,
          name,
          description,
          color,
          image_url,
          organization_id,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)

    const { data: memberships, error: membershipError } = await query

    if (membershipError) {
      console.error('[API] Error fetching team memberships:', membershipError)
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    let teams = memberships?.map(m => ({
      ...(m.team as any),
      user_role: m.role,
      joined_at: m.joined_at,
    })).filter(Boolean) || []

    // Filter by organization if specified
    if (organizationId) {
      teams = teams.filter((t: any) => t.organization_id === organizationId)
    }

    // Get member counts and project counts for each team
    const teamsWithCounts = await Promise.all(
      teams.map(async (team: any) => {
        const [membersResult, projectsResult] = await Promise.all([
          supabaseAdmin
            .from('TODOAAPP.team_members')
            .select('id', { count: 'exact', head: true })
            .eq('team_id', team.id),
          supabaseAdmin
            .from('TODOAAPP.projects')
            .select('id', { count: 'exact', head: true })
            .eq('team_id', team.id),
        ])

        return {
          ...team,
          members_count: membersResult.count || 0,
          projects_count: projectsResult.count || 0,
        }
      })
    )

    return NextResponse.json({ teams: teamsWithCounts })
  } catch (error) {
    console.error('[API] Error in GET /api/teams:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new team
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, color, organization_id, image_url } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    if (!organization_id) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify user is member of the organization
    const { data: orgMembership, error: orgError } = await supabaseAdmin
      .from('TODOAAPP.organization_members')
      .select('role')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .single()

    if (orgError || !orgMembership) {
      return NextResponse.json({ error: 'You are not a member of this organization' }, { status: 403 })
    }

    // Create the team
    const { data: team, error: teamError } = await supabaseAdmin
      .from('TODOAAPP.teams')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#3B82F6',
        image_url: image_url || null,
        organization_id,
        created_by: user.id,
      })
      .select()
      .single()

    if (teamError) {
      console.error('[API] Error creating team:', teamError)
      return NextResponse.json({ error: teamError.message }, { status: 500 })
    }

    // Add creator as team owner
    const { error: memberError } = await supabaseAdmin
      .from('TODOAAPP.team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      console.error('[API] Error adding team member:', memberError)
    }

    console.log(`[API] Team created: ${team.name} by user ${user.id}`)

    return NextResponse.json({ team }, { status: 201 })
  } catch (error) {
    console.error('[API] Error in POST /api/teams:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
