"use client"

import { useState, useEffect } from 'react'
import { PortfolioService } from '@/lib/services/PortfolioService'
import type { PortfolioWithProjects, ProjectWithDetails } from '@/lib/supabase'
import Link from 'next/link'

interface PortfolioDashboardProps {
  portfolio: PortfolioWithProjects
  onRefresh?: () => void
}

export function PortfolioDashboard({
  portfolio,
  onRefresh,
}: PortfolioDashboardProps) {
  const [stats, setStats] = useState({
    total_projects: 0,
    total_tasks: 0,
    completed_tasks: 0,
    overdue_tasks: 0,
    completion_rate: 0,
  })

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await PortfolioService.getPortfolioStats(portfolio.id)
        setStats(data)
      } catch (error) {
        console.error('Error fetching portfolio stats:', error)
      }
    }

    fetchStats()
  }, [portfolio.id])

  // Calculate project health
  const getProjectHealth = (project: ProjectWithDetails & { display_order: number }) => {
    const completionRate = project.tasks_count > 0
      ? (project.completed_tasks_count / project.tasks_count) * 100
      : 0

    if (project.overdue_tasks_count && project.overdue_tasks_count > 0) {
      return { status: 'at_risk', label: 'At Risk', color: 'text-red-600 bg-red-50 dark:bg-red-900/30' }
    }
    if (completionRate >= 80) {
      return { status: 'on_track', label: 'On Track', color: 'text-green-600 bg-green-50 dark:bg-green-900/30' }
    }
    if (completionRate >= 50) {
      return { status: 'in_progress', label: 'In Progress', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' }
    }
    return { status: 'just_started', label: 'Just Started', color: 'text-gray-600 bg-gray-50 dark:bg-gray-800' }
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: portfolio.color }}
          >
            {portfolio.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {portfolio.name}
            </h1>
            {portfolio.description && (
              <p className="text-gray-500 dark:text-gray-400">{portfolio.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Projects</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {stats.total_projects}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Tasks</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {stats.total_tasks}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {stats.completed_tasks}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Overdue</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {stats.overdue_tasks}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Completion</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {stats.completion_rate}%
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Portfolio Progress</span>
          <span className="text-sm text-gray-500">{stats.completion_rate}%</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${stats.completion_rate}%` }}
          />
        </div>
      </div>

      {/* Projects List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Projects ({portfolio.projects.length})
        </h2>

        <div className="space-y-3">
          {portfolio.projects.map(project => {
            const health = getProjectHealth(project)
            const completionRate = project.tasks_count > 0
              ? Math.round((project.completed_tasks_count / project.tasks_count) * 100)
              : 0

            return (
              <Link
                key={project.id}
                href={`/app/projects/${project.id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {project.name}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${health.color}`}>
                          {health.label}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0 text-sm">
                    <div className="text-center">
                      <div className="text-gray-500 dark:text-gray-400">Tasks</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {project.completed_tasks_count}/{project.tasks_count}
                      </div>
                    </div>

                    {project.overdue_tasks_count !== undefined && project.overdue_tasks_count > 0 && (
                      <div className="text-center">
                        <div className="text-gray-500 dark:text-gray-400">Overdue</div>
                        <div className="font-medium text-red-600 dark:text-red-400">
                          {project.overdue_tasks_count}
                        </div>
                      </div>
                    )}

                    <div className="w-24">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Progress</span>
                        <span>{completionRate}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            completionRate === 100 ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}

          {portfolio.projects.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No projects in this portfolio yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
