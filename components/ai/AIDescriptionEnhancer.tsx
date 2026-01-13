"use client"

import { useState, useCallback } from 'react'
import { useAI } from '@/hooks/useAI'
import toast from 'react-hot-toast'

interface AIDescriptionEnhancerProps {
  taskTitle: string
  currentDescription: string
  onEnhance: (enhancedDescription: string) => void
  disabled?: boolean
}

export function AIDescriptionEnhancer({
  taskTitle,
  currentDescription,
  onEnhance,
  disabled = false,
}: AIDescriptionEnhancerProps) {
  const { isAvailable, chat, loading } = useAI()
  const [showOptions, setShowOptions] = useState(false)

  const enhanceDescription = useCallback(async (mode: 'expand' | 'clarify' | 'format' | 'generate') => {
    if (!taskTitle.trim()) {
      toast.error('Enter a task title first')
      return
    }

    let prompt = ''
    switch (mode) {
      case 'generate':
        prompt = `Generate a clear, professional task description for a task titled "${taskTitle}".
The description should:
- Be 2-3 sentences
- Explain what needs to be done
- Include any relevant technical details
- Be actionable and specific

Only return the description text, no prefixes or explanations.`
        break
      case 'expand':
        prompt = `Expand and improve this task description to be more detailed and actionable:

Task: ${taskTitle}
Current description: ${currentDescription || '(none)'}

Make it 2-4 sentences with clear next steps. Only return the improved description, no prefixes.`
        break
      case 'clarify':
        prompt = `Rewrite this task description to be clearer and more concise:

Task: ${taskTitle}
Current description: ${currentDescription}

Keep it professional and actionable. Only return the clarified description, no prefixes.`
        break
      case 'format':
        prompt = `Format this task description with proper structure (bullet points if appropriate):

Task: ${taskTitle}
Current description: ${currentDescription}

Use markdown formatting if it improves readability. Only return the formatted description, no prefixes.`
        break
    }

    const response = await chat([
      { role: 'system', content: 'You are a professional task management assistant. Be concise and actionable.' },
      { role: 'user', content: prompt }
    ])

    if (response) {
      onEnhance(response.trim())
      setShowOptions(false)
      toast.success('Description enhanced')
    } else {
      toast.error('Failed to enhance description')
    }
  }, [taskTitle, currentDescription, chat, onEnhance])

  if (isAvailable === false) {
    return null
  }

  if (isAvailable === null) {
    return null
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowOptions(!showOptions)}
        disabled={disabled || loading}
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-all
          ${loading
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-400 cursor-wait'
            : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title="AI Description Helper"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-3 w-3 border border-purple-300 border-t-purple-600" />
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        )}
        <span>AI</span>
        <svg className={`w-3 h-3 transition-transform ${showOptions ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {showOptions && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 animate-scale-in">
          {!currentDescription ? (
            <button
              type="button"
              onClick={() => enhanceDescription('generate')}
              disabled={loading}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Generate Description
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => enhanceDescription('expand')}
                disabled={loading}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                Expand & Improve
              </button>
              <button
                type="button"
                onClick={() => enhanceDescription('clarify')}
                disabled={loading}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
                Clarify & Simplify
              </button>
              <button
                type="button"
                onClick={() => enhanceDescription('format')}
                disabled={loading}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                Format with Bullets
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
