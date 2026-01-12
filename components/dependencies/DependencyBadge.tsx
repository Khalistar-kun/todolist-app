"use client"

import { useState, useEffect } from 'react'
import { TaskDependencyService, BlockingTask } from '@/lib/services/TaskDependencyService'

interface DependencyBadgeProps {
  taskId: string
  onClick?: () => void
}

/**
 * Shows a badge indicating if a task is blocked
 */
export function DependencyBadge({ taskId, onClick }: DependencyBadgeProps) {
  const [blockingTasks, setBlockingTasks] = useState<BlockingTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDependencies() {
      try {
        const tasks = await TaskDependencyService.getBlockingTasks(taskId)
        setBlockingTasks(tasks.filter(t => !t.is_completed))
      } catch (error) {
        console.error('Error fetching dependencies:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDependencies()
  }, [taskId])

  if (loading || blockingTasks.length === 0) return null

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
      title={`Blocked by ${blockingTasks.length} task${blockingTasks.length > 1 ? 's' : ''}`}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
      <span>Blocked ({blockingTasks.length})</span>
    </button>
  )
}
