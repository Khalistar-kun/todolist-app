"use client"

import { useState, useMemo, useRef, useEffect } from 'react'
import type { Task, Milestone, WorkflowStage } from '@/lib/supabase'
import { TaskDependencyService } from '@/lib/services/TaskDependencyService'

interface TimelineViewProps {
  tasks: Task[]
  milestones?: Milestone[]
  workflowStages: WorkflowStage[]
  onTaskClick?: (task: Task) => void
  onTaskDateChange?: (taskId: string, startDate: Date | null, dueDate: Date | null) => void
  onMilestoneClick?: (milestone: Milestone) => void
}

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter'

interface TaskDependencyMap {
  [taskId: string]: {
    blocking: string[]
    blocked: string[]
  }
}

export function TimelineView({
  tasks,
  milestones = [],
  workflowStages,
  onTaskClick,
  onTaskDateChange,
  onMilestoneClick,
}: TimelineViewProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week')
  const [showDependencies, setShowDependencies] = useState(true)
  const [dependencies, setDependencies] = useState<TaskDependencyMap>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)

  // Fetch dependencies for all tasks
  useEffect(() => {
    async function fetchDependencies() {
      const depMap: TaskDependencyMap = {}
      for (const task of tasks) {
        try {
          const deps = await TaskDependencyService.getTaskDependencies(task.id)
          depMap[task.id] = {
            blocking: deps.blocking.map(t => t.id),
            blocked: deps.blocked.map(t => t.id),
          }
        } catch (error) {
          console.error('Error fetching dependencies for task:', task.id, error)
        }
      }
      setDependencies(depMap)
    }

    if (tasks.length > 0) {
      fetchDependencies()
    }
  }, [tasks])

  // Calculate date range
  const { startDate, endDate, totalDays } = useMemo(() => {
    const now = new Date()
    let minDate = new Date(now)
    let maxDate = new Date(now)
    maxDate.setDate(maxDate.getDate() + 30) // Default to 30 days ahead

    tasks.forEach(task => {
      if (task.start_date) {
        const start = new Date(task.start_date)
        if (start < minDate) minDate = start
      }
      if (task.due_date) {
        const due = new Date(task.due_date)
        if (due > maxDate) maxDate = due
        if (due < minDate) minDate = due
      }
    })

    milestones.forEach(milestone => {
      const date = new Date(milestone.target_date)
      if (date > maxDate) maxDate = date
      if (date < minDate) minDate = date
    })

    // Add padding
    minDate.setDate(minDate.getDate() - 7)
    maxDate.setDate(maxDate.getDate() + 14)

    const days = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))

    return { startDate: minDate, endDate: maxDate, totalDays: days }
  }, [tasks, milestones])

  // Calculate column width based on zoom level
  const columnWidth = useMemo(() => {
    switch (zoomLevel) {
      case 'day': return 40
      case 'week': return 120
      case 'month': return 200
      case 'quarter': return 300
    }
  }, [zoomLevel])

  // Generate time headers
  const timeHeaders = useMemo(() => {
    const headers: Array<{ label: string; width: number; isWeekend?: boolean }> = []
    const current = new Date(startDate)

    while (current <= endDate) {
      switch (zoomLevel) {
        case 'day':
          headers.push({
            label: current.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
            width: columnWidth,
            isWeekend: current.getDay() === 0 || current.getDay() === 6,
          })
          current.setDate(current.getDate() + 1)
          break
        case 'week':
          const weekEnd = new Date(current)
          weekEnd.setDate(weekEnd.getDate() + 6)
          headers.push({
            label: `${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { day: 'numeric' })}`,
            width: columnWidth,
          })
          current.setDate(current.getDate() + 7)
          break
        case 'month':
          headers.push({
            label: current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            width: columnWidth,
          })
          current.setMonth(current.getMonth() + 1)
          break
        case 'quarter':
          const quarter = Math.floor(current.getMonth() / 3) + 1
          headers.push({
            label: `Q${quarter} ${current.getFullYear()}`,
            width: columnWidth,
          })
          current.setMonth(current.getMonth() + 3)
          break
      }
    }

    return headers
  }, [startDate, endDate, zoomLevel, columnWidth])

  // Calculate task bar position and width
  const getTaskBarStyle = (task: Task) => {
    const taskStart = task.start_date ? new Date(task.start_date) : (task.due_date ? new Date(task.due_date) : null)
    const taskEnd = task.due_date ? new Date(task.due_date) : taskStart

    if (!taskStart || !taskEnd) return null

    const startDays = Math.max(0, (taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const durationDays = Math.max(1, (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24) + 1)

    const pixelsPerDay = columnWidth / (zoomLevel === 'day' ? 1 : zoomLevel === 'week' ? 7 : zoomLevel === 'month' ? 30 : 90)

    return {
      left: `${startDays * pixelsPerDay}px`,
      width: `${Math.max(durationDays * pixelsPerDay, 20)}px`,
    }
  }

  // Get stage color for task
  const getTaskColor = (task: Task) => {
    if (task.color) return task.color
    const stage = workflowStages.find(s => s.id === task.stage_id)
    return stage?.color || '#6B7280'
  }

  // Check if task is completed
  const isTaskCompleted = (task: Task) => {
    const doneStage = workflowStages.find(s => s.is_done_stage || s.id === 'done')
    return task.stage_id === doneStage?.id && task.approval_status === 'approved'
  }

  // Filter tasks that have dates
  const tasksWithDates = tasks.filter(task => task.start_date || task.due_date)
  const tasksWithoutDates = tasks.filter(task => !task.start_date && !task.due_date)

  // Today line position
  const todayPosition = useMemo(() => {
    const today = new Date()
    const daysSinceStart = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    const pixelsPerDay = columnWidth / (zoomLevel === 'day' ? 1 : zoomLevel === 'week' ? 7 : zoomLevel === 'month' ? 30 : 90)
    return daysSinceStart * pixelsPerDay
  }, [startDate, columnWidth, zoomLevel])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Timeline</h2>
          <div className="flex items-center gap-1 bg-white dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600">
            {(['day', 'week', 'month', 'quarter'] as ZoomLevel[]).map(level => (
              <button
                key={level}
                onClick={() => setZoomLevel(level)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  zoomLevel === level
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showDependencies}
              onChange={(e) => setShowDependencies(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Show dependencies
          </label>

          <button
            onClick={() => {
              const today = new Date()
              const daysSinceStart = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
              const pixelsPerDay = columnWidth / (zoomLevel === 'day' ? 1 : zoomLevel === 'week' ? 7 : zoomLevel === 'month' ? 30 : 90)
              containerRef.current?.scrollTo({ left: daysSinceStart * pixelsPerDay - 200, behavior: 'smooth' })
            }}
            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Task list sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto">
          <div className="sticky top-0 bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
            Tasks ({tasksWithDates.length})
          </div>
          {tasksWithDates.map(task => (
            <div
              key={task.id}
              onClick={() => onTaskClick?.(task)}
              className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getTaskColor(task) }}
                />
                <span className={`text-sm truncate ${isTaskCompleted(task) ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                  {task.title}
                </span>
              </div>
              {task.due_date && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-4">
                  Due: {new Date(task.due_date).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}

          {tasksWithoutDates.length > 0 && (
            <>
              <div className="sticky top-0 bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-t border-gray-200 dark:border-gray-600 mt-2">
                No Dates ({tasksWithoutDates.length})
              </div>
              {tasksWithoutDates.map(task => (
                <div
                  key={task.id}
                  onClick={() => onTaskClick?.(task)}
                  className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700 cursor-pointer transition-colors opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getTaskColor(task) }}
                    />
                    <span className="text-sm truncate text-gray-600 dark:text-gray-400">
                      {task.title}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Timeline grid */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto"
          onScroll={(e) => setScrollLeft((e.target as HTMLDivElement).scrollLeft)}
        >
          <div style={{ width: `${timeHeaders.reduce((sum, h) => sum + h.width, 0)}px`, minHeight: '100%' }}>
            {/* Time headers */}
            <div className="sticky top-0 z-10 flex bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              {timeHeaders.map((header, i) => (
                <div
                  key={i}
                  className={`flex-shrink-0 px-2 py-2 text-xs font-medium text-center border-r border-gray-200 dark:border-gray-600 ${
                    header.isWeekend ? 'bg-gray-200 dark:bg-gray-600 text-gray-500' : 'text-gray-700 dark:text-gray-300'
                  }`}
                  style={{ width: `${header.width}px` }}
                >
                  {header.label}
                </div>
              ))}
            </div>

            {/* Task rows */}
            <div className="relative">
              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                style={{ left: `${todayPosition}px` }}
              >
                <div className="absolute -top-1 -left-2 w-4 h-4 bg-red-500 rounded-full" />
              </div>

              {/* Milestone markers */}
              {milestones.map(milestone => {
                const date = new Date(milestone.target_date)
                const daysSinceStart = (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
                const pixelsPerDay = columnWidth / (zoomLevel === 'day' ? 1 : zoomLevel === 'week' ? 7 : zoomLevel === 'month' ? 30 : 90)
                const position = daysSinceStart * pixelsPerDay

                return (
                  <div
                    key={milestone.id}
                    className="absolute top-0 z-10 cursor-pointer group"
                    style={{ left: `${position}px` }}
                    onClick={() => onMilestoneClick?.(milestone)}
                  >
                    <div
                      className="w-4 h-4 rotate-45 border-2 hover:scale-110 transition-transform"
                      style={{ backgroundColor: milestone.color, borderColor: milestone.color }}
                    />
                    <div className="absolute left-1/2 -translate-x-1/2 top-6 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30">
                      {milestone.name}
                    </div>
                  </div>
                )
              })}

              {/* Task bars */}
              {tasksWithDates.map((task, index) => {
                const barStyle = getTaskBarStyle(task)
                if (!barStyle) return null

                const isCompleted = isTaskCompleted(task)
                const isBlocked = dependencies[task.id]?.blocking.length > 0

                return (
                  <div
                    key={task.id}
                    className="relative h-10 border-b border-gray-100 dark:border-gray-800"
                  >
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {timeHeaders.map((header, i) => (
                        <div
                          key={i}
                          className={`flex-shrink-0 border-r border-gray-100 dark:border-gray-800 ${
                            header.isWeekend ? 'bg-gray-50 dark:bg-gray-800/50' : ''
                          }`}
                          style={{ width: `${header.width}px` }}
                        />
                      ))}
                    </div>

                    {/* Task bar */}
                    <div
                      className={`absolute top-1.5 h-7 rounded cursor-pointer transition-all hover:brightness-110 ${
                        isBlocked ? 'opacity-60' : ''
                      }`}
                      style={{
                        ...barStyle,
                        backgroundColor: getTaskColor(task),
                      }}
                      onClick={() => onTaskClick?.(task)}
                      title={task.title}
                    >
                      <div className="px-2 py-1 text-xs text-white truncate font-medium">
                        {task.title}
                      </div>
                      {isCompleted && (
                        <div className="absolute inset-0 bg-black/20 rounded flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                      )}
                      {isBlocked && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-red-500" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rotate-45 bg-purple-500" />
          <span>Milestone</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <span>Blocked</span>
        </div>
      </div>
    </div>
  )
}
