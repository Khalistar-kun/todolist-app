import { supabase } from '@/lib/supabase'

export interface TaskSuggestion {
  id: string
  type: 'overdue_reminder' | 'workload_balance' | 'dependency_blocker' | 'similar_task' | 'priority_adjustment' | 'deadline_warning'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  task_id?: string
  task_title?: string
  user_id?: string
  user_name?: string
  action?: {
    label: string
    type: 'navigate' | 'reassign' | 'update_priority' | 'set_due_date'
    payload: Record<string, any>
  }
}

export interface TaskPrediction {
  estimated_completion_days: number
  confidence: number // 0-1
  factors: string[]
}

export interface WorkloadRecommendation {
  user_id: string
  user_name: string
  current_load: number
  recommended_action: 'assign_more' | 'reassign_tasks' | 'no_action'
  suggested_tasks?: string[]
}

export class AITaskService {
  /**
   * Get smart suggestions for a project
   */
  static async getProjectSuggestions(projectId: string): Promise<TaskSuggestion[]> {
    const suggestions: TaskSuggestion[] = []
    const now = new Date()

    // Get project with workflow stages
    const { data: project } = await supabase
      .from('projects')
      .select('workflow_stages')
      .eq('id', projectId)
      .single()

    const doneStageId = project?.workflow_stages?.find((s: any) =>
      s.is_done_stage || s.id === 'done'
    )?.id || 'done'

    // Fetch all relevant data in parallel
    const [tasksResult, assignmentsResult, dependenciesResult] = await Promise.all([
      supabase
        .from('tasks')
        .select(`
          id,
          title,
          priority,
          stage_id,
          due_date,
          start_date,
          estimated_hours,
          created_at,
          created_by
        `)
        .eq('project_id', projectId)
        .neq('stage_id', doneStageId),

      supabase
        .from('task_assignments')
        .select(`
          task_id,
          user_id,
          user:profiles (full_name, email)
        `),

      supabase
        .from('task_dependencies')
        .select('*'),
    ])

    const tasks = tasksResult.data || []
    const assignments = assignmentsResult.data || []
    const dependencies = dependenciesResult.data || []

    // 1. Overdue task reminders
    const overdueTasks = tasks.filter(task =>
      task.due_date && new Date(task.due_date) < now
    )

    for (const task of overdueTasks.slice(0, 3)) {
      const daysOverdue = Math.ceil((now.getTime() - new Date(task.due_date!).getTime()) / (1000 * 60 * 60 * 24))
      const assignment = assignments.find(a => a.task_id === task.id)
      const user = assignment?.user as any

      suggestions.push({
        id: `overdue-${task.id}`,
        type: 'overdue_reminder',
        severity: daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'warning' : 'info',
        title: 'Overdue Task',
        description: `"${task.title}" is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue${user ? ` (assigned to ${user.full_name || user.email})` : ''}`,
        task_id: task.id,
        task_title: task.title,
        user_id: assignment?.user_id,
        user_name: user?.full_name || user?.email,
        action: {
          label: 'View Task',
          type: 'navigate',
          payload: { task_id: task.id },
        },
      })
    }

    // 2. Workload imbalance detection
    const userTaskCounts = new Map<string, { name: string; count: number }>()
    for (const assignment of assignments) {
      const task = tasks.find(t => t.id === assignment.task_id)
      if (!task) continue

      const user = assignment.user as any
      const existing = userTaskCounts.get(assignment.user_id) || {
        name: user?.full_name || user?.email || 'Unknown',
        count: 0,
      }
      existing.count++
      userTaskCounts.set(assignment.user_id, existing)
    }

    if (userTaskCounts.size > 1) {
      const counts = Array.from(userTaskCounts.entries())
      const maxCount = Math.max(...counts.map(c => c[1].count))
      const minCount = Math.min(...counts.map(c => c[1].count))

      if (maxCount > minCount * 2 && maxCount > 5) {
        const overloaded = counts.find(c => c[1].count === maxCount)
        const underloaded = counts.find(c => c[1].count === minCount)

        if (overloaded && underloaded) {
          suggestions.push({
            id: 'workload-imbalance',
            type: 'workload_balance',
            severity: 'warning',
            title: 'Workload Imbalance Detected',
            description: `${overloaded[1].name} has ${overloaded[1].count} tasks while ${underloaded[1].name} has only ${underloaded[1].count}. Consider redistributing.`,
            user_id: overloaded[0],
            user_name: overloaded[1].name,
            action: {
              label: 'View Workload',
              type: 'navigate',
              payload: { view: 'workload' },
            },
          })
        }
      }
    }

    // 3. Blocked tasks (dependency blockers)
    const blockedTaskIds = new Set(
      dependencies
        .filter(d => !d.is_completed)
        .map(d => d.dependent_task_id)
    )

    for (const taskId of Array.from(blockedTaskIds).slice(0, 2)) {
      const task = tasks.find(t => t.id === taskId)
      if (!task) continue

      const blockingDeps = dependencies.filter(d =>
        d.dependent_task_id === taskId && !d.is_completed
      )

      suggestions.push({
        id: `blocked-${taskId}`,
        type: 'dependency_blocker',
        severity: 'warning',
        title: 'Blocked Task',
        description: `"${task.title}" is blocked by ${blockingDeps.length} incomplete task${blockingDeps.length > 1 ? 's' : ''}`,
        task_id: task.id,
        task_title: task.title,
        action: {
          label: 'View Dependencies',
          type: 'navigate',
          payload: { task_id: task.id, tab: 'dependencies' },
        },
      })
    }

    // 4. Tasks without due dates approaching important deadlines
    const tasksWithoutDates = tasks.filter(t => !t.due_date && t.priority !== 'none')
    if (tasksWithoutDates.length > 0) {
      const urgentCount = tasksWithoutDates.filter(t => t.priority === 'urgent' || t.priority === 'high').length

      if (urgentCount > 0) {
        suggestions.push({
          id: 'no-due-dates',
          type: 'deadline_warning',
          severity: urgentCount > 2 ? 'warning' : 'info',
          title: 'High Priority Tasks Without Deadlines',
          description: `${urgentCount} high-priority task${urgentCount > 1 ? 's need' : ' needs'} due dates assigned`,
          action: {
            label: 'View Tasks',
            type: 'navigate',
            payload: { filter: 'no_due_date' },
          },
        })
      }
    }

    // 5. Priority adjustments based on approaching deadlines
    const upcomingTasks = tasks.filter(task => {
      if (!task.due_date || task.priority === 'urgent' || task.priority === 'high') return false
      const daysUntilDue = Math.ceil((new Date(task.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntilDue <= 2 && daysUntilDue >= 0
    })

    for (const task of upcomingTasks.slice(0, 2)) {
      const daysUntilDue = Math.ceil((new Date(task.due_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      suggestions.push({
        id: `priority-${task.id}`,
        type: 'priority_adjustment',
        severity: 'info',
        title: 'Consider Priority Increase',
        description: `"${task.title}" is due ${daysUntilDue === 0 ? 'today' : `in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}`} but has ${task.priority} priority`,
        task_id: task.id,
        task_title: task.title,
        action: {
          label: 'Increase Priority',
          type: 'update_priority',
          payload: { task_id: task.id, new_priority: 'high' },
        },
      })
    }

    return suggestions.slice(0, 10) // Limit to 10 suggestions
  }

  /**
   * Predict task completion time based on historical data
   */
  static async predictTaskCompletion(
    projectId: string,
    taskId: string
  ): Promise<TaskPrediction> {
    // Get historical completed tasks for comparison
    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('created_at, completed_at, priority, estimated_hours')
      .eq('project_id', projectId)
      .not('completed_at', 'is', null)
      .limit(100)

    const { data: task } = await supabase
      .from('tasks')
      .select('priority, estimated_hours, created_at')
      .eq('id', taskId)
      .single()

    if (!task || !completedTasks || completedTasks.length === 0) {
      return {
        estimated_completion_days: 3,
        confidence: 0.3,
        factors: ['Insufficient historical data for accurate prediction'],
      }
    }

    // Calculate average completion time
    const completionTimes = completedTasks.map(t => {
      const created = new Date(t.created_at)
      const completed = new Date(t.completed_at!)
      return (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    })

    const avgCompletionTime = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length

    // Adjust based on priority
    const priorityMultipliers: Record<string, number> = {
      urgent: 0.5,
      high: 0.75,
      medium: 1,
      low: 1.25,
      none: 1.5,
    }

    const priorityMultiplier = priorityMultipliers[task.priority || 'none']
    const estimatedDays = Math.round(avgCompletionTime * priorityMultiplier)

    // Calculate confidence based on data quality
    const confidence = Math.min(0.9, 0.3 + (completedTasks.length / 100) * 0.6)

    const factors: string[] = []
    factors.push(`Based on ${completedTasks.length} completed tasks`)
    factors.push(`Average completion time: ${Math.round(avgCompletionTime)} days`)
    factors.push(`Priority adjustment: ${task.priority || 'none'}`)

    if (task.estimated_hours) {
      factors.push(`Estimated effort: ${task.estimated_hours} hours`)
    }

    return {
      estimated_completion_days: Math.max(1, estimatedDays),
      confidence,
      factors,
    }
  }

  /**
   * Get workload recommendations for optimal task distribution
   */
  static async getWorkloadRecommendations(projectId: string): Promise<WorkloadRecommendation[]> {
    const { data: members } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)

    if (!members || members.length === 0) {
      return []
    }

    // Fetch profiles separately
    const memberUserIds = members.map(m => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', memberUserIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    const { data: assignments } = await supabase
      .from('task_assignments')
      .select(`
        user_id,
        task:tasks (id, project_id, stage_id, estimated_hours)
      `)

    const { data: project } = await supabase
      .from('projects')
      .select('workflow_stages')
      .eq('id', projectId)
      .single()

    const doneStageId = project?.workflow_stages?.find((s: any) =>
      s.is_done_stage || s.id === 'done'
    )?.id || 'done'

    const recommendations: WorkloadRecommendation[] = []
    const targetLoad = 40 // hours per week

    for (const member of members || []) {
      const profile = profileMap.get(member.user_id)
      const userAssignments = assignments?.filter(a =>
        a.user_id === member.user_id &&
        (a.task as any)?.project_id === projectId &&
        (a.task as any)?.stage_id !== doneStageId
      ) || []

      const currentHours = userAssignments.reduce((sum, a) =>
        sum + ((a.task as any)?.estimated_hours || 4), 0
      )

      const loadPercentage = Math.round((currentHours / targetLoad) * 100)

      let action: 'assign_more' | 'reassign_tasks' | 'no_action' = 'no_action'
      if (loadPercentage < 50) {
        action = 'assign_more'
      } else if (loadPercentage > 120) {
        action = 'reassign_tasks'
      }

      recommendations.push({
        user_id: member.user_id,
        user_name: profile?.full_name || profile?.email || 'Unknown',
        current_load: loadPercentage,
        recommended_action: action,
      })
    }

    return recommendations.sort((a, b) => {
      // Sort by action priority
      const actionPriority = { reassign_tasks: 0, assign_more: 1, no_action: 2 }
      return actionPriority[a.recommended_action] - actionPriority[b.recommended_action]
    })
  }

  /**
   * Find similar tasks for deduplication or reference
   */
  static async findSimilarTasks(
    projectId: string,
    title: string,
    limit: number = 5
  ): Promise<Array<{ id: string; title: string; similarity: number }>> {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('project_id', projectId)
      .limit(200)

    if (!tasks) return []

    // Simple word-based similarity
    const titleWords = new Set(title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2))

    const similarities = tasks
      .filter(t => t.title !== title)
      .map(task => {
        const taskWords = new Set(task.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2))
        const intersection = new Set([...titleWords].filter(x => taskWords.has(x)))
        const union = new Set([...titleWords, ...taskWords])
        const similarity = intersection.size / union.size

        return {
          id: task.id,
          title: task.title,
          similarity: Math.round(similarity * 100) / 100,
        }
      })
      .filter(t => t.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    return similarities
  }
}
