"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Task, Project } from '@/lib/supabase'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import Link from 'next/link'
import { format, isToday, isTomorrow, isPast, isThisWeek, addDays } from 'date-fns'
import { useSound } from '@/hooks/useSound'

interface TaskWithProject extends Task {
  project: Pick<Project, 'id' | 'name' | 'color'>
}

type FilterType = 'assigned' | 'created' | 'all'
type GroupBy = 'none' | 'project' | 'due_date' | 'priority'
type SortBy = 'due_date' | 'priority' | 'updated_at' | 'created_at'

/**
 * TasksSkeleton - Neutral loading state for tasks page
 */
function TasksSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="mb-6 flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }

export default function MyTasksPage() {
  const { user, status } = useAuth()
  const { playClick, playToggle } = useSound()
  const [tasks, setTasks] = useState<TaskWithProject[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('active')
  const [filterType, setFilterType] = useState<FilterType>('assigned')
  const [groupBy, setGroupBy] = useState<GroupBy>('due_date')
  const [sortBy, setSortBy] = useState<SortBy>('due_date')
  const [searchQuery, setSearchQuery] = useState('')
  const isInitialLoadRef = useRef(true)

  // Silent refetch for real-time updates
  const refetchTasksSilently = useCallback(async () => {
    if (!user) return
    try {
      // Get tasks assigned to user
      const { data: assignments } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('user_id', user.id)

      const assignedTaskIds = assignments?.map(a => a.task_id) || []

      // Fetch all tasks with project info
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`*, project:projects(id, name, color)`)
        .order('updated_at', { ascending: false })

      const allTasks = (tasksData as TaskWithProject[]) || []

      // Mark which tasks are assigned to user
      const tasksWithAssignment = allTasks.map(task => ({
        ...task,
        isAssigned: assignedTaskIds.includes(task.id),
        isCreatedByUser: task.created_by === user.id
      }))

      setTasks(tasksWithAssignment as TaskWithProject[])
    } catch (error) {
      console.error('Error refetching tasks:', error)
    }
  }, [user])

  // Subscribe to real-time updates
  useRealtimeSubscription({
    subscriptions: [
      { table: 'tasks' },
      { table: 'task_assignments' },
    ],
    onChange: () => {
      if (!isInitialLoadRef.current) {
        refetchTasksSilently()
      }
    },
    enabled: !!user,
  })

  const fetchTasks = useCallback(async () => {
    if (!user) return
    try {
      // Get tasks assigned to user
      const { data: assignments } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('user_id', user.id)

      const assignedTaskIds = assignments?.map(a => a.task_id) || []

      // Get user's projects
      const { data: projectMembers } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id)

      const projectIds = projectMembers?.map(pm => pm.project_id) || []

      if (projectIds.length === 0 && assignedTaskIds.length === 0) {
        setDataLoading(false)
        return
      }

      // Fetch tasks from user's projects
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`*, project:projects(id, name, color)`)
        .in('project_id', projectIds)
        .order('updated_at', { ascending: false })

      const allTasks = (tasksData as TaskWithProject[]) || []

      // Add metadata for filtering
      const tasksWithMeta = allTasks.map(task => ({
        ...task,
        isAssigned: assignedTaskIds.includes(task.id),
        isCreatedByUser: task.created_by === user.id
      }))

      setTasks(tasksWithMeta as TaskWithProject[])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setDataLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchTasks().then(() => {
        isInitialLoadRef.current = false
      })
    }
  }, [user, fetchTasks])

  // Filter tasks based on all criteria
  const filteredTasks = tasks.filter(task => {
    const taskWithMeta = task as TaskWithProject & { isAssigned?: boolean; isCreatedByUser?: boolean }

    // Filter by assignment type
    if (filterType === 'assigned' && !taskWithMeta.isAssigned) return false
    if (filterType === 'created' && !taskWithMeta.isCreatedByUser) return false

    // Filter by status
    if (filter === 'active' && (task.status === 'done' || task.status === 'archived')) return false
    if (filter === 'completed' && task.status !== 'done') return false
    if (filter === 'overdue') {
      if (!task.due_date) return false
      if (!isPast(new Date(task.due_date))) return false
      if (task.status === 'done' || task.status === 'archived') return false
    }
    if (filter === 'all' && task.status === 'archived') return false

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!task.title.toLowerCase().includes(query) &&
          !task.project?.name?.toLowerCase().includes(query)) {
        return false
      }
    }

    return true
  })

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    switch (sortBy) {
      case 'due_date':
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      case 'priority':
        return (PRIORITY_ORDER[a.priority] || 4) - (PRIORITY_ORDER[b.priority] || 4)
      case 'updated_at':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      case 'created_at':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      default:
        return 0
    }
  })

  // Group tasks
  const groupedTasks = () => {
    if (groupBy === 'none') {
      return { 'All Tasks': sortedTasks }
    }

    const groups: Record<string, TaskWithProject[]> = {}

    sortedTasks.forEach(task => {
      let groupKey: string

      switch (groupBy) {
        case 'project':
          groupKey = task.project?.name || 'No Project'
          break
        case 'due_date':
          if (!task.due_date) {
            groupKey = 'No Due Date'
          } else {
            const dueDate = new Date(task.due_date)
            if (isPast(dueDate) && !isToday(dueDate)) {
              groupKey = 'Overdue'
            } else if (isToday(dueDate)) {
              groupKey = 'Today'
            } else if (isTomorrow(dueDate)) {
              groupKey = 'Tomorrow'
            } else if (isThisWeek(dueDate)) {
              groupKey = 'This Week'
            } else {
              groupKey = 'Later'
            }
          }
          break
        case 'priority':
          groupKey = task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'None'
          break
        default:
          groupKey = 'All'
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(task)
    })

    // Sort groups by priority order if grouping by due date
    if (groupBy === 'due_date') {
      const order = ['Overdue', 'Today', 'Tomorrow', 'This Week', 'Later', 'No Due Date']
      const orderedGroups: Record<string, TaskWithProject[]> = {}
      order.forEach(key => {
        if (groups[key]) {
          orderedGroups[key] = groups[key]
        }
      })
      return orderedGroups
    }

    if (groupBy === 'priority') {
      const order = ['Urgent', 'High', 'Medium', 'Low', 'None']
      const orderedGroups: Record<string, TaskWithProject[]> = {}
      order.forEach(key => {
        if (groups[key]) {
          orderedGroups[key] = groups[key]
        }
      })
      return orderedGroups
    }

    return groups
  }

  const getGroupIcon = (groupName: string) => {
    const icons: Record<string, React.ReactNode> = {
      'Overdue': (
        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
      'Today': (
        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ),
      'Tomorrow': (
        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
      'Urgent': (
        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        </svg>
      ),
      'High': (
        <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l7.5-7.5 7.5 7.5m-15 6l7.5-7.5 7.5 7.5" />
        </svg>
      ),
    }
    return icons[groupName] || null
  }

  const getGroupColor = (groupName: string) => {
    const colors: Record<string, string> = {
      'Overdue': 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20',
      'Today': 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20',
      'Tomorrow': 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
      'Urgent': 'border-red-200 dark:border-red-800',
      'High': 'border-orange-200 dark:border-orange-800',
    }
    return colors[groupName] || 'border-gray-200 dark:border-gray-700'
  }

  const handleFilterChange = (newFilter: 'all' | 'active' | 'completed' | 'overdue') => {
    playToggle()
    setFilter(newFilter)
  }

  // Stats
  const stats = {
    total: tasks.filter(t => (t as any).isAssigned && t.status !== 'archived').length,
    active: tasks.filter(t => (t as any).isAssigned && t.status !== 'done' && t.status !== 'archived').length,
    completed: tasks.filter(t => (t as any).isAssigned && t.status === 'done').length,
    overdue: tasks.filter(t => {
      if (!(t as any).isAssigned) return false
      if (!t.due_date) return false
      if (t.status === 'done' || t.status === 'archived') return false
      return isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
    }).length,
  }

  if (status === 'loading') {
    return <TasksSkeleton />
  }

  if (status === 'authenticated' && dataLoading) {
    return <TasksSkeleton />
  }

  if (status === 'unauthenticated' || !user) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-gray-500 dark:text-gray-400">Please sign in to view your tasks.</p>
      </div>
    )
  }

  const grouped = groupedTasks()

  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="page-header animate-slide-up mb-6">
          <h1 className="page-title text-3xl">My Tasks</h1>
          <p className="page-description">Tasks assigned to you across all projects</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '30ms' }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Assigned</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Active</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>{stats.overdue}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Overdue</div>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 animate-slide-up" style={{ animationDelay: '50ms' }}>
          {/* Status Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleFilterChange('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 press-scale ${
                filter === 'active'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => handleFilterChange('overdue')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 press-scale ${
                filter === 'overdue'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Overdue {stats.overdue > 0 && `(${stats.overdue})`}
            </button>
            <button
              onClick={() => handleFilterChange('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 press-scale ${
                filter === 'completed'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 press-scale ${
                filter === 'all'
                  ? 'bg-gray-700 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* View Controls */}
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="assigned">Assigned to me</option>
              <option value="created">Created by me</option>
              <option value="all">All tasks</option>
            </select>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="due_date">Group by Due Date</option>
              <option value="project">Group by Project</option>
              <option value="priority">Group by Priority</option>
              <option value="none">No Grouping</option>
            </select>
          </div>
        </div>

        {/* Task Groups */}
        <div className="space-y-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
          {Object.keys(grouped).length > 0 ? (
            Object.entries(grouped).map(([groupName, groupTasks]) => (
              <div key={groupName} className={`bg-white dark:bg-gray-800 rounded-xl border ${getGroupColor(groupName)} overflow-hidden`}>
                {/* Group Header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                  {getGroupIcon(groupName)}
                  <h3 className="font-semibold text-gray-900 dark:text-white">{groupName}</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">({groupTasks.length})</span>
                </div>

                {/* Tasks List */}
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {groupTasks.map((task, index) => {
                    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== 'done'

                    return (
                      <li key={task.id} className="animate-fade-in" style={{ animationDelay: `${index * 20}ms` }}>
                        <Link
                          href={`/app/projects/${task.project_id}`}
                          onClick={playClick}
                          className="block hover:bg-gray-50 dark:hover:bg-gray-700/50 px-4 py-3 transition-all duration-200"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-medium truncate ${
                                  task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'
                                }`}>
                                  {task.title}
                                </span>
                                {task.priority && task.priority !== 'none' && (
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                    task.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    task.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                  }`}>
                                    {task.priority}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-xs">
                                <span
                                  className="px-2 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: `${task.project?.color}15`,
                                    color: task.project?.color,
                                  }}
                                >
                                  {task.project?.name}
                                </span>
                                {task.due_date && (
                                  <span className={`flex items-center ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {isToday(new Date(task.due_date)) ? 'Today' :
                                     isTomorrow(new Date(task.due_date)) ? 'Tomorrow' :
                                     format(new Date(task.due_date), 'MMM d')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded-lg ${
                                task.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                task.status === 'review' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                {task.status.replace('_', ' ')}
                              </span>
                              <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tasks found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {filter === 'overdue' ? "Great! You have no overdue tasks." :
                 filter === 'completed' ? "No completed tasks yet." :
                 filterType === 'assigned' ? "No tasks are assigned to you." :
                 "Get started by creating a task in one of your projects."}
              </p>
              <Link
                href="/app/projects"
                onClick={playClick}
                className="btn btn-md btn-primary hover-lift"
              >
                Go to Projects
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
