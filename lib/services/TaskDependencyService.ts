import { supabase, TaskDependency, Task } from '@/lib/supabase'

export interface BlockingTask {
  id: string
  title: string
  stage_id: string
  is_completed: boolean
}

export interface BlockedTask {
  id: string
  title: string
  stage_id: string
}

export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'

export class TaskDependencyService {
  /**
   * Add a dependency between two tasks
   * @param blockingTaskId The task that must be completed first
   * @param blockedTaskId The task that is waiting
   * @param dependencyType Type of dependency relationship
   * @param lagDays Optional lag in days
   */
  static async addDependency(
    blockingTaskId: string,
    blockedTaskId: string,
    dependencyType: DependencyType = 'finish_to_start',
    lagDays: number = 0,
    createdBy?: string
  ): Promise<TaskDependency> {
    // The database trigger will check for circular dependencies
    const { data, error } = await supabase
      .from('task_dependencies')
      .insert({
        blocking_task_id: blockingTaskId,
        blocked_task_id: blockedTaskId,
        dependency_type: dependencyType,
        lag_days: lagDays,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) {
      if (error.message.includes('Circular dependency')) {
        throw new Error('Cannot add dependency: This would create a circular dependency')
      }
      throw new Error(`Failed to add dependency: ${error.message}`)
    }

    return data
  }

  /**
   * Remove a dependency between tasks
   */
  static async removeDependency(blockingTaskId: string, blockedTaskId: string): Promise<void> {
    const { error } = await supabase
      .from('task_dependencies')
      .delete()
      .eq('blocking_task_id', blockingTaskId)
      .eq('blocked_task_id', blockedTaskId)

    if (error) throw new Error(`Failed to remove dependency: ${error.message}`)
  }

  /**
   * Remove a dependency by ID
   */
  static async removeDependencyById(dependencyId: string): Promise<void> {
    const { error } = await supabase
      .from('task_dependencies')
      .delete()
      .eq('id', dependencyId)

    if (error) throw new Error(`Failed to remove dependency: ${error.message}`)
  }

  /**
   * Get all tasks that are blocking a given task
   */
  static async getBlockingTasks(taskId: string): Promise<BlockingTask[]> {
    const { data, error } = await supabase
      .from('task_dependencies')
      .select(`
        blocking_task_id,
        tasks!task_dependencies_blocking_task_id_fkey (
          id,
          title,
          stage_id,
          approval_status
        )
      `)
      .eq('blocked_task_id', taskId)

    if (error) throw new Error(`Failed to fetch blocking tasks: ${error.message}`)

    return (data || []).map(d => {
      const task = (d as any).tasks
      // A task is completed if it's in a done stage and approved
      // For simplicity, we check if stage_id is 'done' or approval_status is 'approved'
      const isCompleted = task?.stage_id === 'done' && task?.approval_status === 'approved'

      return {
        id: task?.id || d.blocking_task_id,
        title: task?.title || 'Unknown',
        stage_id: task?.stage_id || '',
        is_completed: isCompleted,
      }
    })
  }

  /**
   * Get all tasks that are blocked by a given task
   */
  static async getBlockedTasks(taskId: string): Promise<BlockedTask[]> {
    const { data, error } = await supabase
      .from('task_dependencies')
      .select(`
        blocked_task_id,
        tasks!task_dependencies_blocked_task_id_fkey (
          id,
          title,
          stage_id
        )
      `)
      .eq('blocking_task_id', taskId)

    if (error) throw new Error(`Failed to fetch blocked tasks: ${error.message}`)

    return (data || []).map(d => {
      const task = (d as any).tasks
      return {
        id: task?.id || d.blocked_task_id,
        title: task?.title || 'Unknown',
        stage_id: task?.stage_id || '',
      }
    })
  }

  /**
   * Check if a task is blocked by any incomplete tasks
   */
  static async isTaskBlocked(taskId: string): Promise<boolean> {
    const blockingTasks = await this.getBlockingTasks(taskId)
    return blockingTasks.some(task => !task.is_completed)
  }

  /**
   * Get all dependencies for a task (both blocking and blocked)
   */
  static async getTaskDependencies(taskId: string): Promise<{
    blocking: BlockingTask[]
    blocked: BlockedTask[]
    isBlocked: boolean
  }> {
    const [blocking, blocked] = await Promise.all([
      this.getBlockingTasks(taskId),
      this.getBlockedTasks(taskId),
    ])

    const isBlocked = blocking.some(task => !task.is_completed)

    return { blocking, blocked, isBlocked }
  }

  /**
   * Get all dependencies for a project
   */
  static async getProjectDependencies(projectId: string): Promise<TaskDependency[]> {
    const { data, error } = await supabase
      .from('task_dependencies')
      .select(`
        *,
        blocking_task:tasks!task_dependencies_blocking_task_id_fkey (
          id,
          title,
          project_id
        ),
        blocked_task:tasks!task_dependencies_blocked_task_id_fkey (
          id,
          title,
          project_id
        )
      `)

    if (error) throw new Error(`Failed to fetch project dependencies: ${error.message}`)

    // Filter to only include dependencies where both tasks are in the project
    return (data || []).filter(d => {
      const blockingTask = (d as any).blocking_task
      const blockedTask = (d as any).blocked_task
      return blockingTask?.project_id === projectId && blockedTask?.project_id === projectId
    })
  }

  /**
   * Update dependency type or lag
   */
  static async updateDependency(
    dependencyId: string,
    updates: { dependency_type?: DependencyType; lag_days?: number }
  ): Promise<TaskDependency> {
    const { data, error } = await supabase
      .from('task_dependencies')
      .update(updates)
      .eq('id', dependencyId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update dependency: ${error.message}`)
    return data
  }

  /**
   * Get the critical path for a project
   * Returns tasks in order of dependency chain
   */
  static async getCriticalPath(projectId: string): Promise<Task[]> {
    // Get all tasks and dependencies for the project
    const [tasksResult, depsResult] = await Promise.all([
      supabase
        .from('TODOAAPP.tasks')
        .select('*')
        .eq('project_id', projectId)
        .is('parent_task_id', null),
      this.getProjectDependencies(projectId),
    ])

    if (tasksResult.error) throw new Error(`Failed to fetch tasks: ${tasksResult.error.message}`)

    const tasks = tasksResult.data || []
    const dependencies = depsResult

    // Build adjacency list
    const graph: Map<string, string[]> = new Map()
    const inDegree: Map<string, number> = new Map()

    for (const task of tasks) {
      graph.set(task.id, [])
      inDegree.set(task.id, 0)
    }

    for (const dep of dependencies) {
      const blockers = graph.get(dep.blocking_task_id) || []
      blockers.push(dep.blocked_task_id)
      graph.set(dep.blocking_task_id, blockers)

      const currentDegree = inDegree.get(dep.blocked_task_id) || 0
      inDegree.set(dep.blocked_task_id, currentDegree + 1)
    }

    // Find all tasks with no dependencies (starting points)
    const queue: string[] = []
    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId)
      }
    }

    // Topological sort to find the longest path
    const result: Task[] = []
    const visited = new Set<string>()

    while (queue.length > 0) {
      const taskId = queue.shift()!
      if (visited.has(taskId)) continue
      visited.add(taskId)

      const task = tasks.find(t => t.id === taskId)
      if (task) {
        result.push(task)
      }

      const blockedTasks = graph.get(taskId) || []
      for (const blockedId of blockedTasks) {
        const degree = (inDegree.get(blockedId) || 1) - 1
        inDegree.set(blockedId, degree)
        if (degree === 0) {
          queue.push(blockedId)
        }
      }
    }

    return result
  }

  /**
   * Check if adding a dependency would create a cycle
   * Used for client-side validation before attempting to add
   */
  static async wouldCreateCycle(
    blockingTaskId: string,
    blockedTaskId: string,
    projectId: string
  ): Promise<boolean> {
    const dependencies = await this.getProjectDependencies(projectId)

    // Build adjacency list
    const graph: Map<string, string[]> = new Map()

    for (const dep of dependencies) {
      const blockers = graph.get(dep.blocking_task_id) || []
      blockers.push(dep.blocked_task_id)
      graph.set(dep.blocking_task_id, blockers)
    }

    // Add the proposed dependency
    const existingBlockers = graph.get(blockingTaskId) || []
    existingBlockers.push(blockedTaskId)
    graph.set(blockingTaskId, existingBlockers)

    // DFS to detect cycle
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    function hasCycle(node: string): boolean {
      if (recursionStack.has(node)) return true
      if (visited.has(node)) return false

      visited.add(node)
      recursionStack.add(node)

      const neighbors = graph.get(node) || []
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true
      }

      recursionStack.delete(node)
      return false
    }

    // Check for cycle starting from the blocking task
    return hasCycle(blockingTaskId)
  }
}
