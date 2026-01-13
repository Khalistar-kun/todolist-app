"use client"

import { useCallback, useEffect, useState } from 'react'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import toast from 'react-hot-toast'

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void
  onProcessedTask?: (task: { title: string; description?: string; priority?: string }) => void
  disabled?: boolean
  className?: string
  useAI?: boolean
}

export function VoiceInputButton({
  onTranscript,
  onProcessedTask,
  disabled = false,
  className = '',
  useAI = true,
}: VoiceInputButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleResult = useCallback(async (result: { transcript: string; isFinal: boolean }) => {
    if (!result.isFinal) return

    const text = result.transcript.trim()
    if (!text) return

    // Always pass the raw transcript
    onTranscript(text)

    // If AI processing is enabled and we have the callback, parse the voice command
    if (useAI && onProcessedTask) {
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
                content: `You are a task parser. Extract task information from voice commands.
Return a JSON object with:
- title: the main task title (required)
- description: additional details if mentioned (optional)
- priority: "low", "medium", "high", or "urgent" if mentioned (optional)
- due_date_hint: any time reference like "tomorrow", "next week", "by Friday" (optional)

Examples:
- "Create a task to review the quarterly report by tomorrow" -> {"title": "Review the quarterly report", "due_date_hint": "tomorrow"}
- "Add high priority task fix the login bug" -> {"title": "Fix the login bug", "priority": "high"}
- "New task implement user dashboard with charts and analytics" -> {"title": "Implement user dashboard", "description": "Include charts and analytics"}

Only return valid JSON, nothing else.`
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
            // Try to parse the JSON response
            const jsonMatch = data.response.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0])
              if (parsed.title) {
                onProcessedTask({
                  title: parsed.title,
                  description: parsed.description,
                  priority: parsed.priority,
                })
                toast.success('Voice command processed')
              }
            }
          } catch {
            // If parsing fails, just use the raw transcript as title
            console.log('[VoiceInput] Could not parse AI response, using raw transcript')
          }
        }
      } catch (error) {
        console.error('[VoiceInput] AI processing error:', error)
      } finally {
        setIsProcessing(false)
      }
    }
  }, [onTranscript, onProcessedTask, useAI])

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

  // Don't render if not supported
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
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={`inline-flex items-center justify-center w-10 h-10 rounded-full transition-all
          ${isListening
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/30'
            : isProcessing
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-500 cursor-wait'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        title={isListening ? 'Stop listening' : 'Voice input'}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      >
        {isProcessing ? (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-300 border-t-purple-600" />
        ) : isListening ? (
          // Stop icon
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          // Microphone icon
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* Live transcript indicator */}
      {isListening && transcript && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg whitespace-nowrap max-w-xs truncate z-50">
          {transcript}
        </div>
      )}
    </div>
  )
}
