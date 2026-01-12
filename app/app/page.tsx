"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Project, Task } from '@/lib/supabase'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { usePageVisibility } from '@/hooks/usePageVisibility'
import Link from 'next/link'
import { format } from 'date-fns'
import { useSound } from '@/hooks/useSound'
import { PendingInvitationsBanner } from '@/components/invitations/PendingInvitationsBanner'

interface DashboardStats {
  totalProjects: number
  activeTasks: number
  completedTasks: number
  totalTasks: number
}

interface RecentTask extends Task {
  project: Pick<Project, 'name' | 'color'>
}

// Maximum time to wait for data before showing empty state
const DATA_LOADING_TIMEOUT_MS = 15000

/**
 * DashboardSkeleton - Neutral loading state for dashboard
 * Shows during auth loading AND data loading to prevent auth flash
 */
function DashboardSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-96 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="ml-4 flex-1">
                  <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-2" />
                  <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Content Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="px-5 py-4 flex items-center gap-3">
                    <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                      <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  // CRITICAL: Use status as primary auth indicator, not loading boolean
  const { user, status, forceRefresh } = useAuth()
  const { playClick } = useSound()
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeTasks: 0,
    completedTasks: 0,
    totalTasks: 0,
  })
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const isInitialLoadRef = useRef(true)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastDataRefreshRef = useRef<number>(0)

  // Silent refetch for real-time updates - uses same parallel pattern
  const refetchDataSilently = useCallback(async () => {
    if (!user) return
    try {
      const { data: projectMembers } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id)

      const projectIds = projectMembers?.map(pm => pm.project_id) || []
      if (projectIds.length === 0) return

      const [projectsResult, tasksResult, statsResult] = await Promise.all([
        supabase
          .from('projects')
          .select('*')
          .in('id', projectIds)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('tasks')
          .select('*, project:projects(name, color)')
          .in('project_id', projectIds)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('tasks')
          .select('status')
          .in('project_id', projectIds)
      ])

      setProjects(projectsResult.data || [])
      setRecentTasks(tasksResult.data as RecentTask[] || [])

      const allTaskStatuses = statsResult.data || []
      setStats({
        totalProjects: projectIds.length,
        activeTasks: allTaskStatuses.filter(t => t.status !== 'done' && t.status !== 'archived').length,
        completedTasks: allTaskStatuses.filter(t => t.status === 'done').length,
        totalTasks: allTaskStatuses.length,
      })
    } catch (error) {
      console.error('Error refetching dashboard data:', error)
    }
  }, [user])

  // Subscribe to real-time updates
  useRealtimeSubscription({
    subscriptions: [
      { table: 'projects' },
      { table: 'tasks' },
      { table: 'project_members' },
    ],
    onChange: () => {
      if (!isInitialLoadRef.current) {
        refetchDataSilently()
      }
    },
    enabled: !!user,
  })

  // Handle page visibility - refresh data when tab becomes visible or page restored from bfcache
  // This is CRITICAL for macOS/iOS where bfcache causes stale data
  usePageVisibility({
    onVisible: () => {
      const now = Date.now()
      // Debounce - only refresh if more than 5 seconds since last refresh
      if (user && now - lastDataRefreshRef.current > 5000) {
        console.log('[Dashboard] Page visible - refreshing data')
        lastDataRefreshRef.current = now
        refetchDataSilently()
      }
    },
    onPageShow: (persisted) => {
      if (persisted && user) {
        console.log('[Dashboard] Page restored from bfcache - refreshing data')
        lastDataRefreshRef.current = Date.now()
        refetchDataSilently()
      }
    },
  })

  const fetchDashboardData = useCallback(async () => {
    if (!user) return
    try {
      // First get user's project IDs
      const { data: projectMembers, error: memberError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id)

      if (memberError) {
        console.error('Error fetching project members:', memberError)
        setDataLoading(false)
        return
      }

      const projectIds = projectMembers?.map(pm => pm.project_id) || []

      if (projectIds.length === 0) {
        setDataLoading(false)
        return
      }

      // Fetch projects, recent tasks, and task counts IN PARALLEL
      const [projectsResult, tasksResult, statsResult] = await Promise.all([
        // Projects - fetch all fields for type compatibility
        supabase
          .from('projects')
          .select('*')
          .in('id', projectIds)
          .order('updated_at', { ascending: false })
          .limit(5),

        // Recent tasks with project info
        supabase
          .from('tasks')
          .select('*, project:projects(name, color)')
          .in('project_id', projectIds)
          .order('updated_at', { ascending: false })
          .limit(5),

        // Get task counts for stats (separate query for accuracy)
        supabase
          .from('tasks')
          .select('status')
          .in('project_id', projectIds)
      ])

      const projectsData = projectsResult.data || []
      const tasksData = tasksResult.data as RecentTask[] || []
      const allTaskStatuses = statsResult.data || []

      setProjects(projectsData)
      setRecentTasks(tasksData)

      // Calculate accurate stats from all tasks
      const totalTasks = allTaskStatuses.length
      const completedTasks = allTaskStatuses.filter(t => t.status === 'done').length
      const activeTasks = allTaskStatuses.filter(t => t.status !== 'done' && t.status !== 'archived').length

      setStats({
        totalProjects: projectIds.length,
        activeTasks,
        completedTasks,
        totalTasks,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setDataLoading(false)
    }
  }, [user])

  useEffect(() => {
    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }

    if (user) {
      // Set a timeout to prevent infinite loading
      loadingTimeoutRef.current = setTimeout(() => {
        if (dataLoading) {
          console.warn('[Dashboard] Data loading timed out')
          setLoadError('Loading is taking longer than expected. Please refresh the page.')
          setDataLoading(false)
        }
      }, DATA_LOADING_TIMEOUT_MS)

      fetchDashboardData().then(() => {
        isInitialLoadRef.current = false
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
        }
      })
    } else if (status === 'unauthenticated') {
      // Confirmed not logged in - stop data loading
      setDataLoading(false)
    }
    // Note: Don't set dataLoading=false when status === 'loading'
    // This prevents showing unauthenticated UI during auth hydration

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [user, status, fetchDashboardData, dataLoading])

  // CRITICAL ORDER OF CHECKS:
  // 1. Auth loading → show skeleton (neutral UI)
  // 2. Data loading (when authenticated) → show skeleton
  // 3. Unauthenticated → show login prompt (only after auth is resolved)
  // 4. Authenticated with data → show dashboard

  // Check 1: Auth is still loading - show skeleton, never login UI
  if (status === 'loading') {
    return <DashboardSkeleton />
  }

  // Check 2: Auth resolved, still loading data - show skeleton
  if (status === 'authenticated' && dataLoading) {
    return <DashboardSkeleton />
  }


  // Show error state if loading timed out
  if (loadError) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 text-yellow-500">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Loading Issue</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{loadError}</p>
        <button
          onClick={() => {
            setLoadError(null)
            setDataLoading(true)
            fetchDashboardData()
          }}
          className="btn btn-md btn-primary hover-lift"
        >
          Try Again
        </button>
      </div>
    )
  }

  // CRITICAL: Only show login screen when we are CERTAIN user is not authenticated
  // status === 'unauthenticated' means auth check completed and confirmed no session
  // This prevents flashing login screen during auth hydration
  if (status === 'unauthenticated' || !user) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Welcome to TodoApp</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Please sign in to access your dashboard.</p>
        <Link
          href="/auth/signin"
          onClick={playClick}
          className="btn btn-md btn-primary hover-lift"
        >
          Sign In
        </Link>
      </div>
    )
  }

  // At this point, user is guaranteed to be non-null
  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Pending Invitations Banner */}
        <PendingInvitationsBanner />

        {/* Header */}
        <div className="page-header animate-slide-up">
          <h1 className="page-title text-3xl">
            Welcome back, {user.full_name || user.email?.split('@')[0]}!
          </h1>
          <p className="page-description">Here's what's happening with your projects today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8 stagger-children">
          <div className="stat-card hover-lift cursor-default">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="stat-label">Total Projects</p>
                <p className="stat-value">{stats.totalProjects}</p>
              </div>
            </div>
          </div>

          <div className="stat-card hover-lift cursor-default">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="stat-label">Total Tasks</p>
                <p className="stat-value">{stats.totalTasks}</p>
              </div>
            </div>
          </div>

          <div className="stat-card hover-lift cursor-default">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="stat-label">Active Tasks</p>
                <p className="stat-value">{stats.activeTasks}</p>
              </div>
            </div>
          </div>

          <div className="stat-card hover-lift cursor-default">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="stat-label">Completed</p>
                <p className="stat-value">{stats.completedTasks}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Projects */}
          <div className="card animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="section-title">Recent Projects</h3>
                <Link
                  href="/app/projects"
                  onClick={playClick}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  View all
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {projects.length > 0 ? (
                projects.slice(0, 5).map((project, index) => (
                  <Link
                    key={project.id}
                    href={`/app/projects/${project.id}`}
                    onClick={playClick}
                    className="list-item hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 press-scale"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {project.description || 'No description'}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))
              ) : (
                <div className="empty-state py-8">
                  <svg className="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="empty-state-title">No projects yet</p>
                  <p className="empty-state-description">Create your first project to get started</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Tasks */}
          <div className="card animate-slide-up" style={{ animationDelay: '150ms' }}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="section-title">Recent Tasks</h3>
                <Link
                  href="/app/tasks"
                  onClick={playClick}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  View all
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentTasks.length > 0 ? (
                recentTasks.slice(0, 5).map((task, index) => (
                  <Link
                    key={task.id}
                    href={`/app/projects/${task.project_id}`}
                    onClick={playClick}
                    className="list-item hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 press-scale"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center mt-1.5 gap-2 flex-wrap">
                        <span
                          className="badge"
                          style={{
                            backgroundColor: `${task.project?.color}15`,
                            color: task.project?.color,
                          }}
                        >
                          {task.project?.name}
                        </span>
                        <span className={`badge ${
                          task.status === 'done'
                            ? 'badge-success'
                            : task.status === 'in_progress'
                            ? 'badge-primary'
                            : 'badge-gray'
                        }`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        {task.due_date && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {format(new Date(task.due_date), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="empty-state py-8">
                  <svg className="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="empty-state-title">No tasks yet</p>
                  <p className="empty-state-description">Tasks will appear here once you create them</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        {projects.length === 0 && (
          <div className="mt-8 text-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Ready to get started?</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-sm mx-auto">Create your first project to start organizing your tasks and boost your productivity.</p>
            <Link
              href="/app/projects/new"
              onClick={playClick}
              className="btn btn-md btn-primary hover-lift inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Project
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}