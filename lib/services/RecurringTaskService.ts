import { supabase } from '@/lib/supabase'

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

export interface TaskRecurrence {
  id: string
  task_id: string
  frequency: RecurrenceFrequency
  interval: number
  days_of_week: number[] | null
  day_of_month: number | null
  month_of_year: number | null
  start_date: string
  end_date: string | null
  max_occurrences: number | null
  occurrences_created: number
  next_occurrence: string | null
  last_created_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RecurrenceFormData {
  frequency: RecurrenceFrequency
  interval?: number
  days_of_week?: number[]
  day_of_month?: number
  month_of_year?: number
  start_date: string
  end_date?: string
  max_occurrences?: number
}

export interface RecurringTaskWithDetails extends TaskRecurrence {
  task: {
    id: string
    title: string
    project_id: string
    project: {
      name: string
      color: string
    }
  }
}

export class RecurringTaskService {
  /**
   * Create a recurrence pattern for a task
   */
  static async createRecurrence(taskId: string, data: RecurrenceFormData): Promise<TaskRecurrence> {
    // Calculate the next occurrence date
    const nextOccurrence = this.calculateNextOccurrence(data)

    const { data: recurrence, error } = await supabase
      .from('task_recurrences')
      .insert({
        task_id: taskId,
        frequency: data.frequency,
        interval: data.interval || 1,
        days_of_week: data.days_of_week || null,
        day_of_month: data.day_of_month || null,
        month_of_year: data.month_of_year || null,
        start_date: data.start_date,
        end_date: data.end_date || null,
        max_occurrences: data.max_occurrences || null,
        next_occurrence: nextOccurrence,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create recurrence: ${error.message}`)
    return recurrence
  }

  /**
   * Update a recurrence pattern
   */
  static async updateRecurrence(recurrenceId: string, data: Partial<RecurrenceFormData>): Promise<TaskRecurrence> {
    const updateData: any = { ...data }

    // Recalculate next occurrence if pattern changed
    if (data.frequency || data.interval || data.days_of_week || data.day_of_month) {
      const { data: current } = await supabase
        .from('task_recurrences')
        .select('*')
        .eq('id', recurrenceId)
        .single()

      if (current) {
        const merged = { ...current, ...data }
        updateData.next_occurrence = this.calculateNextOccurrence(merged as RecurrenceFormData)
      }
    }

    const { data: recurrence, error } = await supabase
      .from('task_recurrences')
      .update(updateData)
      .eq('id', recurrenceId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update recurrence: ${error.message}`)
    return recurrence
  }

  /**
   * Delete a recurrence pattern
   */
  static async deleteRecurrence(recurrenceId: string): Promise<void> {
    const { error } = await supabase
      .from('task_recurrences')
      .delete()
      .eq('id', recurrenceId)

    if (error) throw new Error(`Failed to delete recurrence: ${error.message}`)
  }

  /**
   * Pause/resume a recurrence
   */
  static async toggleRecurrence(recurrenceId: string, isActive: boolean): Promise<TaskRecurrence> {
    const { data: recurrence, error } = await supabase
      .from('task_recurrences')
      .update({ is_active: isActive })
      .eq('id', recurrenceId)
      .select()
      .single()

    if (error) throw new Error(`Failed to toggle recurrence: ${error.message}`)
    return recurrence
  }

  /**
   * Get recurrence for a specific task
   */
  static async getTaskRecurrence(taskId: string): Promise<TaskRecurrence | null> {
    const { data, error } = await supabase
      .from('task_recurrences')
      .select('*')
      .eq('task_id', taskId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch recurrence: ${error.message}`)
    }
    return data
  }

  /**
   * Get all recurring tasks for a project
   */
  static async getProjectRecurringTasks(projectId: string): Promise<RecurringTaskWithDetails[]> {
    const { data, error } = await supabase
      .from('task_recurrences')
      .select(`
        *,
        task:tasks (
          id,
          title,
          project_id,
          project:projects (
            name,
            color
          )
        )
      `)
      .eq('task.project_id', projectId)
      .order('next_occurrence', { ascending: true })

    if (error) throw new Error(`Failed to fetch project recurring tasks: ${error.message}`)
    return (data || []).filter(r => r.task) as RecurringTaskWithDetails[]
  }

  /**
   * Get all recurring tasks for a user across projects
   */
  static async getUserRecurringTasks(userId: string): Promise<RecurringTaskWithDetails[]> {
    // First get all projects the user is a member of
    const { data: memberships } = await supabase
      .from('TODOAAPP.project_members')
      .select('project_id')
      .eq('user_id', userId)

    if (!memberships || memberships.length === 0) return []

    const projectIds = memberships.map(m => m.project_id)

    const { data, error } = await supabase
      .from('task_recurrences')
      .select(`
        *,
        task:tasks (
          id,
          title,
          project_id,
          project:projects (
            name,
            color
          )
        )
      `)
      .in('task.project_id', projectIds)
      .order('next_occurrence', { ascending: true })

    if (error) throw new Error(`Failed to fetch user recurring tasks: ${error.message}`)
    return (data || []).filter(r => r.task) as RecurringTaskWithDetails[]
  }

  /**
   * Get upcoming occurrences preview
   */
  static getUpcomingOccurrences(data: RecurrenceFormData, count: number = 5): Date[] {
    const occurrences: Date[] = []
    let currentDate = new Date(data.start_date)
    const endDate = data.end_date ? new Date(data.end_date) : null
    const maxOccurrences = data.max_occurrences || count

    while (occurrences.length < Math.min(count, maxOccurrences)) {
      if (endDate && currentDate > endDate) break

      occurrences.push(new Date(currentDate))
      currentDate = this.getNextDate(currentDate, data)
    }

    return occurrences
  }

  /**
   * Calculate the next occurrence date from now
   */
  private static calculateNextOccurrence(data: RecurrenceFormData): string {
    const now = new Date()
    let nextDate = new Date(data.start_date)

    // If start date is in the future, return it
    if (nextDate > now) {
      return nextDate.toISOString()
    }

    // Find the next occurrence after now
    while (nextDate <= now) {
      nextDate = this.getNextDate(nextDate, data)
    }

    return nextDate.toISOString()
  }

  /**
   * Get the next date based on recurrence pattern
   */
  private static getNextDate(currentDate: Date, data: RecurrenceFormData): Date {
    const next = new Date(currentDate)
    const interval = data.interval || 1

    switch (data.frequency) {
      case 'daily':
        next.setDate(next.getDate() + interval)
        break

      case 'weekly':
        if (data.days_of_week && data.days_of_week.length > 0) {
          // Find next day of week
          const currentDay = next.getDay()
          const sortedDays = [...data.days_of_week].sort((a, b) => a - b)
          const nextDay = sortedDays.find(d => d > currentDay)

          if (nextDay !== undefined) {
            next.setDate(next.getDate() + (nextDay - currentDay))
          } else {
            // Move to next week
            next.setDate(next.getDate() + (7 - currentDay + sortedDays[0]))
            if (interval > 1) {
              next.setDate(next.getDate() + (interval - 1) * 7)
            }
          }
        } else {
          next.setDate(next.getDate() + interval * 7)
        }
        break

      case 'biweekly':
        next.setDate(next.getDate() + 14 * interval)
        break

      case 'monthly':
        next.setMonth(next.getMonth() + interval)
        if (data.day_of_month) {
          next.setDate(Math.min(data.day_of_month, this.getDaysInMonth(next)))
        }
        break

      case 'quarterly':
        next.setMonth(next.getMonth() + 3 * interval)
        if (data.day_of_month) {
          next.setDate(Math.min(data.day_of_month, this.getDaysInMonth(next)))
        }
        break

      case 'yearly':
        next.setFullYear(next.getFullYear() + interval)
        if (data.month_of_year !== undefined) {
          next.setMonth(data.month_of_year)
        }
        if (data.day_of_month) {
          next.setDate(Math.min(data.day_of_month, this.getDaysInMonth(next)))
        }
        break

      case 'custom':
        // Custom uses interval as days
        next.setDate(next.getDate() + interval)
        break
    }

    return next
  }

  /**
   * Get days in a month
   */
  private static getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  /**
   * Format recurrence pattern for display
   */
  static formatRecurrence(recurrence: TaskRecurrence): string {
    const interval = recurrence.interval

    switch (recurrence.frequency) {
      case 'daily':
        return interval === 1 ? 'Daily' : `Every ${interval} days`

      case 'weekly':
        if (recurrence.days_of_week && recurrence.days_of_week.length > 0) {
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          const dayNames = recurrence.days_of_week.map(d => days[d]).join(', ')
          return interval === 1 ? `Weekly on ${dayNames}` : `Every ${interval} weeks on ${dayNames}`
        }
        return interval === 1 ? 'Weekly' : `Every ${interval} weeks`

      case 'biweekly':
        return 'Every 2 weeks'

      case 'monthly':
        if (recurrence.day_of_month) {
          return interval === 1
            ? `Monthly on the ${this.ordinal(recurrence.day_of_month)}`
            : `Every ${interval} months on the ${this.ordinal(recurrence.day_of_month)}`
        }
        return interval === 1 ? 'Monthly' : `Every ${interval} months`

      case 'quarterly':
        return 'Quarterly'

      case 'yearly':
        return interval === 1 ? 'Yearly' : `Every ${interval} years`

      case 'custom':
        return `Every ${interval} days`

      default:
        return 'Custom'
    }
  }

  /**
   * Get ordinal suffix for a number
   */
  private static ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }
}
