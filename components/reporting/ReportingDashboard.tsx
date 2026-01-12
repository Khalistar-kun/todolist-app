"use client"

import { useState, useEffect } from 'react'
import {
  ReportingService,
  ProjectStats,
  TeamMemberStats,
  StageDistribution,
  PriorityDistribution,
  ProjectTrend,
} from '@/lib/services/ReportingService'

interface ReportingDashboardProps {
  projectId: string
}

type DateRange = '7d' | '14d' | '30d' | '90d'

export function ReportingDashboard({ projectId }: ReportingDashboardProps) {
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([])
  const [stageDistribution, setStageDistribution] = useState<StageDistribution[]>([])
  const [priorityDistribution, setPriorityDistribution] = useState<PriorityDistribution[]>([])
  const [trend, setTrend] = useState<ProjectTrend[]>([])
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'trends'>('overview')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const days = parseInt(dateRange)
        const [projectStats, team, stages, priorities, trendData] = await Promise.all([
          ReportingService.getProjectStats(projectId),
          ReportingService.getTeamMemberStats(projectId),
          ReportingService.getStageDistribution(projectId),
          ReportingService.getPriorityDistribution(projectId),
          ReportingService.getProjectTrend(projectId, days),
        ])
        setStats(projectStats)
        setTeamStats(team)
        setStageDistribution(stages)
        setPriorityDistribution(priorities)
        setTrend(trendData)
      } catch (error) {
        console.error('Error fetching report data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId, dateRange])

  const PRIORITY_COLORS: Record<string, string> = {
    urgent: '#EF4444',
    high: '#F97316',
    medium: '#EAB308',
    low: '#3B82F6',
    none: '#9CA3AF',
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Project Reports</h2>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="14d">Last 14 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        {(['overview', 'team', 'trends'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Tasks</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_tasks}</div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed_tasks}</div>
              <div className="text-sm text-gray-500">{stats.completion_rate}% completion rate</div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Overdue</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue_tasks}</div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Avg. Completion Time</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.avg_completion_time_days !== null ? `${stats.avg_completion_time_days}d` : '-'}
              </div>
            </div>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stage Distribution */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Tasks by Stage</h3>
              <div className="space-y-3">
                {stageDistribution.map(stage => (
                  <div key={stage.stage_id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300">{stage.stage_name}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {stage.task_count} ({stage.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${stage.percentage}%`,
                          backgroundColor: stage.stage_color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Distribution */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Tasks by Priority</h3>
              <div className="space-y-3">
                {priorityDistribution.map(priority => (
                  <div key={priority.priority}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300 capitalize">{priority.priority}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {priority.task_count} ({priority.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${priority.percentage}%`,
                          backgroundColor: PRIORITY_COLORS[priority.priority],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Team Member
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Assigned
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Overdue
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Completion Rate
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Avg. Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {teamStats.map(member => (
                <tr key={member.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.user_name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {member.user_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{member.user_name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{member.user_email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                    {member.tasks_assigned}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
                    {member.tasks_completed}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">
                    {member.tasks_overdue}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${member.completion_rate}%` }}
                        />
                      </div>
                      <span className="text-gray-900 dark:text-white">{member.completion_rate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                    {member.avg_completion_time_days !== null ? `${member.avg_completion_time_days}d` : '-'}
                  </td>
                </tr>
              ))}
              {teamStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No team members assigned to tasks
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Velocity Chart */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Task Velocity</h3>
            <div className="h-64 flex items-end gap-1">
              {trend.map((day, i) => {
                const maxValue = Math.max(...trend.map(d => Math.max(d.completed, d.created)), 1)
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1" title={day.date}>
                    <div className="w-full flex gap-0.5" style={{ height: '200px' }}>
                      <div
                        className="flex-1 bg-green-500 rounded-t transition-all"
                        style={{ height: `${(day.completed / maxValue) * 100}%`, marginTop: 'auto' }}
                        title={`Completed: ${day.completed}`}
                      />
                      <div
                        className="flex-1 bg-blue-500 rounded-t transition-all"
                        style={{ height: `${(day.created / maxValue) * 100}%`, marginTop: 'auto' }}
                        title={`Created: ${day.created}`}
                      />
                    </div>
                    {i % Math.ceil(trend.length / 10) === 0 && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 transform -rotate-45 origin-left whitespace-nowrap">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Created</span>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Created</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {trend.reduce((sum, d) => sum + d.created, 0)}
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Completed</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {trend.reduce((sum, d) => sum + d.completed, 0)}
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Net Velocity</div>
              <div className={`text-2xl font-bold ${
                trend.reduce((sum, d) => sum + d.velocity, 0) >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {trend.reduce((sum, d) => sum + d.velocity, 0) >= 0 ? '+' : ''}
                {trend.reduce((sum, d) => sum + d.velocity, 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
