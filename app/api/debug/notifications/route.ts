import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
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

// GET - Debug notifications system
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const diagnostics: Record<string, any> = {
      user_id: user.id,
      checks: {},
    }

    // Check 1: Can we read from notifications table?
    console.log('[Debug] Checking notifications table read access...')
    const { data: notifications, error: readError } = await supabaseAdmin
      .from('TODOAAPP.notifications')
      .select('*')
      .eq('user_id', user.id)
      .limit(5)

    diagnostics.checks.read_notifications = {
      success: !readError,
      error: readError?.message,
      count: notifications?.length || 0,
      sample: notifications?.slice(0, 2),
    }

    // Check 2: Can we check the table schema?
    console.log('[Debug] Checking notifications table schema...')
    const { data: columns, error: schemaError } = await supabaseAdmin
      .rpc('get_table_columns', { table_name: 'notifications' })
      .single()

    // Alternative: Try to get column info
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('TODOAAPP.notifications')
      .select('*')
      .limit(0)

    diagnostics.checks.table_exists = {
      success: !tableError,
      error: tableError?.message,
    }

    // Check 3: Try to insert a test notification
    console.log('[Debug] Attempting to insert test notification...')
    const testNotification = {
      user_id: user.id,
      type: 'task_moved',  // This is the problematic type
      title: 'Test Notification',
      message: 'This is a test notification to check if the system works',
      data: { test: true },
    }

    const { data: insertedNotif, error: insertError } = await supabaseAdmin
      .from('TODOAAPP.notifications')
      .insert(testNotification)
      .select()
      .single()

    diagnostics.checks.insert_notification = {
      success: !insertError,
      error: insertError?.message,
      error_code: insertError?.code,
      error_details: insertError?.details,
      error_hint: insertError?.hint,
      inserted_id: insertedNotif?.id,
    }

    // If insert succeeded, delete the test notification
    if (insertedNotif?.id) {
      await supabaseAdmin
        .from('TODOAAPP.notifications')
        .delete()
        .eq('id', insertedNotif.id)
      diagnostics.checks.insert_notification.cleaned_up = true
    }

    // Check 4: Try with a valid enum type
    console.log('[Debug] Attempting to insert with valid enum type...')
    const validNotification = {
      user_id: user.id,
      type: 'task_updated',  // This should be a valid enum
      title: 'Test Valid Notification',
      message: 'This is a test with valid enum type',
      data: { test: true },
    }

    const { data: validInserted, error: validError } = await supabaseAdmin
      .from('TODOAAPP.notifications')
      .insert(validNotification)
      .select()
      .single()

    diagnostics.checks.insert_with_valid_enum = {
      success: !validError,
      error: validError?.message,
      error_code: validError?.code,
      inserted_id: validInserted?.id,
    }

    // Clean up valid test notification
    if (validInserted?.id) {
      await supabaseAdmin
        .from('TODOAAPP.notifications')
        .delete()
        .eq('id', validInserted.id)
      diagnostics.checks.insert_with_valid_enum.cleaned_up = true
    }

    // Check 5: Check realtime publication
    console.log('[Debug] Checking realtime publication...')
    const { data: realtimeCheck, error: realtimeError } = await supabaseAdmin
      .rpc('check_realtime_enabled', { table_name: 'notifications' })

    diagnostics.checks.realtime_enabled = {
      success: !realtimeError,
      result: realtimeCheck,
      error: realtimeError?.message,
    }

    // Check 6: Get project owner info for debugging
    const { data: projectMemberships } = await supabaseAdmin
      .from('TODOAAPP.project_members')
      .select('project_id, role, user_id')
      .eq('user_id', user.id)

    diagnostics.checks.user_project_memberships = {
      count: projectMemberships?.length || 0,
      roles: projectMemberships?.map(m => ({ project_id: m.project_id, role: m.role })),
    }

    // Summary
    diagnostics.summary = {
      can_read: diagnostics.checks.read_notifications.success,
      can_insert_task_moved: diagnostics.checks.insert_notification.success,
      can_insert_valid_enum: diagnostics.checks.insert_with_valid_enum.success,
      issue_detected: !diagnostics.checks.insert_notification.success
        ? 'Cannot insert task_moved type - enum constraint likely blocking'
        : diagnostics.checks.insert_with_valid_enum.success && !diagnostics.checks.insert_notification.success
          ? 'Valid enum works but task_moved does not - need to run migration 009'
          : 'System appears to be working',
    }

    return NextResponse.json(diagnostics)
  } catch (error: any) {
    console.error('[Debug] Error:', error)
    return NextResponse.json({
      error: 'Diagnostic failed',
      message: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
