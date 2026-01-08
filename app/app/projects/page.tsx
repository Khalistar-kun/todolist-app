"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ProjectService } from '@/lib/services/ProjectService'
import type { ProjectWithMembers } from '@/lib/services/ProjectService'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'

export default function ProjectsPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ProjectWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const isInitialLoadRef = useRef(true)

  // Silent refetch for real-time updates
  const refetchProjectsSilently = useCallback(async () => {
    try {
      const userProjects = await ProjectService.getUserProjects()
      setProjects(userProjects)
    } catch (error) {
      console.error('Error refetching projects:', error)
    }
  }, [])

  // Subscribe to real-time updates
  useRealtimeSubscription({
    subscriptions: [
      { table: 'projects' },
      { table: 'project_members' },
      { table: 'tasks' },
    ],
    onChange: () => {
      if (!isInitialLoadRef.current) {
        refetchProjectsSilently()
      }
    },
    enabled: !!user,
  })

  const fetchProjects = useCallback(async () => {
    try {
      const userProjects = await ProjectService.getUserProjects()
      setProjects(userProjects)
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchProjects().then(() => {
        isInitialLoadRef.current = false
      })
    }
  }, [user, fetchProjects])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg"></div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your projects and collaborate with your team.</p>
          </div>
          <Link
            href="/app/projects/new"
            className="btn btn-md btn-primary"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Link>
        </div>

        {projects.length === 0 ? (
          // Empty state
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No projects yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Get started by creating your first project.</p>
            <Link
              href="/app/projects/new"
              className="btn btn-md btn-primary"
            >
              Create Project
            </Link>
          </div>
        ) : (
          // Projects grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/app/projects/${project.id}`}
                className="block hover:shadow-lg transition-shadow duration-200"
              >
                <div className="card overflow-hidden h-full">
                  {/* Project header */}
                  <div
                    className="h-2"
                    style={{ backgroundColor: project.color }}
                  />

                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {project.name}
                      </h3>
                      <span
                        className={`badge ${
                          project.status === 'active'
                            ? 'badge-success'
                            : 'badge-gray'
                        }`}
                      >
                        {project.status}
                      </span>
                    </div>

                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                      {project.description || 'No description provided'}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {project.tasks_count} tasks
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {project.completed_tasks_count} completed
                      </div>
                    </div>

                    {/* Members */}
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {project.members.slice(0, 3).map((member) => (
                          <div
                            key={member.id}
                            className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center overflow-hidden"
                            title={member.user.full_name || member.user.email}
                          >
                            {member.user.avatar_url ? (
                              member.user.avatar_url.startsWith('data:') ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={member.user.avatar_url}
                                  alt={member.user.full_name || member.user.email}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Image
                                  src={member.user.avatar_url}
                                  alt={member.user.full_name || member.user.email}
                                  width={32}
                                  height={32}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              )
                            ) : (
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {(member.user.full_name || member.user.email || 'U').charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                        ))}
                        {project.members.length > 3 && (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                              +{project.members.length - 3}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Updated {format(new Date(project.updated_at), 'MMM d')}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
