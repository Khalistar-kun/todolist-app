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

// GET - List user's organizations
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get user's organization memberships
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)

    if (membershipError) {
      console.error('[API] Error fetching memberships:', membershipError)
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ organizations: [] })
    }

    const orgIds = memberships.map(m => m.organization_id)

    // Fetch organizations
    const { data: organizations, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .in('id', orgIds)
      .order('created_at', { ascending: false })

    if (orgsError) {
      console.error('[API] Error fetching organizations:', orgsError)
      return NextResponse.json({ error: orgsError.message }, { status: 500 })
    }

    // Add role to each organization
    const orgsWithRoles = organizations?.map(org => ({
      ...org,
      role: memberships.find(m => m.organization_id === org.id)?.role
    })) || []

    return NextResponse.json({ organizations: orgsWithRoles })
  } catch (error) {
    console.error('[API] Error in GET /api/organizations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new organization
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    if (name.length > 100) {
      return NextResponse.json({ error: 'Organization name must be less than 100 characters' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Generate slug from name
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50)

    // Check if slug exists and generate unique one
    let slug = baseSlug
    let counter = 1
    while (true) {
      const { data: existing } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!existing) break
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Create the organization
    const { data: organization, error: createError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (createError) {
      console.error('[API] Error creating organization:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Add the creator as owner
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: organization.id,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      console.error('[API] Error adding owner to organization:', memberError)
      // Clean up the organization
      await supabaseAdmin
        .from('organizations')
        .delete()
        .eq('id', organization.id)
      return NextResponse.json({ error: 'Failed to set up organization membership' }, { status: 500 })
    }

    console.log(`[API] Created organization ${organization.name} (${organization.id}) by ${user.email}`)

    return NextResponse.json({
      organization: {
        ...organization,
        role: 'owner'
      }
    }, { status: 201 })
  } catch (error) {
    console.error('[API] Error in POST /api/organizations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
