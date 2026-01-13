"use client"

import { useState, useCallback, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// ============================================================================
// AI API CLIENT
// ============================================================================

async function aiRequest<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'AI request failed')
  }

  return response.json()
}

// ============================================================================
// HOOK: useAI
// ============================================================================

export function useAI() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check AI availability on mount
  useEffect(() => {
    async function checkAvailability() {
      try {
        const response = await fetch('/api/ai')
        const data = await response.json()
        setIsAvailable(data.available)
      } catch {
        setIsAvailable(false)
      }
    }
    checkAvailability()
  }, [])

  // Analyze a task
  const analyzeTask = useCallback(async (
    title: string,
    description?: string,
    projectContext?: string
  ): Promise<TaskAnalysis | null> => {
    setLoading(true)
    setError(null)
    try {
      const result = await aiRequest<TaskAnalysis>('analyze-task', {
        title,
        description,
        projectContext,
      })
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze task')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Get project insights
  const getProjectInsights = useCallback(async (
    projectName: string,
    tasks: Array<{ title: string; status: string; priority: string; due_date?: string | null }>,
    teamSize?: number
  ): Promise<ProjectInsight[]> => {
    setLoading(true)
    setError(null)
    try {
      const result = await aiRequest<{ insights: ProjectInsight[] }>('project-insights', {
        projectName,
        tasks,
        teamSize,
      })
      return result.insights
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get insights')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Suggest task title completions
  const suggestCompletion = useCallback(async (
    partialTitle: string,
    projectContext?: string
  ): Promise<string[]> => {
    if (partialTitle.length < 3) return []

    try {
      const result = await aiRequest<{ suggestions: string[] }>('suggest-completion', {
        partialTitle,
        projectContext,
      })
      return result.suggestions
    } catch {
      return []
    }
  }, [])

  // Generate progress summary
  const generateSummary = useCallback(async (
    projectName: string,
    completedTasks: string[],
    newTasks: string[],
    blockedTasks: string[]
  ): Promise<string> => {
    setLoading(true)
    setError(null)
    try {
      const result = await aiRequest<{ summary: string }>('progress-summary', {
        projectName,
        completedTasks,
        newTasks,
        blockedTasks,
      })
      return result.summary
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary')
      return ''
    } finally {
      setLoading(false)
    }
  }, [])

  // Generic chat
  const chat = useCallback(async (messages: ChatMessage[]): Promise<string> => {
    setLoading(true)
    setError(null)
    try {
      const result = await aiRequest<{ response: string }>('chat', { messages })
      return result.response
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat request failed')
      return ''
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    isAvailable,
    loading,
    error,
    analyzeTask,
    getProjectInsights,
    suggestCompletion,
    generateSummary,
    chat,
  }
}
