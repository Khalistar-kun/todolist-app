import { supabase, Task, Project } from '@/lib/supabase'

export interface MyTask extends Task {
  project: Pick<Project, 'id' | 'name' | 'color'>
}

export interface MyTasksFilters {
  status?: 'all' | 'active' | 'completed' | 'overdue'
  projectId?: string
  priority?: string
  dueDateRange?: 'today' | 'this_week' | 'this_month' | 'no_date'
}

export class MyTasksService {
  /**
   * Get all tasks assigned to a user across all projects
   */
  static async getMyTasks(userId: string, filters?: MyTasksFilters): Promise<MyTask[]> {
    // First, get all task assignments for this user
    const { data: assignments, error: assignError } = await supabase
      .from('TODOAAPP.task_assignments')
      .select('task_id')
      .eq('user_id', userId)

    if (assignError) throw new Error(`Failed to fetch task assignments: ${assignError.message}`)

    if (!assignments || assignments.length === 0) {
      return []
    }

    const taskIds = assignments.map(a => a.task_id)

    // Now fetch the tasks with project info
    let query = supabase
      .from('TODOAAPP.tasks')
      .select(`
        *,
        projects!inner (
          id,
          name,
          color,
          workflow_stages
        )
      `)
      .in('id', taskIds)
      .is('parent_task_id', null) // Only top-level tasks

    // Apply filters
    if (filters?.projectId) {
      query = query.eq('project_id', filters.projectId)
    }

    if (filters?.priority && filters.priority !== 'all') {
      query = query.eq('priority', filters.priority)
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const monthEnd = new Date(now)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    if (filters?.dueDateRange) {
      switch (filters.dueDateRange) {
        case 'today':
          query = query.eq('due_date', today)
          break
        case 'this_week':
          query = query.gte('due_date', today).lte('due_date', weekEnd.toISOString().split('T')[0])
          break
        case 'this_month':
          query = query.gte('due_date', today).lte('due_date', monthEnd.toISOString().split('T')[0])
          break
        case 'no_date':
          query = query.is('due_date', null)
          break
      }
    }

    const { data: tasks, error } = await query.order('due_date', { ascending: true, nullsFirst: false })

    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`)

    // Filter by status
    let filteredTasks = tasks || []

    if (filters?.status && filters.status !== 'all') {
      filteredTasks = filteredTasks.filter(task => {
        const project = (task as any).projects
        const workflowStages = project?.workflow_stages || []
        const doneStage = workflowStages.find((s: any) =>
          s.is_done_stage || s.id === 'done' || s.name?.toLowerCase() === 'done'
        ) || workflowStages[workflowStages.length - 1]
        const doneStageId = doneStage?.id || 'done'

        const isCompleted = task.stage_id === doneStageId && task.approval_status === 'approved'
        const isOverdue = task.due_date && new Date(task.due_date) < now && !isCompleted

        switch (filters.status) {
          case 'active':
            return !isCompleted
          case 'completed':
            return isCompleted
          case 'overdue':
            return isOverdue
          default:
            return true
        }
      })
    }

    return filteredTasks.map(task => ({
      ...task,
      project: {
        id: (task as any).projects.id,
        name: (task as any).projects.name,
        color: (task as any).projects.color,
      },
    }))
  }

  /**
   * Get count of tasks by status
   */
  static async getMyTasksCounts(userId: string): Promise<{
    total: number
    active: number
    completed: number
    overdue: number
    due_today: number
    due_this_week: number
  }> {
    const allTasks = await this.getMyTasks(userId)

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    let active = 0
    let completed = 0
    let overdue = 0
    let dueToday = 0
    let dueThisWeek = 0

    for (const task of allTasks) {
      const isCompleted = task.stage_id === 'done' && task.approval_status === 'approved'

      if (isCompleted) {
        completed++
      } else {
        active++
        if (task.due_date) {
          const dueDate = task.due_date.split('T')[0]
          if (dueDate < today) {
            overdue++
          } else if (dueDate === today) {
            dueToday++
          } else if (dueDate <= weekEndStr) {
            dueThisWeek++
          }
        }
      }
    }

    return {
      total: allTasks.length,
      active,
      completed,
      overdue,
      due_today: dueToday,
      due_this_week: dueThisWeek,
    }
  }

  /**
   * Get tasks grouped by project
   */
  static async getMyTasksByProject(userId: string): Promise<Record<string, { project: Pick<Project, 'id' | 'name' | 'color'>; tasks: MyTask[] }>> {
    const tasks = await this.getMyTasks(userId, { status: 'active' })

    const grouped: Record<string, { project: Pick<Project, 'id' | 'name' | 'color'>; tasks: MyTask[] }> = {}

    for (const task of tasks) {
      if (!grouped[task.project_id]) {
        grouped[task.project_id] = {
          project: task.project,
          tasks: [],
        }
      }
      grouped[task.project_id].tasks.push(task)
    }

    return grouped
  }

  /**
   * Get tasks grouped by due date
   */
  static async getMyTasksByDueDate(userId: string): Promise<{
    overdue: MyTask[]
    today: MyTask[]
    tomorrow: MyTask[]
    this_week: MyTask[]
    later: MyTask[]
    no_date: MyTask[]
  }> {
    const tasks = await this.getMyTasks(userId, { status: 'active' })

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    const result = {
      overdue: [] as MyTask[],
      today: [] as MyTask[],
      tomorrow: [] as MyTask[],
      this_week: [] as MyTask[],
      later: [] as MyTask[],
      no_date: [] as MyTask[],
    }

    for (const task of tasks) {
      if (!task.due_date) {
        result.no_date.push(task)
      } else {
        const dueDate = task.due_date.split('T')[0]
        if (dueDate < today) {
          result.overdue.push(task)
        } else if (dueDate === today) {
          result.today.push(task)
        } else if (dueDate === tomorrowStr) {
          result.tomorrow.push(task)
        } else if (dueDate <= weekEndStr) {
          result.this_week.push(task)
        } else {
          result.later.push(task)
        }
      }
    }

    return result
  }
}
