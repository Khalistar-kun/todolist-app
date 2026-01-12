"use client"

import { useState, useEffect } from 'react'
import { TaskDependencyService, DependencyType } from '@/lib/services/TaskDependencyService'
import type { Task } from '@/lib/supabase'

interface DependencyPickerProps {
  taskId: string
  projectId: string
  projectTasks: Task[]
  userId: string
  onClose: () => void
  onDependencyAdded?: () => void
}

/**
 * Modal/panel for adding and managing task dependencies
 */
export function DependencyPicker({
  taskId,
  projectId,
  projectTasks,
  userId,
  onClose,
  onDependencyAdded,
}: DependencyPickerProps) {
  const [selectedTask, setSelectedTask] = useState<string>('')
  const [dependencyType, setDependencyType] = useState<DependencyType>('finish_to_start')
  const [lagDays, setLagDays] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Current dependencies
  const [blockingTasks, setBlockingTasks] = useState<Array<{ id: string; title: string; stage_id: string; is_completed: boolean }>>([])
  const [blockedTasks, setBlockedTasks] = useState<Array<{ id: string; title: string; stage_id: string }>>([])

  useEffect(() => {
    async function fetchDependencies() {
      try {
        const deps = await TaskDependencyService.getTaskDependencies(taskId)
        setBlockingTasks(deps.blocking)
        setBlockedTasks(deps.blocked)
      } catch (error) {
        console.error('Error fetching dependencies:', error)
      }
    }

    fetchDependencies()
  }, [taskId])

  // Filter tasks that can be added as dependencies
  const availableTasks = projectTasks.filter(task => {
    // Exclude the current task
    if (task.id === taskId) return false
    // Exclude tasks already in dependencies
    if (blockingTasks.some(t => t.id === task.id)) return false
    if (blockedTasks.some(t => t.id === task.id)) return false
    // Filter by search
    if (searchQuery) {
      return task.title.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

  const handleAddBlocker = async () => {
    if (!selectedTask) return

    setLoading(true)
    setError(null)

    try {
      // Check for potential cycle first
      const wouldCycle = await TaskDependencyService.wouldCreateCycle(
        selectedTask,
        taskId,
        projectId
      )

      if (wouldCycle) {
        setError('Cannot add this dependency - it would create a circular dependency')
        return
      }

      await TaskDependencyService.addDependency(
        selectedTask,
        taskId,
        dependencyType,
        lagDays,
        userId
      )

      // Refresh dependencies
      const deps = await TaskDependencyService.getTaskDependencies(taskId)
      setBlockingTasks(deps.blocking)
      setBlockedTasks(deps.blocked)

      setSelectedTask('')
      onDependencyAdded?.()
    } catch (error: any) {
      setError(error.message || 'Failed to add dependency')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveBlocker = async (blockingTaskId: string) => {
    try {
      await TaskDependencyService.removeDependency(blockingTaskId, taskId)

      // Refresh
      const deps = await TaskDependencyService.getTaskDependencies(taskId)
      setBlockingTasks(deps.blocking)
      setBlockedTasks(deps.blocked)

      onDependencyAdded?.()
    } catch (error) {
      console.error('Error removing dependency:', error)
    }
  }

  const handleRemoveBlocked = async (blockedTaskId: string) => {
    try {
      await TaskDependencyService.removeDependency(taskId, blockedTaskId)

      // Refresh
      const deps = await TaskDependencyService.getTaskDependencies(taskId)
      setBlockingTasks(deps.blocking)
      setBlockedTasks(deps.blocked)

      onDependencyAdded?.()
    } catch (error) {
      console.error('Error removing dependency:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Blocking Tasks (Prerequisites) */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          Blocked By (must be done first)
        </h3>

        {blockingTasks.length > 0 ? (
          <ul className="space-y-2 mb-3">
            {blockingTasks.map(task => (
              <li
                key={task.id}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  task.is_completed
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {task.is_completed ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span className={`text-sm ${task.is_completed ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                    {task.title}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveBlocker(task.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove dependency"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            No blocking dependencies
          </p>
        )}

        {/* Add blocker */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a task to add as blocker...</option>
            {availableTasks.map(task => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>

          {selectedTask && (
            <>
              <div className="flex gap-2">
                <select
                  value={dependencyType}
                  onChange={(e) => setDependencyType(e.target.value as DependencyType)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="finish_to_start">Finish to Start</option>
                  <option value="start_to_start">Start to Start</option>
                  <option value="finish_to_finish">Finish to Finish</option>
                  <option value="start_to_finish">Start to Finish</option>
                </select>

                <div className="relative w-24">
                  <input
                    type="number"
                    min="0"
                    value={lagDays}
                    onChange={(e) => setLagDays(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                    days
                  </span>
                </div>
              </div>

              <button
                onClick={handleAddBlocker}
                disabled={loading}
                className="w-full px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Blocker'}
              </button>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </div>

      {/* Blocked Tasks (Dependents) */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
          Blocking (waiting on this task)
        </h3>

        {blockedTasks.length > 0 ? (
          <ul className="space-y-2">
            {blockedTasks.map(task => (
              <li
                key={task.id}
                className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
              >
                <span className="text-sm text-gray-900 dark:text-white">
                  {task.title}
                </span>
                <button
                  onClick={() => handleRemoveBlocked(task.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove dependency"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No tasks are waiting on this
          </p>
        )}
      </div>
    </div>
  )
}
