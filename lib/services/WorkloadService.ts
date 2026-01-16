import { supabase } from '@/lib/supabase'

export interface UserWorkload {
  user_id: string
  user_name: string
  user_email: string
  avatar_url: string | null
  tasks_this_week: number
  tasks_next_week: number
  overdue_tasks: number
  estimated_hours_this_week: number
  estimated_hours_next_week: number
  capacity_percentage: number // based on 40 hours/week standard
  tasks: WorkloadTask[]
}

export interface WorkloadTask {
  id: string
  title: string
  project_id: string
  project_name: string
  project_color: string
  due_date: string | null
  start_date: string | null
  estimated_hours: number | null
  priority: string
  is_overdue: boolean
}

export interface TeamWorkloadSummary {
  total_members: number
  overloaded_members: number // capacity > 100%
  underutilized_members: number // capacity < 50%
  total_tasks_this_week: number
  total_hours_this_week: number
}

export class WorkloadService {
  /**
   * Get workload for all team members in a project
   */
  static async getProjectWorkload(projectId: string): Promise<UserWorkload[]> {
    const now = new Date()
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay())) // End of this week (Sunday)
    const nextWeekEnd = new Date(weekEnd)
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)

    // Get project members (without JOIN to avoid issues)
    const { data: members } = await supabase
      .from('TODOAAPP.project_members')
      .select('user_id')
      .eq('project_id', projectId)

    if (!members || members.length === 0) {
      return []
    }

    // Get profiles for all members separately
    const memberUserIds = members.map(m => m.user_id)
    const { data: profiles } = await supabase
      .from('TODOAAPP.profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', memberUserIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    // Get task assignments with task details
    // First get all assignments for project members
    const { data: assignments } = await supabase
      .from('TODOAAPP.task_assignments')
      .select('user_id, task_id')
      .in('user_id', memberUserIds)

    // Get all tasks that are assigned
    const taskIds = [...new Set(assignments?.map(a => a.task_id) || [])]
    const { data: assignedTasks } = taskIds.length > 0 ? await supabase
      .from('TODOAAPP.tasks')
      .select('id, title, project_id, due_date, start_date, estimated_hours, priority, stage_id')
      .in('id', taskIds) : { data: [] }

    const taskMap = new Map(assignedTasks?.map(t => [t.id, t]) || [])

    // Get project info for filtering
    const { data: project } = await supabase
      .from('TODOAAPP.projects')
      .select('workflow_stages')
      .eq('id', projectId)
      .single()

    const doneStageId = project?.workflow_stages?.find((s: any) =>
      s.is_done_stage || s.id === 'done'
    )?.id || 'done'

    // Get all projects for names/colors
    const { data: projects } = await supabase
      .from('TODOAAPP.projects')
      .select('id, name, color')

    const projectMap = new Map(projects?.map(p => [p.id, p]) || [])

    const workloads: UserWorkload[] = []

    for (const member of members || []) {
      const profile = profileMap.get(member.user_id)
      const userAssignments = assignments?.filter(a =>
        a.user_id === member.user_id
      ) || []

      const tasks: WorkloadTask[] = []
      let tasksThisWeek = 0
      let tasksNextWeek = 0
      let overdueTasks = 0
      let hoursThisWeek = 0
      let hoursNextWeek = 0

      for (const assignment of userAssignments) {
        const task = taskMap.get(assignment.task_id)
        if (!task || task.stage_id === doneStageId) continue

        const projectInfo = projectMap.get(task.project_id)
        const dueDate = task.due_date ? new Date(task.due_date) : null
        const isOverdue = dueDate ? dueDate < now : false

        tasks.push({
          id: task.id,
          title: task.title,
          project_id: task.project_id,
          project_name: projectInfo?.name || 'Unknown',
          project_color: projectInfo?.color || '#6B7280',
          due_date: task.due_date,
          start_date: task.start_date,
          estimated_hours: task.estimated_hours,
          priority: task.priority || 'none',
          is_overdue: isOverdue,
        })

        if (isOverdue) {
          overdueTasks++
        }

        if (dueDate) {
          if (dueDate <= weekEnd) {
            tasksThisWeek++
            hoursThisWeek += task.estimated_hours || 4 // Default 4 hours if not estimated
          } else if (dueDate <= nextWeekEnd) {
            tasksNextWeek++
            hoursNextWeek += task.estimated_hours || 4
          }
        }
      }

      // Calculate capacity (40 hours/week = 100%)
      const capacityPercentage = Math.round((hoursThisWeek / 40) * 100)

      workloads.push({
        user_id: member.user_id,
        user_name: profile?.full_name || profile?.email || 'Unknown',
        user_email: profile?.email || '',
        avatar_url: profile?.avatar_url || null,
        tasks_this_week: tasksThisWeek,
        tasks_next_week: tasksNextWeek,
        overdue_tasks: overdueTasks,
        estimated_hours_this_week: hoursThisWeek,
        estimated_hours_next_week: hoursNextWeek,
        capacity_percentage: capacityPercentage,
        tasks: tasks.sort((a, b) => {
          // Sort by overdue first, then by due date
          if (a.is_overdue && !b.is_overdue) return -1
          if (!a.is_overdue && b.is_overdue) return 1
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        }),
      })
    }

    return workloads.sort((a, b) => b.capacity_percentage - a.capacity_percentage)
  }

  /**
   * Get workload summary for a project
   */
  static async getWorkloadSummary(projectId: string): Promise<TeamWorkloadSummary> {
    const workloads = await this.getProjectWorkload(projectId)

    return {
      total_members: workloads.length,
      overloaded_members: workloads.filter(w => w.capacity_percentage > 100).length,
      underutilized_members: workloads.filter(w => w.capacity_percentage < 50).length,
      total_tasks_this_week: workloads.reduce((sum, w) => sum + w.tasks_this_week, 0),
      total_hours_this_week: workloads.reduce((sum, w) => sum + w.estimated_hours_this_week, 0),
    }
  }

  /**
   * Get user workload across all projects
   */
  static async getUserWorkloadAcrossProjects(userId: string): Promise<{
    total_tasks: number
    tasks_by_project: Array<{ project_id: string; project_name: string; task_count: number }>
    weekly_hours: number
    capacity_percentage: number
  }> {
    // Get user's task assignments
    const { data: assignments } = await supabase
      .from('TODOAAPP.task_assignments')
      .select('task_id')
      .eq('user_id', userId)

    if (!assignments || assignments.length === 0) {
      return {
        total_tasks: 0,
        tasks_by_project: [],
        weekly_hours: 0,
        capacity_percentage: 0,
      }
    }

    // Get the tasks
    const taskIds = assignments.map(a => a.task_id)
    const { data: tasks } = await supabase
      .from('TODOAAPP.tasks')
      .select('id, project_id, stage_id, due_date, estimated_hours')
      .in('id', taskIds)

    // Get all projects for those tasks
    const projectIds = [...new Set(tasks?.map(t => t.project_id) || [])]
    const { data: projects } = projectIds.length > 0 ? await supabase
      .from('TODOAAPP.projects')
      .select('id, name, workflow_stages')
      .in('id', projectIds) : { data: [] }

    const projectMap = new Map(projects?.map(p => [p.id, p]) || [])

    const now = new Date()
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()))

    const projectCounts = new Map<string, { name: string; count: number }>()
    let totalTasks = 0
    let weeklyHours = 0

    for (const task of tasks || []) {
      const project = projectMap.get(task.project_id)
      const doneStageId = project?.workflow_stages?.find((s: any) =>
        s.is_done_stage || s.id === 'done'
      )?.id || 'done'

      if (task.stage_id === doneStageId) continue

      totalTasks++

      const existing = projectCounts.get(task.project_id)
      if (existing) {
        existing.count++
      } else {
        projectCounts.set(task.project_id, {
          name: project?.name || 'Unknown',
          count: 1,
        })
      }

      const dueDate = task.due_date ? new Date(task.due_date) : null
      if (dueDate && dueDate <= weekEnd) {
        weeklyHours += task.estimated_hours || 4
      }
    }

    return {
      total_tasks: totalTasks,
      tasks_by_project: Array.from(projectCounts.entries()).map(([id, data]) => ({
        project_id: id,
        project_name: data.name,
        task_count: data.count,
      })),
      weekly_hours: weeklyHours,
      capacity_percentage: Math.round((weeklyHours / 40) * 100),
    }
  }

  /**
   * Find team members with available capacity
   */
  static async findAvailableMembers(
    projectId: string,
    requiredHours: number
  ): Promise<Array<{ user_id: string; user_name: string; available_hours: number }>> {
    const workloads = await this.getProjectWorkload(projectId)

    return workloads
      .filter(w => w.estimated_hours_this_week < 40)
      .map(w => ({
        user_id: w.user_id,
        user_name: w.user_name,
        available_hours: 40 - w.estimated_hours_this_week,
      }))
      .filter(m => m.available_hours >= requiredHours)
      .sort((a, b) => b.available_hours - a.available_hours)
  }
}
