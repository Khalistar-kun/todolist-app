"use client"

import { useState, useEffect } from 'react'
import { WorkloadService, UserWorkload, TeamWorkloadSummary } from '@/lib/services/WorkloadService'

interface WorkloadViewProps {
  projectId: string
}

export function WorkloadView({ projectId }: WorkloadViewProps) {
  const [workloads, setWorkloads] = useState<UserWorkload[]>([])
  const [summary, setSummary] = useState<TeamWorkloadSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [workloadData, summaryData] = await Promise.all([
          WorkloadService.getProjectWorkload(projectId),
          WorkloadService.getWorkloadSummary(projectId),
        ])
        setWorkloads(workloadData)
        setSummary(summaryData)
      } catch (error) {
        console.error('Error fetching workload:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId])

  const getCapacityColor = (percentage: number) => {
    if (percentage > 100) return 'text-red-600 dark:text-red-400'
    if (percentage > 80) return 'text-orange-600 dark:text-orange-400'
    if (percentage < 50) return 'text-blue-600 dark:text-blue-400'
    return 'text-green-600 dark:text-green-400'
  }

  const getCapacityBarColor = (percentage: number) => {
    if (percentage > 100) return 'bg-red-500'
    if (percentage > 80) return 'bg-orange-500'
    if (percentage < 50) return 'bg-blue-500'
    return 'bg-green-500'
  }

  const PRIORITY_COLORS: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    none: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Team Members</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_members}</div>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Tasks This Week</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_tasks_this_week}</div>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Overloaded</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.overloaded_members}</div>
            <div className="text-xs text-gray-500">&gt;100% capacity</div>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Underutilized</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.underutilized_members}</div>
            <div className="text-xs text-gray-500">&lt;50% capacity</div>
          </div>
        </div>
      )}

      {/* Workload List */}
      <div className="space-y-3">
        {workloads.map(user => (
          <div
            key={user.user_id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* User Header */}
            <button
              onClick={() => setExpandedUser(expandedUser === user.user_id ? null : user.user_id)}
              className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
            >
              {/* Avatar */}
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.user_name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-lg font-medium text-blue-600 dark:text-blue-400">
                    {user.user_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

              {/* User Info */}
              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium text-gray-900 dark:text-white">{user.user_name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {user.tasks_this_week} tasks this week
                  {user.overdue_tasks > 0 && (
                    <span className="text-red-600 dark:text-red-400"> ({user.overdue_tasks} overdue)</span>
                  )}
                </div>
              </div>

              {/* Capacity Bar */}
              <div className="w-48 hidden md:block">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-500 dark:text-gray-400">Capacity</span>
                  <span className={getCapacityColor(user.capacity_percentage)}>
                    {user.capacity_percentage}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getCapacityBarColor(user.capacity_percentage)}`}
                    style={{ width: `${Math.min(user.capacity_percentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* Hours */}
              <div className="text-right hidden sm:block">
                <div className={`text-lg font-semibold ${getCapacityColor(user.capacity_percentage)}`}>
                  {user.estimated_hours_this_week}h
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">this week</div>
              </div>

              {/* Expand Icon */}
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedUser === user.user_id ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Expanded Task List */}
            {expandedUser === user.user_id && user.tasks.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                <div className="space-y-2">
                  {user.tasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        task.is_overdue
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-gray-50 dark:bg-gray-900/50'
                      }`}
                    >
                      {/* Priority */}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[task.priority]}`}>
                        {task.priority}
                      </span>

                      {/* Task Title */}
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${
                          task.is_overdue ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {task.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: task.project_color }}
                          />
                          {task.project_name}
                        </div>
                      </div>

                      {/* Hours */}
                      {task.estimated_hours && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {task.estimated_hours}h
                        </span>
                      )}

                      {/* Due Date */}
                      {task.due_date && (
                        <span className={`text-sm ${
                          task.is_overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {new Date(task.due_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expandedUser === user.user_id && user.tasks.length === 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 text-center text-gray-500 dark:text-gray-400">
                No active tasks assigned
              </div>
            )}
          </div>
        ))}

        {workloads.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p>No team members found</p>
          </div>
        )}
      </div>
    </div>
  )
}
