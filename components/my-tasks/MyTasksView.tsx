"use client"

import { useState, useEffect, useMemo } from 'react'
import { MyTasksService, MyTask, MyTasksFilters } from '@/lib/services/MyTasksService'
import Link from 'next/link'

interface MyTasksViewProps {
  userId: string
  onTaskClick?: (task: MyTask) => void
}

type GroupBy = 'due_date' | 'project' | 'priority'

const PRIORITY_ORDER = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
}

const PRIORITY_COLORS = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  none: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
}

export function MyTasksView({
  userId,
  onTaskClick,
}: MyTasksViewProps) {
  const [tasks, setTasks] = useState<MyTask[]>([])
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    completed: 0,
    overdue: 0,
    due_today: 0,
    due_this_week: 0,
  })
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState<GroupBy>('due_date')
  const [filters, setFilters] = useState<MyTasksFilters>({ status: 'active' })

  useEffect(() => {
    async function fetchTasks() {
      setLoading(true)
      try {
        const [taskData, countData] = await Promise.all([
          MyTasksService.getMyTasks(userId, filters),
          MyTasksService.getMyTasksCounts(userId),
        ])
        setTasks(taskData)
        setCounts(countData)
      } catch (error) {
        console.error('Error fetching tasks:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [userId, filters])

  // Group tasks
  const groupedTasks = useMemo(() => {
    if (groupBy === 'due_date') {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]
      const weekEnd = new Date(now)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const weekEndStr = weekEnd.toISOString().split('T')[0]

      const groups: Record<string, { label: string; tasks: MyTask[]; color?: string }> = {
        overdue: { label: 'Overdue', tasks: [], color: 'text-red-600' },
        today: { label: 'Today', tasks: [], color: 'text-blue-600' },
        tomorrow: { label: 'Tomorrow', tasks: [] },
        this_week: { label: 'This Week', tasks: [] },
        later: { label: 'Later', tasks: [] },
        no_date: { label: 'No Due Date', tasks: [], color: 'text-gray-400' },
      }

      tasks.forEach(task => {
        if (!task.due_date) {
          groups.no_date.tasks.push(task)
        } else {
          const dueDate = task.due_date.split('T')[0]
          if (dueDate < today) {
            groups.overdue.tasks.push(task)
          } else if (dueDate === today) {
            groups.today.tasks.push(task)
          } else if (dueDate === tomorrowStr) {
            groups.tomorrow.tasks.push(task)
          } else if (dueDate <= weekEndStr) {
            groups.this_week.tasks.push(task)
          } else {
            groups.later.tasks.push(task)
          }
        }
      })

      return Object.entries(groups).filter(([_, g]) => g.tasks.length > 0)
    }

    if (groupBy === 'project') {
      const groups: Record<string, { label: string; tasks: MyTask[]; color?: string }> = {}

      tasks.forEach(task => {
        if (!groups[task.project_id]) {
          groups[task.project_id] = {
            label: task.project.name,
            tasks: [],
            color: task.project.color,
          }
        }
        groups[task.project_id].tasks.push(task)
      })

      return Object.entries(groups)
    }

    if (groupBy === 'priority') {
      const groups: Record<string, { label: string; tasks: MyTask[]; color?: string }> = {
        urgent: { label: 'Urgent', tasks: [], color: 'text-red-600' },
        high: { label: 'High', tasks: [], color: 'text-orange-600' },
        medium: { label: 'Medium', tasks: [], color: 'text-yellow-600' },
        low: { label: 'Low', tasks: [], color: 'text-blue-600' },
        none: { label: 'No Priority', tasks: [], color: 'text-gray-400' },
      }

      tasks.forEach(task => {
        const priority = task.priority || 'none'
        groups[priority].tasks.push(task)
      })

      return Object.entries(groups).filter(([_, g]) => g.tasks.length > 0)
    }

    return []
  }, [tasks, groupBy])

  const formatDueDate = (date: string) => {
    const d = new Date(date)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilters({ status: 'active' })}
          className={`p-4 rounded-lg border transition-colors ${
            filters.status === 'active'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-500 dark:text-gray-400">Active</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{counts.active}</div>
        </button>
        <button
          onClick={() => setFilters({ status: 'overdue' })}
          className={`p-4 rounded-lg border transition-colors ${
            filters.status === 'overdue'
              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-500 dark:text-gray-400">Overdue</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{counts.overdue}</div>
        </button>
        <button
          onClick={() => setFilters({ status: 'active', dueDateRange: 'today' })}
          className={`p-4 rounded-lg border transition-colors ${
            filters.dueDateRange === 'today'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-500 dark:text-gray-400">Due Today</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{counts.due_today}</div>
        </button>
        <button
          onClick={() => setFilters({ status: 'completed' })}
          className={`p-4 rounded-lg border transition-colors ${
            filters.status === 'completed'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{counts.completed}</div>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Group by:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="due_date">Due Date</option>
            <option value="project">Project</option>
            <option value="priority">Priority</option>
          </select>
        </div>

        <button
          onClick={() => setFilters({ status: 'all' })}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Show All Tasks
        </button>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No tasks found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTasks.map(([key, group]) => (
            <div key={key}>
              <h3 className={`text-sm font-medium mb-2 ${group.color || 'text-gray-700 dark:text-gray-300'}`}>
                {group.label} ({group.tasks.length})
              </h3>
              <div className="space-y-2">
                {group.tasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick?.(task)}
                    className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer transition-colors"
                  >
                    {/* Priority indicator */}
                    <div className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[task.priority || 'none']}`}>
                      {task.priority || 'none'}
                    </div>

                    {/* Task title */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {task.title}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Link
                          href={`/app/projects/${task.project_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: task.project.color }}
                          />
                          {task.project.name}
                        </Link>
                      </div>
                    </div>

                    {/* Due date */}
                    {task.due_date && (
                      <div className={`text-sm ${
                        new Date(task.due_date) < new Date() ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formatDueDate(task.due_date)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
