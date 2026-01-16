import { supabase } from '@/lib/supabase'

export interface ProjectStats {
  project_id: string
  project_name: string
  project_color: string
  total_tasks: number
  completed_tasks: number
  overdue_tasks: number
  pending_approval: number
  completion_rate: number
  avg_completion_time_days: number | null
}

export interface TeamMemberStats {
  user_id: string
  user_name: string
  user_email: string
  avatar_url: string | null
  tasks_assigned: number
  tasks_completed: number
  tasks_overdue: number
  completion_rate: number
  avg_completion_time_days: number | null
}

export interface DailyStats {
  date: string
  tasks_created: number
  tasks_completed: number
  tasks_overdue: number
}

export interface StageDistribution {
  stage_id: string
  stage_name: string
  stage_color: string
  task_count: number
  percentage: number
}

export interface PriorityDistribution {
  priority: string
  task_count: number
  percentage: number
}

export interface ProjectTrend {
  date: string
  completed: number
  created: number
  velocity: number // completed - created
}

export interface BurndownData {
  date: string
  remaining_tasks: number
  ideal_remaining: number
}

export interface TimeReport {
  total_hours: number
  by_project: Array<{ project_id: string; project_name: string; hours: number }>
  by_user: Array<{ user_id: string; user_name: string; hours: number }>
  by_day: Array<{ date: string; hours: number }>
}

export class ReportingService {
  /**
   * Get project statistics
   */
  static async getProjectStats(projectId: string): Promise<ProjectStats> {
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, color, workflow_stages')
      .eq('id', projectId)
      .single()

    if (!project) throw new Error('Project not found')

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, stage_id, approval_status, due_date, completed_at, created_at')
      .eq('project_id', projectId)
      .is('parent_task_id', null)

    const now = new Date()
    const workflowStages = project.workflow_stages || []
    const doneStage = workflowStages.find((s: any) =>
      s.is_done_stage || s.id === 'done' || s.name?.toLowerCase() === 'done'
    ) || workflowStages[workflowStages.length - 1]
    const doneStageId = doneStage?.id || 'done'

    const total = tasks?.length || 0
    const completed = tasks?.filter(t =>
      t.stage_id === doneStageId && t.approval_status === 'approved'
    ).length || 0
    const overdue = tasks?.filter(t =>
      t.due_date && new Date(t.due_date) < now && t.stage_id !== doneStageId
    ).length || 0
    const pendingApproval = tasks?.filter(t =>
      t.stage_id === doneStageId && t.approval_status === 'pending'
    ).length || 0

    // Calculate average completion time
    const completedTasks = tasks?.filter(t => t.completed_at && t.created_at) || []
    let avgCompletionTime: number | null = null
    if (completedTasks.length > 0) {
      const totalDays = completedTasks.reduce((sum, t) => {
        const created = new Date(t.created_at)
        const completed = new Date(t.completed_at!)
        return sum + (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      }, 0)
      avgCompletionTime = Math.round((totalDays / completedTasks.length) * 10) / 10
    }

    return {
      project_id: project.id,
      project_name: project.name,
      project_color: project.color,
      total_tasks: total,
      completed_tasks: completed,
      overdue_tasks: overdue,
      pending_approval: pendingApproval,
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avg_completion_time_days: avgCompletionTime,
    }
  }

  /**
   * Get team member statistics for a project
   */
  static async getTeamMemberStats(projectId: string): Promise<TeamMemberStats[]> {
    const { data: project } = await supabase
      .from('projects')
      .select('workflow_stages')
      .eq('id', projectId)
      .single()

    const workflowStages = project?.workflow_stages || []
    const doneStage = workflowStages.find((s: any) =>
      s.is_done_stage || s.id === 'done'
    ) || workflowStages[workflowStages.length - 1]
    const doneStageId = doneStage?.id || 'done'

    // Get all task assignments for the project
    const { data: assignments } = await supabase
      .from('task_assignments')
      .select(`
        user_id,
        task:tasks (
          id,
          stage_id,
          approval_status,
          due_date,
          completed_at,
          created_at,
          project_id
        )
      `)
      .eq('task.project_id', projectId)

    // Get member info (without JOIN to avoid issues)
    const { data: members } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)

    // Fetch profiles separately
    const memberUserIds = members?.map(m => m.user_id) || []
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', memberUserIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    const now = new Date()
    const memberMap = new Map<string, TeamMemberStats>()

    // Initialize member stats
    members?.forEach(member => {
      const profile = profileMap.get(member.user_id)
      memberMap.set(member.user_id, {
        user_id: member.user_id,
        user_name: profile?.full_name || profile?.email || 'Unknown',
        user_email: profile?.email || '',
        avatar_url: profile?.avatar_url || null,
        tasks_assigned: 0,
        tasks_completed: 0,
        tasks_overdue: 0,
        completion_rate: 0,
        avg_completion_time_days: null,
      })
    })

    // Calculate stats from assignments
    const completionTimes = new Map<string, number[]>()

    assignments?.forEach(assignment => {
      const task = (assignment as any).task
      if (!task || task.project_id !== projectId) return

      const stats = memberMap.get(assignment.user_id)
      if (!stats) return

      stats.tasks_assigned++

      if (task.stage_id === doneStageId && task.approval_status === 'approved') {
        stats.tasks_completed++
        if (task.completed_at && task.created_at) {
          const days = (new Date(task.completed_at).getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)
          if (!completionTimes.has(assignment.user_id)) {
            completionTimes.set(assignment.user_id, [])
          }
          completionTimes.get(assignment.user_id)!.push(days)
        }
      }

      if (task.due_date && new Date(task.due_date) < now && task.stage_id !== doneStageId) {
        stats.tasks_overdue++
      }
    })

    // Calculate completion rates and avg times
    memberMap.forEach((stats, userId) => {
      stats.completion_rate = stats.tasks_assigned > 0
        ? Math.round((stats.tasks_completed / stats.tasks_assigned) * 100)
        : 0

      const times = completionTimes.get(userId)
      if (times && times.length > 0) {
        stats.avg_completion_time_days = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10
      }
    })

    return Array.from(memberMap.values()).sort((a, b) => b.tasks_completed - a.tasks_completed)
  }

  /**
   * Get daily statistics for a project over a date range
   */
  static async getDailyStats(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailyStats[]> {
    const { data: project } = await supabase
      .from('projects')
      .select('workflow_stages')
      .eq('id', projectId)
      .single()

    const workflowStages = project?.workflow_stages || []
    const doneStage = workflowStages.find((s: any) => s.is_done_stage || s.id === 'done')
    const doneStageId = doneStage?.id || 'done'

    const { data: tasks } = await supabase
      .from('tasks')
      .select('created_at, completed_at, due_date, stage_id, approval_status')
      .eq('project_id', projectId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    const stats: Record<string, DailyStats> = {}

    // Initialize all dates
    const current = new Date(startDate)
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0]
      stats[dateStr] = {
        date: dateStr,
        tasks_created: 0,
        tasks_completed: 0,
        tasks_overdue: 0,
      }
      current.setDate(current.getDate() + 1)
    }

    // Count tasks
    tasks?.forEach(task => {
      const createdDate = task.created_at.split('T')[0]
      if (stats[createdDate]) {
        stats[createdDate].tasks_created++
      }

      if (task.completed_at) {
        const completedDate = task.completed_at.split('T')[0]
        if (stats[completedDate]) {
          stats[completedDate].tasks_completed++
        }
      }

      if (task.due_date && task.stage_id !== doneStageId) {
        const dueDate = task.due_date.split('T')[0]
        const now = new Date().toISOString().split('T')[0]
        if (dueDate < now && stats[dueDate]) {
          stats[dueDate].tasks_overdue++
        }
      }
    })

    return Object.values(stats).sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Get task distribution by stage
   */
  static async getStageDistribution(projectId: string): Promise<StageDistribution[]> {
    const { data: project } = await supabase
      .from('projects')
      .select('workflow_stages')
      .eq('id', projectId)
      .single()

    const { data: tasks } = await supabase
      .from('tasks')
      .select('stage_id')
      .eq('project_id', projectId)
      .is('parent_task_id', null)

    const workflowStages = project?.workflow_stages || []
    const total = tasks?.length || 0

    return workflowStages.map((stage: any) => {
      const count = tasks?.filter(t => t.stage_id === stage.id).length || 0
      return {
        stage_id: stage.id,
        stage_name: stage.name,
        stage_color: stage.color,
        task_count: count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }
    })
  }

  /**
   * Get task distribution by priority
   */
  static async getPriorityDistribution(projectId: string): Promise<PriorityDistribution[]> {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('priority')
      .eq('project_id', projectId)
      .is('parent_task_id', null)

    const total = tasks?.length || 0
    const priorities = ['urgent', 'high', 'medium', 'low', 'none']

    return priorities.map(priority => {
      const count = tasks?.filter(t => (t.priority || 'none') === priority).length || 0
      return {
        priority,
        task_count: count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }
    })
  }

  /**
   * Get project velocity trend (tasks completed vs created per day)
   */
  static async getProjectTrend(projectId: string, days: number = 30): Promise<ProjectTrend[]> {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const dailyStats = await this.getDailyStats(projectId, startDate, endDate)

    return dailyStats.map(day => ({
      date: day.date,
      completed: day.tasks_completed,
      created: day.tasks_created,
      velocity: day.tasks_completed - day.tasks_created,
    }))
  }

  /**
   * Get burndown chart data for a milestone or project
   */
  static async getBurndownData(
    projectId: string,
    startDate: Date,
    endDate: Date,
    milestoneId?: string
  ): Promise<BurndownData[]> {
    let query = supabase
      .from('tasks')
      .select('id, created_at, completed_at')
      .eq('project_id', projectId)
      .is('parent_task_id', null)
      .lte('created_at', endDate.toISOString())

    if (milestoneId) {
      query = query.eq('milestone_id', milestoneId)
    }

    const { data: tasks } = await query

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const totalTasks = tasks?.length || 0
    const idealDecrement = totalTasks / totalDays

    const burndownData: BurndownData[] = []
    const current = new Date(startDate)

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0]
      const dayIndex = Math.ceil((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

      // Count remaining tasks (not completed by this date)
      const remaining = tasks?.filter(task => {
        if (!task.completed_at) return true
        return new Date(task.completed_at) > current
      }).length || 0

      burndownData.push({
        date: dateStr,
        remaining_tasks: remaining,
        ideal_remaining: Math.max(0, Math.round(totalTasks - (dayIndex * idealDecrement))),
      })

      current.setDate(current.getDate() + 1)
    }

    return burndownData
  }

  /**
   * Get time tracking report
   */
  static async getTimeReport(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TimeReport> {
    const { data: entries } = await supabase
      .from('time_entries')
      .select(`
        id,
        user_id,
        duration_minutes,
        started_at,
        task:tasks (
          project_id
        ),
        user:profiles (
          full_name,
          email
        )
      `)
      .eq('task.project_id', projectId)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())

    const validEntries = entries?.filter(e => (e as any).task?.project_id === projectId) || []

    // Total hours
    const totalMinutes = validEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10

    // By user
    const byUser = new Map<string, { user_id: string; user_name: string; minutes: number }>()
    validEntries.forEach(entry => {
      const existing = byUser.get(entry.user_id) || {
        user_id: entry.user_id,
        user_name: (entry.user as any)?.full_name || (entry.user as any)?.email || 'Unknown',
        minutes: 0,
      }
      existing.minutes += entry.duration_minutes || 0
      byUser.set(entry.user_id, existing)
    })

    // By day
    const byDay = new Map<string, number>()
    validEntries.forEach(entry => {
      const date = entry.started_at.split('T')[0]
      byDay.set(date, (byDay.get(date) || 0) + (entry.duration_minutes || 0))
    })

    return {
      total_hours: totalHours,
      by_project: [{ project_id: projectId, project_name: '', hours: totalHours }],
      by_user: Array.from(byUser.values()).map(u => ({
        user_id: u.user_id,
        user_name: u.user_name,
        hours: Math.round((u.minutes / 60) * 10) / 10,
      })),
      by_day: Array.from(byDay.entries()).map(([date, minutes]) => ({
        date,
        hours: Math.round((minutes / 60) * 10) / 10,
      })).sort((a, b) => a.date.localeCompare(b.date)),
    }
  }

  /**
   * Get organization-wide statistics
   */
  static async getOrganizationStats(organizationId: string): Promise<{
    total_projects: number
    total_tasks: number
    completed_tasks: number
    active_members: number
    completion_rate: number
  }> {
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', organizationId)

    const projectIds = projects?.map(p => p.id) || []

    if (projectIds.length === 0) {
      return {
        total_projects: 0,
        total_tasks: 0,
        completed_tasks: 0,
        active_members: 0,
        completion_rate: 0,
      }
    }

    const { count: totalTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .in('project_id', projectIds)

    const { count: completedTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .in('project_id', projectIds)
      .eq('approval_status', 'approved')

    const { count: activeMembers } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    return {
      total_projects: projectIds.length,
      total_tasks: totalTasks || 0,
      completed_tasks: completedTasks || 0,
      active_members: activeMembers || 0,
      completion_rate: totalTasks ? Math.round(((completedTasks || 0) / totalTasks) * 100) : 0,
    }
  }
}
