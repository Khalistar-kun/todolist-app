"use client"

import { useCallback, useState } from 'react'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import toast from 'react-hot-toast'

export interface VoiceEditResult {
  title?: string
  description?: string
  priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string // ISO date string
  assignee_names?: string[] // Names mentioned for assignment
}

interface VoiceEditButtonProps {
  onEdit: (result: VoiceEditResult) => void
  currentTitle?: string
  currentDescription?: string
  disabled?: boolean
  className?: string
}

export function VoiceEditButton({
  onEdit,
  currentTitle,
  currentDescription,
  disabled = false,
  className = '',
}: VoiceEditButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleResult = useCallback(async (result: { transcript: string; isFinal: boolean }) => {
    if (!result.isFinal) return

    const text = result.transcript.trim()
    if (!text) return

    setIsProcessing(true)
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          messages: [
            {
              role: 'system',
              content: `You are a task editing assistant. Parse voice commands to update task fields.
Current task context:
- Title: "${currentTitle || 'Unknown'}"
- Description: "${currentDescription || 'None'}"

The user will speak commands to edit the task. Parse their intent and return ONLY a JSON object with the fields they want to change.

Available fields to update:
- title: new task title (string)
- description: new description (string)
- priority: "none", "low", "medium", "high", or "urgent"
- due_date: ISO date string (YYYY-MM-DDTHH:mm)
- assignee_names: array of names mentioned for assignment

For dates, calculate the actual date based on current date/time.
Current date/time: ${new Date().toISOString()}

Examples:
- "Change the date to January 15 2026" -> {"due_date": "2026-01-15T09:00"}
- "Set priority to high" -> {"priority": "high"}
- "Due date tomorrow at 3pm" -> {"due_date": "[tomorrow's date]T15:00"}
- "Set time to 10 hours from now" -> {"due_date": "[calculated datetime]"}
- "Change title to review quarterly report" -> {"title": "Review quarterly report"}
- "Assign to John and Mary" -> {"assignee_names": ["John", "Mary"]}
- "Date will be Jan 15 2026 and time will be 10 hours from now" -> {"due_date": "[Jan 15 2026 + 10 hours from now's time]"}
- "Make it urgent and due next Friday" -> {"priority": "urgent", "due_date": "[next Friday's date]T09:00"}

Only include fields that the user wants to change. Return valid JSON only, no explanations.`
            },
            {
              role: 'user',
              content: text
            }
          ]
        }),
      })

      if (response.ok) {
        const data = await response.json()
        try {
          const jsonMatch = data.response.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as VoiceEditResult

            // Validate and clean the result
            const cleanResult: VoiceEditResult = {}

            if (parsed.title && typeof parsed.title === 'string') {
              cleanResult.title = parsed.title
            }
            if (parsed.description && typeof parsed.description === 'string') {
              cleanResult.description = parsed.description
            }
            if (parsed.priority && ['none', 'low', 'medium', 'high', 'urgent'].includes(parsed.priority)) {
              cleanResult.priority = parsed.priority
            }
            if (parsed.due_date) {
              // Validate it's a valid date
              const date = new Date(parsed.due_date)
              if (!isNaN(date.getTime())) {
                cleanResult.due_date = parsed.due_date
              }
            }
            if (parsed.assignee_names && Array.isArray(parsed.assignee_names)) {
              cleanResult.assignee_names = parsed.assignee_names
            }

            if (Object.keys(cleanResult).length > 0) {
              onEdit(cleanResult)
              toast.success('Task updated via voice')
            } else {
              toast.error('Could not understand the edit command')
            }
          }
        } catch {
          console.log('[VoiceEdit] Could not parse AI response')
          toast.error('Could not parse voice command')
        }
      } else {
        toast.error('Failed to process voice command')
      }
    } catch (error) {
      console.error('[VoiceEdit] AI processing error:', error)
      toast.error('Failed to process voice command')
    } finally {
      setIsProcessing(false)
    }
  }, [currentTitle, currentDescription, onEdit])

  const handleError = useCallback((error: string) => {
    toast.error(error)
  }, [])

  const {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
  } = useVoiceInput({
    onResult: handleResult,
    onError: handleError,
    continuous: false,
  })

  if (!isSupported) {
    return null
  }

  const handleClick = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
          ${isListening
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/30'
            : isProcessing
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 cursor-wait'
              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        title={isListening ? 'Stop listening' : 'Edit with voice'}
        aria-label={isListening ? 'Stop voice input' : 'Edit task with voice'}
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-300 border-t-purple-600" />
            <span>Processing...</span>
          </>
        ) : isListening ? (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span>Listening...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            <span className="hidden sm:inline">Voice Edit</span>
          </>
        )}
      </button>

      {/* Live transcript indicator */}
      {isListening && transcript && (
        <div className="absolute left-0 top-full mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-xl whitespace-nowrap max-w-xs truncate z-50 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {transcript}
          </div>
        </div>
      )}

      {/* Help tooltip on hover when not listening */}
      {!isListening && !isProcessing && (
        <div className="absolute left-0 top-full mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-xl opacity-0 hover:opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 w-64">
          <p className="font-medium mb-1">Voice Edit Examples:</p>
          <ul className="space-y-0.5 text-gray-300">
            <li>&quot;Set date to January 15&quot;</li>
            <li>&quot;Make it high priority&quot;</li>
            <li>&quot;Due tomorrow at 3pm&quot;</li>
            <li>&quot;Change title to...&quot;</li>
          </ul>
        </div>
      )}
    </div>
  )
}
