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
  suggestedDescription?: string
  potentialBlockers?: string[]
  recommendedAssignees?: Array<{ skill: string; reason: string }>
  dependencies?: Array<{ title: string; reason: string }>
  milestones?: string[]
  acceptanceCriteria?: string[]
  risks?: Array<{ risk: string; mitigation: string }>
  relatedTasks?: string[]
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
 * Analyze a task description and suggest priority, time estimate, tags, subtasks, and more
 */
export async function analyzeTask(
  taskTitle: string,
  taskDescription?: string,
  projectContext?: string,
  existingTasks?: Array<{ title: string; tags?: string[] }>,
  teamMembers?: Array<{ name: string; skills?: string[] }>
): Promise<TaskAnalysis> {
  if (!isGroqAvailable()) {
    return {}
  }

  const existingTaskContext = existingTasks?.length
    ? `\n\nExisting tasks in project:\n${existingTasks.slice(0, 10).map(t => `- ${t.title}`).join('\n')}`
    : ''

  const teamContext = teamMembers?.length
    ? `\n\nTeam members: ${teamMembers.map(m => m.name).join(', ')}`
    : ''

  const prompt = `Analyze this task and provide comprehensive suggestions in JSON format:

Task Title: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ''}
${projectContext ? `Project Context: ${projectContext}` : ''}${existingTaskContext}${teamContext}

Respond with a JSON object containing:
- suggestedPriority: "low", "medium", "high", or "urgent" (based on urgency and impact)
- estimatedHours: number (realistic estimate considering complexity)
- suggestedTags: array of 1-3 relevant category tags
- subtasks: array of 3-7 actionable subtask strings (break down complex work)
- summary: one clear sentence summarizing the task goal
- suggestedDescription: 2-3 sentence detailed description if the title is vague
- potentialBlockers: array of 1-3 potential obstacles or dependencies
- recommendedAssignees: array of objects with { skill, reason } suggesting who should work on this
- dependencies: array of { title, reason } for tasks that should be completed first
- acceptanceCriteria: array of 2-4 clear success criteria
- risks: array of { risk, mitigation } for potential problems
- relatedTasks: array of task titles from existing tasks that are related

Be specific and actionable. Only return valid JSON, no markdown or explanation.`

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are an expert project management assistant with deep knowledge of software development, task breakdown, and risk assessment. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      maxTokens: 1500,
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

/**
 * Convert natural language to structured task data
 */
export async function parseNaturalLanguageTask(
  naturalLanguage: string,
  projectContext?: string
): Promise<{
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  tags?: string[]
  assignee?: string
}> {
  if (!isGroqAvailable()) {
    return { title: naturalLanguage }
  }

  const prompt = `Parse this natural language into a structured task:

Input: "${naturalLanguage}"
${projectContext ? `Project: ${projectContext}` : ''}

Extract and return JSON with:
- title: clear task title (required)
- description: expanded description if implicit details exist
- priority: inferred from urgency words (low/medium/high/urgent)
- dueDate: ISO date string if mentioned (e.g., "tomorrow", "next week", "Dec 15")
- tags: relevant category tags
- assignee: person's name if mentioned

Only return valid JSON.`

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a task parser. Extract structured data from natural language. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      maxTokens: 400,
    })

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { title: naturalLanguage }
  } catch (error) {
    console.error('[GroqService] Error parsing natural language:', error)
    return { title: naturalLanguage }
  }
}

/**
 * Smart task breakdown: takes a large task and breaks it into smaller subtasks
 */
export async function breakdownLargeTask(
  taskTitle: string,
  taskDescription?: string,
  desiredSubtaskCount?: number
): Promise<Array<{
  title: string
  description: string
  estimatedHours: number
  order: number
}>> {
  if (!isGroqAvailable()) {
    return []
  }

  const prompt = `Break down this large task into ${desiredSubtaskCount || '5-8'} smaller, actionable subtasks:

Task: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ''}

Return JSON array where each subtask has:
- title: clear, actionable subtask title
- description: 1-2 sentences explaining what to do
- estimatedHours: realistic time estimate
- order: sequence number (1, 2, 3...)

Order subtasks logically (dependencies first). Only return valid JSON array.`

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a task decomposition expert. Break down complex tasks into logical subtasks. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 1200,
    })

    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return []
  } catch (error) {
    console.error('[GroqService] Error breaking down task:', error)
    return []
  }
}

/**
 * Generate acceptance criteria for a task
 */
export async function generateAcceptanceCriteria(
  taskTitle: string,
  taskDescription?: string,
  userStory?: string
): Promise<string[]> {
  if (!isGroqAvailable()) {
    return []
  }

  const prompt = `Generate 3-5 clear acceptance criteria for this task:

Task: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ''}
${userStory ? `User Story: ${userStory}` : ''}

Return a JSON array of acceptance criteria strings. Each should be:
- Testable and measurable
- Written in Given/When/Then format when possible
- Focused on outcomes, not implementation
- Clear and unambiguous

Only return valid JSON array.`

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a QA expert. Write clear, testable acceptance criteria. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 600,
    })

    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return []
  } catch (error) {
    console.error('[GroqService] Error generating acceptance criteria:', error)
    return []
  }
}

/**
 * Estimate task duration based on similar tasks
 */
export async function estimateTaskDuration(
  taskTitle: string,
  taskDescription?: string,
  similarCompletedTasks?: Array<{
    title: string
    estimatedHours: number
    actualHours: number
  }>
): Promise<{
  estimatedHours: number
  confidence: 'low' | 'medium' | 'high'
  reasoning: string
  factors: string[]
}> {
  if (!isGroqAvailable()) {
    return {
      estimatedHours: 4,
      confidence: 'low',
      reasoning: 'AI not available, using default estimate',
      factors: ['Default estimate without AI analysis']
    }
  }

  const similarTasksContext = similarCompletedTasks?.length
    ? `\n\nSimilar completed tasks:\n${similarCompletedTasks.map(t =>
        `- ${t.title}: estimated ${t.estimatedHours}h, actual ${t.actualHours}h`
      ).join('\n')}`
    : ''

  const prompt = `Estimate how long this task will take:

Task: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ''}${similarTasksContext}

Return JSON with:
- estimatedHours: realistic number (can be decimal like 2.5)
- confidence: "low", "medium", or "high"
- reasoning: 1-2 sentences explaining the estimate
- factors: array of 2-4 factors that influenced the estimate

Only return valid JSON.`

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a time estimation expert. Provide realistic estimates based on task complexity. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 400,
    })

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return {
      estimatedHours: 4,
      confidence: 'low',
      reasoning: 'Could not parse AI response',
      factors: ['Fallback estimate']
    }
  } catch (error) {
    console.error('[GroqService] Error estimating duration:', error)
    return {
      estimatedHours: 4,
      confidence: 'low',
      reasoning: 'Error during estimation',
      factors: ['Fallback estimate due to error']
    }
  }
}

/**
 * Suggest optimal task assignment based on team members and workload
 */
export async function suggestTaskAssignment(
  taskTitle: string,
  taskDescription?: string,
  teamMembers?: Array<{
    name: string
    skills?: string[]
    currentWorkload?: number // percentage
    recentTasks?: string[]
  }>
): Promise<Array<{
  memberName: string
  confidence: number // 0-100
  reasoning: string
  pros: string[]
  cons: string[]
}>> {
  if (!isGroqAvailable() || !teamMembers?.length) {
    return []
  }

  const teamContext = teamMembers.map(m =>
    `- ${m.name}: skills [${m.skills?.join(', ') || 'none listed'}], ` +
    `workload ${m.currentWorkload || 0}%, ` +
    `recent tasks: ${m.recentTasks?.slice(0, 3).join(', ') || 'none'}`
  ).join('\n')

  const prompt = `Recommend who should work on this task:

Task: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ''}

Team:
${teamContext}

Return JSON array (top 2-3 candidates) with:
- memberName: person's name
- confidence: 0-100 score
- reasoning: 1-2 sentences
- pros: array of 1-3 reasons to assign to them
- cons: array of 0-2 potential concerns

Sort by confidence descending. Only return valid JSON array.`

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a team workload optimizer. Consider skills, experience, and current capacity. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      maxTokens: 800,
    })

    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return []
  } catch (error) {
    console.error('[GroqService] Error suggesting assignment:', error)
    return []
  }
}

/**
 * Improve task title and description for clarity
 */
export async function improveTaskClarity(
  taskTitle: string,
  taskDescription?: string
): Promise<{
  improvedTitle: string
  improvedDescription: string
  changes: string[]
}> {
  if (!isGroqAvailable()) {
    return {
      improvedTitle: taskTitle,
      improvedDescription: taskDescription || '',
      changes: []
    }
  }

  const prompt = `Improve this task for clarity:

Current Title: ${taskTitle}
${taskDescription ? `Current Description: ${taskDescription}` : 'No description provided'}

Return JSON with:
- improvedTitle: clearer, more specific title (keep it concise)
- improvedDescription: better description with context and details
- changes: array of 2-4 improvements made

Make it actionable and unambiguous. Only return valid JSON.`

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a technical writer. Make tasks clear and actionable. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 500,
    })

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return {
      improvedTitle: taskTitle,
      improvedDescription: taskDescription || '',
      changes: []
    }
  } catch (error) {
    console.error('[GroqService] Error improving clarity:', error)
    return {
      improvedTitle: taskTitle,
      improvedDescription: taskDescription || '',
      changes: []
    }
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
