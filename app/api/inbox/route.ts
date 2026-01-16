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

// GET attention items for current user
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // all, unread, mentions, assignments
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabaseAdmin = getSupabaseAdmin()

    // Build query
    let query = supabaseAdmin
      .from('TODOAAPP.attention_items')
      .select(`
        *,
        task:tasks(id, title, status, priority),
        project:projects(id, name),
        actor:profiles!actor_user_id(id, full_name, avatar_url)
      `)
      .eq('user_id', user.id)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filter
    if (filter === 'unread') {
      query = query.is('read_at', null)
    } else if (filter === 'mentions') {
      query = query.eq('attention_type', 'mention')
    } else if (filter === 'assignments') {
      query = query.in('attention_type', ['assignment', 'unassignment'])
    }

    const { data: items, error } = await query

    if (error) {
      console.error('[API] Error fetching inbox:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get unread count
    const { count: unreadCount } = await supabaseAdmin
      .from('TODOAAPP.attention_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)
      .is('dismissed_at', null)

    return NextResponse.json({
      items: items || [],
      unread_count: unreadCount || 0,
    })
  } catch (error) {
    console.error('[API] Error in GET /api/inbox:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH update attention item (mark read, dismiss)
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, item_id, item_ids } = body

    const supabaseAdmin = getSupabaseAdmin()

    if (action === 'mark_read') {
      if (item_id) {
        // Mark single item as read
        const { error } = await supabaseAdmin
          .from('TODOAAPP.attention_items')
          .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', item_id)
          .eq('user_id', user.id)

        if (error) {
          console.error('[API] Error marking item as read:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      } else if (item_ids && Array.isArray(item_ids)) {
        // Mark multiple items as read
        const { error } = await supabaseAdmin
          .from('TODOAAPP.attention_items')
          .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .in('id', item_ids)
          .eq('user_id', user.id)

        if (error) {
          console.error('[API] Error marking items as read:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }
    } else if (action === 'mark_all_read') {
      const { error } = await supabaseAdmin
        .from('TODOAAPP.attention_items')
        .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null)
        .is('dismissed_at', null)

      if (error) {
        console.error('[API] Error marking all as read:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else if (action === 'dismiss') {
      if (item_id) {
        const { error } = await supabaseAdmin
          .from('TODOAAPP.attention_items')
          .update({ dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', item_id)
          .eq('user_id', user.id)

        if (error) {
          console.error('[API] Error dismissing item:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      } else if (item_ids && Array.isArray(item_ids)) {
        const { error } = await supabaseAdmin
          .from('TODOAAPP.attention_items')
          .update({ dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .in('id', item_ids)
          .eq('user_id', user.id)

        if (error) {
          console.error('[API] Error dismissing items:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error in PATCH /api/inbox:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
