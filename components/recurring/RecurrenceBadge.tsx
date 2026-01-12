"use client"

import { useState, useEffect } from 'react'
import { RecurringTaskService, TaskRecurrence } from '@/lib/services/RecurringTaskService'

interface RecurrenceBadgeProps {
  taskId: string
  onClick?: () => void
}

/**
 * Shows a badge indicating if a task has a recurrence pattern
 */
export function RecurrenceBadge({ taskId, onClick }: RecurrenceBadgeProps) {
  const [recurrence, setRecurrence] = useState<TaskRecurrence | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRecurrence() {
      try {
        const data = await RecurringTaskService.getTaskRecurrence(taskId)
        setRecurrence(data)
      } catch (error) {
        console.error('Error fetching recurrence:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecurrence()
  }, [taskId])

  if (loading || !recurrence) return null

  const label = RecurringTaskService.formatRecurrence(recurrence)

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
        recurrence.is_active
          ? 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50'
          : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      title={recurrence.is_active ? `Repeats: ${label}` : `Recurrence paused: ${label}`}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
      </svg>
      <span>{label}</span>
      {!recurrence.is_active && (
        <span className="text-[10px] text-gray-400">(paused)</span>
      )}
    </button>
  )
}
