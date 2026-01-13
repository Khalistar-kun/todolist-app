import Groq from 'groq-sdk'

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionOptions {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface TaskAnalysis {
  suggestedPriority?: 'low' | 'medium' | 'high' | 'urgent'
  estimatedHours?: number
  suggestedTags?: string[]
  subtasks?: string[]
  summary?: string
}

export interface ProjectInsight {
  title: string
  description: string
  type: 'optimization' | 'risk' | 'opportunity' | 'reminder'
  severity: 'info' | 'warning' | 'critical'
  actionable?: boolean
}

// ============================================================================
// GROQ CLIENT SINGLETON
// ============================================================================

let groqClient: Groq | null = null

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set')
    }
    groqClient = new Groq({ apiKey })
  }
  return groqClient
}

// ============================================================================
// CHECK IF GROQ IS AVAILABLE
// ============================================================================

export function isGroqAvailable(): boolean {
  return !!process.env.GROQ_API_KEY
}

// ============================================================================
// CORE CHAT COMPLETION
// ============================================================================

export async function chatCompletion(options: ChatCompletionOptions): Promise<string> {
  const groq = getGroqClient()

  const response = await groq.chat.completions.create({
    model: options.model || 'llama-3.3-70b-versatile',
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
  })

  return response.choices[0]?.message?.content || ''
}

// ============================================================================
// STREAMING CHAT COMPLETION
// ============================================================================

export async function* streamChatCompletion(options: ChatCompletionOptions): AsyncGenerator<string> {
  const groq = getGroqClient()

  const stream = await groq.chat.completions.create({
    model: options.model || 'llama-3.3-70b-versatile',
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
    stream: true,
  })

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content
    if (content) {
      yield content
    }
  }
}

// ============================================================================
// TASK-SPECIFIC AI FUNCTIONS
// ============================================================================

/**
 * Analyze a task description and suggest priority, time estimate, tags, and subtasks
 */
export async function analyzeTask(
  taskTitle: string,
  taskDescription?: string,
  projectContext?: string
): Promise<TaskAnalysis> {
  if (!isGroqAvailable()) {
    return {}
  }

  const prompt = `Analyze this task and provide suggestions in JSON format:

Task Title: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ''}
${projectContext ? `Project Context: ${projectContext}` : ''}

Respond with a JSON object containing:
- suggestedPriority: "low", "medium", "high", or "urgent"
- estimatedHours: number (realistic estimate)
- suggestedTags: array of 1-3 relevant tags
- subtasks: array of 2-5 subtask strings (if task is complex)
- summary: one sentence summary of the task

Only return valid JSON, no markdown or explanation.`

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a project management assistant. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 500,
    })

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as TaskAnalysis
    }
    return {}
  } catch (error) {
    console.error('[GroqService] Error analyzing task:', error)
    return {}
  }
}

/**
 * Generate AI-powered project insights
 */
export async function generateProjectInsights(
  projectName: string,
  tasks: Array<{ title: string; status: string; priority: string; due_date?: string | null }>,
  teamSize?: number
): Promise<ProjectInsight[]> {
  if (!isGroqAvailable()) {
    return []
  }

  const taskSummary = tasks.slice(0, 20).map(t =>
    `- ${t.title} (${t.status}, ${t.priority}${t.due_date ? `, due: ${t.due_date}` : ''})`
  ).join('\n')

  const prompt = `Analyze this project and provide actionable insights:

Project: ${projectName}
Team Size: ${teamSize || 'Unknown'}
Tasks (sample):
${taskSummary}

Total Tasks: ${tasks.length}
By Status: ${JSON.stringify(tasks.reduce((acc, t) => {
  acc[t.status] = (acc[t.status] || 0) + 1
  return acc
}, {} as Record<string, number>))}

Provide 2-4 insights in JSON array format. Each insight should have:
- title: short title
- description: 1-2 sentences
- type: "optimization", "risk", "opportunity", or "reminder"
- severity: "info", "warning", or "critical"
- actionable: boolean

Only return valid JSON array, no markdown or explanation.`

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a project management consultant. Provide practical, actionable insights. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      maxTokens: 800,
    })

    // Parse JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ProjectInsight[]
    }
    return []
  } catch (error) {
    console.error('[GroqService] Error generating insights:', error)
    return []
  }
}

/**
 * Smart task title/description suggestions based on partial input
 */
export async function suggestTaskCompletion(
  partialTitle: string,
  projectContext?: string
): Promise<string[]> {
  if (!isGroqAvailable() || partialTitle.length < 3) {
    return []
  }

  const prompt = `Complete this task title with 3 suggestions:

Partial title: "${partialTitle}"
${projectContext ? `Project: ${projectContext}` : ''}

Return a JSON array of 3 complete task title strings. Only return the JSON array.`

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a task management assistant. Respond with JSON array only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      maxTokens: 200,
    })

    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as string[]
    }
    return []
  } catch (error) {
    console.error('[GroqService] Error suggesting completion:', error)
    return []
  }
}

/**
 * Generate a daily/weekly summary of project progress
 */
export async function generateProgressSummary(
  projectName: string,
  completedTasks: string[],
  newTasks: string[],
  blockedTasks: string[]
): Promise<string> {
  if (!isGroqAvailable()) {
    return ''
  }

  const prompt = `Generate a brief project progress summary:

Project: ${projectName}

Completed recently:
${completedTasks.slice(0, 10).map(t => `- ${t}`).join('\n') || '- None'}

New tasks added:
${newTasks.slice(0, 10).map(t => `- ${t}`).join('\n') || '- None'}

Currently blocked:
${blockedTasks.slice(0, 5).map(t => `- ${t}`).join('\n') || '- None'}

Write a 2-3 sentence professional summary suitable for a standup or status update.`

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a project manager writing concise status updates.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      maxTokens: 200,
    })

    return response.trim()
  } catch (error) {
    console.error('[GroqService] Error generating summary:', error)
    return ''
  }
}

// ============================================================================
// AVAILABLE MODELS
// ============================================================================

export const GROQ_MODELS = {
  // Latest and most capable
  'llama-3.3-70b-versatile': { name: 'Llama 3.3 70B', contextWindow: 128000, speed: 'medium' },
  'llama-3.1-70b-versatile': { name: 'Llama 3.1 70B', contextWindow: 128000, speed: 'medium' },
  'llama-3.1-8b-instant': { name: 'Llama 3.1 8B', contextWindow: 128000, speed: 'fast' },

  // Mixtral
  'mixtral-8x7b-32768': { name: 'Mixtral 8x7B', contextWindow: 32768, speed: 'fast' },

  // Gemma
  'gemma2-9b-it': { name: 'Gemma 2 9B', contextWindow: 8192, speed: 'fast' },
} as const

export type GroqModelId = keyof typeof GROQ_MODELS
