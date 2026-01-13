import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  isGroqAvailable,
  analyzeTask,
  generateProjectInsights,
  suggestTaskCompletion,
  generateProgressSummary,
  chatCompletion,
  type ChatMessage,
} from '@/lib/services/GroqService'

// ============================================================================
// AUTH HELPER
// ============================================================================

async function getAuthenticatedUser(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
  return supabase.auth.getUser()
}

// ============================================================================
// GET - Check AI availability
// ============================================================================

export async function GET() {
  return NextResponse.json({
    available: isGroqAvailable(),
    provider: isGroqAvailable() ? 'groq' : null,
  })
}

// ============================================================================
// POST - AI operations
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies()
    const { data: { user }, error: authError } = await getAuthenticatedUser(cookieStore)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if Groq is available
    if (!isGroqAvailable()) {
      return NextResponse.json(
        { error: 'AI service not configured. Please set GROQ_API_KEY.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'analyze-task': {
        const { title, description, projectContext } = params
        if (!title) {
          return NextResponse.json({ error: 'Task title is required' }, { status: 400 })
        }
        const analysis = await analyzeTask(title, description, projectContext)
        return NextResponse.json(analysis)
      }

      case 'project-insights': {
        const { projectName, tasks, teamSize } = params
        if (!projectName || !tasks) {
          return NextResponse.json({ error: 'Project name and tasks are required' }, { status: 400 })
        }
        const insights = await generateProjectInsights(projectName, tasks, teamSize)
        return NextResponse.json({ insights })
      }

      case 'suggest-completion': {
        const { partialTitle, projectContext } = params
        if (!partialTitle) {
          return NextResponse.json({ error: 'Partial title is required' }, { status: 400 })
        }
        const suggestions = await suggestTaskCompletion(partialTitle, projectContext)
        return NextResponse.json({ suggestions })
      }

      case 'progress-summary': {
        const { projectName, completedTasks, newTasks, blockedTasks } = params
        if (!projectName) {
          return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
        }
        const summary = await generateProgressSummary(
          projectName,
          completedTasks || [],
          newTasks || [],
          blockedTasks || []
        )
        return NextResponse.json({ summary })
      }

      case 'chat': {
        const { messages } = params as { messages: ChatMessage[] }
        if (!messages || !Array.isArray(messages)) {
          return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
        }
        const response = await chatCompletion({ messages })
        return NextResponse.json({ response })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[AI API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
