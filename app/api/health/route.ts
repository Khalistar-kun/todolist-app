import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    )

    const checks: Record<string, any> = {}

    // Test public schema tables
    const tables = ['profiles', 'organizations', 'projects', 'tasks', 'notifications']

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1)

      checks[`public.${table}`] = {
        status: error ? 'error' : 'ok',
        error: error?.message,
        rowCount: data?.length || 0
      }
    }

    // Check if any table failed
    const hasErrors = Object.values(checks).some((check: any) => check.status === 'error')

    if (hasErrors) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Some database tables are not accessible',
          checks,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'ok',
      message: 'All database tables accessible',
      checks,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Unexpected error',
        error: error.message
      },
      { status: 500 }
    )
  }
}

