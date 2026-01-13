"use client"

import { useState, useCallback } from 'react'
import { useAI, type TaskAnalysis } from '@/hooks/useAI'
import toast from 'react-hot-toast'

interface AIAssistButtonProps {
  taskTitle: string
  taskDescription?: string
  projectName?: string
  onApplySuggestions?: (suggestions: TaskAnalysis) => void
  disabled?: boolean
  className?: string
}

export function AIAssistButton({
  taskTitle,
  taskDescription,
  projectName,
  onApplySuggestions,
  disabled = false,
  className = '',
}: AIAssistButtonProps) {
  const { isAvailable, analyzeTask, loading } = useAI()
  const [showPanel, setShowPanel] = useState(false)
  const [suggestions, setSuggestions] = useState<TaskAnalysis | null>(null)

  const handleAnalyze = useCallback(async () => {
    if (!taskTitle.trim()) {
      toast.error('Enter a task title first')
      return
    }

    const result = await analyzeTask(taskTitle, taskDescription, projectName)
    if (result) {
      setSuggestions(result)
      setShowPanel(true)
    } else {
      toast.error('Failed to analyze task')
    }
  }, [taskTitle, taskDescription, projectName, analyzeTask])

  const handleApply = useCallback(() => {
    if (suggestions && onApplySuggestions) {
      onApplySuggestions(suggestions)
      setShowPanel(false)
      toast.success('AI suggestions applied')
    }
  }, [suggestions, onApplySuggestions])

  // Don't render if AI is not available
  if (isAvailable === false) {
    return null
  }

  // Still checking availability
  if (isAvailable === null) {
    return null
  }

  return (
    <div className="relative">
      {/* AI Button */}
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={disabled || loading || !taskTitle.trim()}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all
          ${loading
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-400 cursor-wait'
            : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-sm hover:shadow-md'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        title="Get AI suggestions for this task"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-300 border-t-white" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
            <span>AI Assist</span>
          </>
        )}
      </button>

      {/* Suggestions Panel */}
      {showPanel && suggestions && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span className="font-semibold text-white">AI Suggestions</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPanel(false)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Priority */}
            {suggestions.suggestedPriority && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Priority</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  suggestions.suggestedPriority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  suggestions.suggestedPriority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                  suggestions.suggestedPriority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {suggestions.suggestedPriority.charAt(0).toUpperCase() + suggestions.suggestedPriority.slice(1)}
                </span>
              </div>
            )}

            {/* Time Estimate */}
            {suggestions.estimatedHours && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Time Estimate</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  ~{suggestions.estimatedHours}h
                </span>
              </div>
            )}

            {/* Tags */}
            {suggestions.suggestedTags && suggestions.suggestedTags.length > 0 && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Suggested Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.suggestedTags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Subtasks */}
            {suggestions.subtasks && suggestions.subtasks.length > 0 && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Suggested Subtasks</span>
                <ul className="space-y-1.5">
                  {suggestions.subtasks.map((subtask, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {subtask}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary */}
            {suggestions.summary && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                  "{suggestions.summary}"
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex gap-2">
            <button
              type="button"
              onClick={() => setShowPanel(false)}
              className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-lg transition-colors"
            >
              Apply All
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
