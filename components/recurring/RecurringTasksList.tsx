"use client"

import { useState, useEffect } from 'react'
import { RecurringTaskService, RecurringTaskWithDetails, TaskRecurrence } from '@/lib/services/RecurringTaskService'
import Link from 'next/link'

interface RecurringTasksListProps {
  projectId?: string
  userId?: string
  onEditRecurrence?: (taskId: string, recurrence: TaskRecurrence) => void
}

/**
 * List of all recurring tasks for a project or user
 */
export function RecurringTasksList({ projectId, userId, onEditRecurrence }: RecurringTasksListProps) {
  const [recurringTasks, setRecurringTasks] = useState<RecurringTaskWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRecurringTasks() {
      try {
        let tasks: RecurringTaskWithDetails[] = []
        if (projectId) {
          tasks = await RecurringTaskService.getProjectRecurringTasks(projectId)
        } else if (userId) {
          tasks = await RecurringTaskService.getUserRecurringTasks(userId)
        }
        setRecurringTasks(tasks)
      } catch (error) {
        console.error('Error fetching recurring tasks:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecurringTasks()
  }, [projectId, userId])

  const handleToggle = async (recurrence: TaskRecurrence) => {
    try {
      await RecurringTaskService.toggleRecurrence(recurrence.id, !recurrence.is_active)
      setRecurringTasks(prev =>
        prev.map(rt =>
          rt.id === recurrence.id ? { ...rt, is_active: !recurrence.is_active } : rt
        )
      )
    } catch (error) {
      console.error('Error toggling recurrence:', error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (recurringTasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600\" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
        </svg>
        <p>No recurring tasks</p>
        <p className="text-sm mt-1">Set up recurrence patterns on tasks to see them here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {recurringTasks.map(rt => (
        <div
          key={rt.id}
          className={`p-4 bg-white dark:bg-gray-800 rounded-lg border transition-colors ${
            rt.is_active
              ? 'border-gray-200 dark:border-gray-700'
              : 'border-gray-200 dark:border-gray-700 opacity-60'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900 dark:text-white truncate">
                  {rt.task.title}
                </h3>
                {!rt.is_active && (
                  <span className="px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 rounded">
                    Paused
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                {!projectId && rt.task.project && (
                  <Link
                    href={`/app/projects/${rt.task.project_id}`}
                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: rt.task.project.color }}
                    />
                    {rt.task.project.name}
                  </Link>
                )}
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                  </svg>
                  {RecurringTaskService.formatRecurrence(rt)}
                </span>
              </div>

              {rt.next_occurrence && rt.is_active && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Next: {new Date(rt.next_occurrence).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              )}

              {rt.occurrences_created > 0 && (
                <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {rt.occurrences_created} occurrence{rt.occurrences_created !== 1 ? 's' : ''} created
                  {rt.max_occurrences && ` of ${rt.max_occurrences}`}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle active/inactive */}
              <button
                onClick={() => handleToggle(rt)}
                className="min-w-[44px] min-h-[44px] p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={rt.is_active ? 'Pause recurrence' : 'Resume recurrence'}
              >
                {rt.is_active ? (
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                )}
              </button>

              {/* Edit recurrence */}
              {onEditRecurrence && (
                <button
                  onClick={() => onEditRecurrence(rt.task_id, rt)}
                  className="min-w-[44px] min-h-[44px] p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Edit recurrence"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
