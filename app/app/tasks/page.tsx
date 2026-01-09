"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Task, Project } from '@/lib/supabase'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import Link from 'next/link'
import { format } from 'date-fns'
import { useSound } from '@/hooks/useSound'

interface TaskWithProject extends Task {
  project: Pick<Project, 'id' | 'name' | 'color'>
}

/**
 * TasksSkeleton - Neutral loading state for tasks page
 * Shows during auth loading AND data loading to prevent auth flash
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
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="flex gap-2">
                <div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-5 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MyTasksPage() {
  // CRITICAL: Use status as primary auth indicator, not loading boolean
  const { user, status } = useAuth()
  const { playClick, playToggle } = useSound()
  const [tasks, setTasks] = useState<TaskWithProject[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const isInitialLoadRef = useRef(true)

  // Silent refetch for real-time updates
  const refetchTasksSilently = useCallback(async () => {
    if (!user) return
    try {
      const { data: projectMembers } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id)

      const projectIds = projectMembers?.map(pm => pm.project_id) || []
      if (projectIds.length === 0) return

      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`*, project:projects(id, name, color)`)
        .in('project_id', projectIds)
        .order('updated_at', { ascending: false })

      setTasks((tasksData as TaskWithProject[]) || [])
    } catch (error) {
      console.error('Error refetching tasks:', error)
    }
  }, [user])

  // Subscribe to real-time updates
  useRealtimeSubscription({
    subscriptions: [
      { table: 'tasks' },
      { table: 'projects' },
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
      // Get user's projects first
      const { data: projectMembers } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id)

      const projectIds = projectMembers?.map(pm => pm.project_id) || []

      if (projectIds.length === 0) {
        setDataLoading(false)
        return
      }

      // Fetch tasks assigned to user or created by user
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`
          *,
          project:projects(id, name, color)
        `)
        .in('project_id', projectIds)
        .order('updated_at', { ascending: false })

      setTasks((tasksData as TaskWithProject[]) || [])
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

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return task.status !== 'done' && task.status !== 'archived'
    if (filter === 'completed') return task.status === 'done'
    return task.status !== 'archived'
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'review': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleFilterChange = (newFilter: 'all' | 'active' | 'completed') => {
    playToggle()
    setFilter(newFilter)
  }

  // CRITICAL ORDER OF CHECKS:
  // 1. Auth loading → show skeleton (neutral UI)
  // 2. Data loading (when authenticated) → show skeleton
  // 3. Unauthenticated → show login prompt (only after auth is resolved)
  // 4. Authenticated with data → show content

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

  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="page-header animate-slide-up">
          <h1 className="page-title text-3xl">My Tasks</h1>
          <p className="page-description">All tasks across your projects</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 press-scale ${
              filter === 'all'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            All ({tasks.filter(t => t.status !== 'archived').length})
          </button>
          <button
            onClick={() => handleFilterChange('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 press-scale ${
              filter === 'active'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Active ({tasks.filter(t => t.status !== 'done' && t.status !== 'archived').length})
          </button>
          <button
            onClick={() => handleFilterChange('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 press-scale ${
              filter === 'completed'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Completed ({tasks.filter(t => t.status === 'done').length})
          </button>
        </div>

        {/* Tasks List */}
        <div className="card animate-slide-up overflow-hidden" style={{ animationDelay: '100ms' }}>
          {filteredTasks.length > 0 ? (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredTasks.map((task, index) => (
                <li key={task.id} className="animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
                  <Link
                    href={`/app/projects/${task.project_id}`}
                    onClick={playClick}
                    className="block hover:bg-gray-50 dark:hover:bg-gray-800/50 px-5 py-4 transition-all duration-200 press-scale"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {task.title}
                          </p>
                          <span className={`badge ${
                            task.status === 'done' ? 'badge-success' :
                            task.status === 'in_progress' ? 'badge-primary' :
                            task.status === 'review' ? 'badge-warning' :
                            'badge-gray'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                          {task.priority && task.priority !== 'none' && (
                            <span className={`badge ${
                              task.priority === 'urgent' ? 'badge-error' :
                              task.priority === 'high' ? 'badge-warning' :
                              task.priority === 'medium' ? 'badge-primary' :
                              'badge-gray'
                            }`}>
                              {task.priority}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-sm">
                          <span
                            className="badge"
                            style={{
                              backgroundColor: `${task.project?.color}15`,
                              color: task.project?.color,
                            }}
                          >
                            {task.project?.name}
                          </span>
                          {task.due_date && (
                            <span className="flex items-center text-gray-500 dark:text-gray-400 text-xs">
                              <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Due {format(new Date(task.due_date), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state py-12">
              <svg className="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="empty-state-title">No tasks found</h3>
              <p className="empty-state-description">
                {filter === 'all'
                  ? "Get started by creating a task in one of your projects."
                  : `No ${filter} tasks at the moment.`}
              </p>
              <div className="mt-6">
                <Link
                  href="/app/projects"
                  onClick={playClick}
                  className="btn btn-md btn-primary hover-lift"
                >
                  Go to Projects
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
