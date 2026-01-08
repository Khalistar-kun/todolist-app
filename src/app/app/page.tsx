"use client"

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Project, Task } from '@/lib/supabase'
import Link from 'next/link'
import { format } from 'date-fns'

interface DashboardStats {
  totalProjects: number
  activeTasks: number
  completedTasks: number
  totalTasks: number
}

interface RecentTask extends Task {
  project: Pick<Project, 'name' | 'color'>
}

export default function Dashboard() {
  const { user, loading } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeTasks: 0,
    completedTasks: 0,
    totalTasks: 0,
  })
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  const fetchDashboardData = useCallback(async () => {
    if (!user) return
    try {
      // Get user's projects
      const { data: projectMembers } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user!.id)

      const projectIds = projectMembers?.map(pm => pm.project_id) || []

      if (projectIds.length === 0) {
        setDataLoading(false)
        return
      }

      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .order('updated_at', { ascending: false })

      setProjects(projectsData || [])

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`
          *,
          project:projects(name, color)
        `)
        .in('project_id', projectIds)
        .order('updated_at', { ascending: false })
        .limit(10)

      const recentTasksData = tasksData as RecentTask[] || []

      // Calculate stats
      const totalTasks = recentTasksData.length
      const completedTasks = recentTasksData.filter(task => task.status === 'done').length
      const activeTasks = recentTasksData.filter(task => task.status !== 'done' && task.status !== 'archived').length

      setStats({
        totalProjects: projectsData?.length || 0,
        activeTasks,
        completedTasks,
        totalTasks,
      })

      setRecentTasks(recentTasksData)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setDataLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user, fetchDashboardData])

  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to TodoApp</h2>
        <p className="text-gray-600 mb-8">Please sign in to access your dashboard.</p>
        <Link
          href="/auth/signin"
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
        >
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.full_name || user.email}!
          </h1>
          <p className="mt-2 text-gray-600">Here's what's happening with your projects today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Projects</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalProjects}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Tasks</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalTasks}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Tasks</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.activeTasks}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.completedTasks}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Projects */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Projects</h3>
                <Link href="/app/projects" className="text-sm text-blue-600 hover:text-blue-500">
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {projects.length > 0 ? (
                  projects.slice(0, 5).map((project) => (
                    <Link
                      key={project.id}
                      href={`/app/projects/${project.id}`}
                      className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {project.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {project.description || 'No description'}
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No projects yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Tasks */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Tasks</h3>
                <Link href="/app/tasks" className="text-sm text-blue-600 hover:text-blue-500">
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {recentTasks.length > 0 ? (
                  recentTasks.slice(0, 5).map((task) => (
                    <Link
                      key={task.id}
                      href={`/app/projects/${task.project_id}/tasks/${task.id}`}
                      className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {task.title}
                        </p>
                        <div className="flex items-center mt-1 space-x-2">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: `${task.project?.color}20`,
                              color: task.project?.color,
                            }}
                          >
                            {task.project?.name}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            task.status === 'done'
                              ? 'bg-green-100 text-green-800'
                              : task.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                          {task.due_date && (
                            <span className="text-xs text-gray-500">
                              Due {format(new Date(task.due_date), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No tasks yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        {projects.length === 0 && (
          <div className="mt-8 text-center bg-blue-50 rounded-lg p-8">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Ready to get started?</h3>
            <p className="text-blue-700 mb-4">Create your first project to start organizing your tasks.</p>
            <Link
              href="/app/projects/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create Project
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}