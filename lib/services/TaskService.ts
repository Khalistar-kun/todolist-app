import { supabase } from '@/lib/supabase'
import type { Task, Subtask, Comment, TaskAssignment, Attachment, TimeEntry } from '@/lib/supabase'

export interface CreateTaskData {
  title: string
  description?: string
  project_id: string
  stage_id?: string
  priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  tags?: string[]
  assignees?: string[]
  custom_fields?: Record<string, any>
  color?: string | null
}

export interface UpdateTaskData {
  title?: string
  description?: string
  status?: 'todo' | 'in_progress' | 'review' | 'done' | 'archived'
  priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  stage_id?: string
  position?: number
  due_date?: string
  completed_at?: string
  tags?: string[]
  custom_fields?: Record<string, any>
  color?: string | null
}

export interface TaskWithDetails extends Task {
  project: {
    id: string
    name: string
    color: string
    workflow_stages: Array<{
      id: string
      name: string
      color: string
    }>
  }
  assignees: Array<{
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }>
  subtasks: Array<Subtask & {
    assignee?: {
      id: string
      full_name: string | null
      email: string
      avatar_url: string | null
    } | null
  }>
  comments_count: number
  attachments: Attachment[]
  time_entries: TimeEntry[]
  time_spent: number
}

export interface CreateCommentData {
  task_id: string
  project_id: string
  content: string
  mentions?: string[]
}

export class TaskService {
  // Get tasks for a project, grouped by stage
  static async getProjectTasks(projectId: string): Promise<Record<string, Task[]>> {
    const response = await fetch(`/api/tasks?project_id=${projectId}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch tasks')
    }

    const tasks = data.tasks || []

    // Group tasks by stage_id
    const groupedTasks: Record<string, Task[]> = {}
    tasks.forEach((task: Task) => {
      if (!groupedTasks[task.stage_id]) {
        groupedTasks[task.stage_id] = []
      }
      groupedTasks[task.stage_id].push(task)
    })

    return groupedTasks
  }

  // Get a single task with all details
  static async getTask(taskId: string): Promise<TaskWithDetails | null> {
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        *,
        project:projects(id, name, color, workflow_stages)
      `)
      .eq('id', taskId)
      .single()

    if (taskError) {
      if (taskError.code === 'PGRST116') return null
      throw taskError
    }

    // Get assignees
    const { data: assignees } = await supabase
      .from('task_assignments')
      .select(`
        user_id,
        user:profiles(id, full_name, email, avatar_url)
      `)
      .eq('task_id', taskId)

    // Get subtasks with assignee info
    const { data: subtasks } = await supabase
      .from('subtasks')
      .select(`
        *,
        assignee:profiles!subtasks_assigned_to_fkey(id, full_name, email, avatar_url)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    // Get attachments
    const { data: attachments } = await supabase
      .from('attachments')
      .select('*')
      .eq('task_id', taskId)

    // Get time entries
    const { data: timeEntries } = await supabase
      .from('time_entries')
      .select('*')
      .eq('task_id', taskId)

    // Get comments count
    const { count: commentsCount } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId)

    // Calculate total time spent
    const timeSpent = timeEntries?.reduce((total, entry) => total + entry.duration, 0) || 0

    return {
      ...task,
      assignees: assignees?.map(a => a.user) || [],
      subtasks: subtasks || [],
      comments_count: commentsCount || 0,
      attachments: attachments || [],
      time_entries: timeEntries || [],
      time_spent: timeSpent,
    } as TaskWithDetails
  }

  // Create a new task
  static async createTask(data: CreateTaskData): Promise<Task> {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create task')
    }

    return result.task
  }

  // Update a task
  static async updateTask(taskId: string, data: UpdateTaskData): Promise<Task> {
    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, ...data }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update task')
    }

    return result.task
  }

  // Delete a task
  static async deleteTask(taskId: string): Promise<void> {
    const response = await fetch(`/api/tasks?id=${taskId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error || 'Failed to delete task')
    }
  }

  // Move task to different stage/position
  static async moveTask(
    taskId: string,
    newStageId: string,
    _newPosition: number
  ): Promise<void> {
    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, stage_id: newStageId }),
    })

    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error || 'Failed to move task')
    }
  }

  // Reorder tasks within a stage
  static async reorderTasks(
    projectId: string,
    stageId: string,
    taskIds: string[]
  ): Promise<void> {
    // Update all tasks in the stage with new positions
    const updates = taskIds.map((taskId, index) =>
      supabase
        .from('tasks')
        .update({ position: index })
        .eq('id', taskId)
        .eq('project_id', projectId)
        .eq('stage_id', stageId)
    )

    await Promise.all(updates)
  }

  // Assign users to a task
  static async assignTask(taskId: string, userIds: string[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Remove existing assignments
    await supabase
      .from('task_assignments')
      .delete()
      .eq('task_id', taskId)

    // Add new assignments
    if (userIds.length > 0) {
      await Promise.all(
        userIds.map(userId =>
          supabase
            .from('task_assignments')
            .insert({
              task_id: taskId,
              user_id: userId,
              assigned_by: user.id,
            })
        )
      )
    }
  }

  // Create subtask
  static async createSubtask(taskId: string, title: string): Promise<Subtask> {
    const { data, error } = await supabase
      .from('subtasks')
      .insert({
        task_id: taskId,
        title,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Update subtask
  static async updateSubtask(subtaskId: string, updates: Partial<Subtask>): Promise<Subtask> {
    const { data, error } = await supabase
      .from('subtasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subtaskId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Delete subtask
  static async deleteSubtask(subtaskId: string): Promise<void> {
    const { error } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', subtaskId)

    if (error) throw error
  }

  // Add comment to task
  static async addComment(data: CreateCommentData): Promise<Comment> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        ...data,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error
    return comment
  }

  // Get comments for a task
  static async getTaskComments(taskId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:profiles(id, full_name, email, avatar_url)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  }

  // Add time entry
  static async addTimeEntry(
    taskId: string,
    duration: number,
    description?: string
  ): Promise<TimeEntry> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        task_id: taskId,
        user_id: user.id,
        duration,
        description,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Search tasks
  static async searchTasks(
    projectId: string,
    query: string,
    filters?: {
      assignee_id?: string
      status?: string
      priority?: string
      tags?: string[]
    }
  ): Promise<Task[]> {
    let dbQuery = supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'archived')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)

    // Apply filters
    if (filters?.assignee_id) {
      // First get the task IDs assigned to this user
      const { data: assignments } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('user_id', filters.assignee_id)

      const taskIds = assignments?.map(a => a.task_id) || []
      if (taskIds.length > 0) {
        dbQuery = dbQuery.in('id', taskIds)
      } else {
        return [] // No tasks assigned to this user
      }
    }

    if (filters?.status) {
      dbQuery = dbQuery.eq('status', filters.status)
    }

    if (filters?.priority) {
      dbQuery = dbQuery.eq('priority', filters.priority)
    }

    if (filters?.tags && filters.tags.length > 0) {
      dbQuery = dbQuery.contains('tags', filters.tags)
    }

    const { data, error } = await dbQuery.order('updated_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}