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
        },
        db: {
          schema: 'TODOAAPP'
        }
      }
    )

    const checks: Record<string, any> = {}

    // Test TODOAAPP schema tables
    const tables = ['profiles', 'organizations', 'projects', 'tasks', 'notifications']

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1)

      checks[`TODOAAPP.${table}`] = {
        status: error ? 'error' : 'ok',
        error: error?.message,
        rowCount: data?.length || 0
      }
    }

    // Check if any table failed
    const hasErrors = Object.values(checks).some((check: any) => check.status === 'error')

    // Check if error is schema-related
    const schemaNotExposed = Object.values(checks).some(
      (check: any) => check.error && (
        check.error.includes('schema') ||
        check.error.includes('public, graphql_public')
      )
    )

    if (hasErrors && schemaNotExposed) {
      return NextResponse.json({
        status: 'warning',
        message: 'TODOAAPP schema needs to be exposed in Supabase',
        instructions: [
          '1. Go to Supabase Dashboard → Settings → API',
          '2. Scroll to "Exposed schemas"',
          '3. Add "TODOAAPP" to the list',
          '4. Click Save',
          '5. See EXPOSE-TODOAAPP-SCHEMA.md for details'
        ],
        checks,
        timestamp: new Date().toISOString()
      })
    }

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
      message: 'All TODOAAPP schema tables accessible',
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

