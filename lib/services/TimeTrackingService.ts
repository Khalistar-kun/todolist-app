import { supabase, TimeEntry } from '@/lib/supabase'

export interface RunningTimer {
  id: string
  task_id: string
  started_at: string
  task_title?: string
  project_name?: string
  elapsed_minutes: number
}

export interface TimeReport {
  total_hours: number
  entries: Array<{
    date: string
    hours: number
    task_id: string
    task_title: string
    project_name: string
  }>
}

export class TimeTrackingService {
  /**
   * Start a timer for a task
   * Will automatically stop any other running timer for this user
   */
  static async startTimer(taskId: string, userId: string): Promise<TimeEntry> {
    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        task_id: taskId,
        user_id: userId,
        started_at: new Date().toISOString(),
        is_running: true,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to start timer: ${error.message}`)
    return data
  }

  /**
   * Stop the running timer for a user
   */
  static async stopTimer(userId: string): Promise<TimeEntry | null> {
    // Find running timer
    const { data: runningTimer, error: findError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('is_running', true)
      .single()

    if (findError || !runningTimer) {
      return null
    }

    // Calculate duration
    const startedAt = new Date(runningTimer.started_at!)
    const endedAt = new Date()
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)

    // Update the entry
    const { data, error } = await supabase
      .from('time_entries')
      .update({
        is_running: false,
        ended_at: endedAt.toISOString(),
        duration: durationMinutes,
      })
      .eq('id', runningTimer.id)
      .select()
      .single()

    if (error) throw new Error(`Failed to stop timer: ${error.message}`)
    return data
  }

  /**
   * Get the currently running timer for a user
   */
  static async getRunningTimer(userId: string): Promise<RunningTimer | null> {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        id,
        task_id,
        started_at,
        tasks!inner (
          title,
          projects!inner (
            name
          )
        )
      `)
      .eq('user_id', userId)
      .eq('is_running', true)
      .single()

    if (error || !data) return null

    const startedAt = new Date(data.started_at!)
    const now = new Date()
    const elapsedMinutes = Math.round((now.getTime() - startedAt.getTime()) / 60000)

    return {
      id: data.id,
      task_id: data.task_id,
      started_at: data.started_at!,
      task_title: (data as any).tasks?.title,
      project_name: (data as any).tasks?.projects?.name,
      elapsed_minutes: elapsedMinutes,
    }
  }

  /**
   * Log time manually for a task
   */
  static async logTime(
    taskId: string,
    userId: string,
    durationMinutes: number,
    description?: string,
    date?: Date
  ): Promise<TimeEntry> {
    const entryDate = date || new Date()

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        task_id: taskId,
        user_id: userId,
        duration: durationMinutes,
        description,
        started_at: entryDate.toISOString(),
        ended_at: entryDate.toISOString(),
        is_running: false,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to log time: ${error.message}`)
    return data
  }

  /**
   * Get time entries for a task
   */
  static async getTaskTimeEntries(taskId: string): Promise<Array<TimeEntry & { user: { full_name: string | null; avatar_url: string | null } }>> {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        profiles!user_id (
          full_name,
          avatar_url
        )
      `)
      .eq('task_id', taskId)
      .order('started_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch time entries: ${error.message}`)

    return (data || []).map(entry => ({
      ...entry,
      user: {
        full_name: (entry as any).profiles?.full_name || null,
        avatar_url: (entry as any).profiles?.avatar_url || null,
      }
    }))
  }

  /**
   * Get total time spent on a task in minutes
   */
  static async getTaskTotalTime(taskId: string): Promise<number> {
    const { data, error } = await supabase
      .from('time_entries')
      .select('duration, started_at, is_running')
      .eq('task_id', taskId)

    if (error) throw new Error(`Failed to fetch task time: ${error.message}`)

    let totalMinutes = 0
    for (const entry of data || []) {
      if (entry.is_running && entry.started_at) {
        // Calculate elapsed time for running timer
        const startedAt = new Date(entry.started_at)
        const now = new Date()
        totalMinutes += Math.round((now.getTime() - startedAt.getTime()) / 60000)
      } else if (entry.duration) {
        totalMinutes += entry.duration
      }
    }

    return totalMinutes
  }

  /**
   * Get time report for a user
   */
  static async getUserTimeReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TimeReport> {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        tasks!inner (
          title,
          projects!inner (
            name
          )
        )
      `)
      .eq('user_id', userId)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())
      .order('started_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch time report: ${error.message}`)

    let totalHours = 0
    const entries = (data || []).map(entry => {
      let hours = 0
      if (entry.is_running && entry.started_at) {
        const startedAt = new Date(entry.started_at)
        const now = new Date()
        hours = (now.getTime() - startedAt.getTime()) / 3600000
      } else if (entry.duration) {
        hours = entry.duration / 60
      }
      totalHours += hours

      return {
        date: entry.started_at?.split('T')[0] || '',
        hours,
        task_id: entry.task_id,
        task_title: (entry as any).tasks?.title || 'Unknown',
        project_name: (entry as any).tasks?.projects?.name || 'Unknown',
      }
    })

    return {
      total_hours: Math.round(totalHours * 100) / 100,
      entries,
    }
  }

  /**
   * Get time report for a project
   */
  static async getProjectTimeReport(
    projectId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ total_hours: number; by_user: Array<{ user_id: string; user_name: string; hours: number }> }> {
    let query = supabase
      .from('time_entries')
      .select(`
        *,
        tasks!inner (
          project_id
        ),
        profiles!user_id (
          id,
          full_name
        )
      `)
      .eq('tasks.project_id', projectId)

    if (startDate) {
      query = query.gte('started_at', startDate.toISOString())
    }
    if (endDate) {
      query = query.lte('started_at', endDate.toISOString())
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch project time report: ${error.message}`)

    const userHours: Record<string, { user_name: string; hours: number }> = {}
    let totalHours = 0

    for (const entry of data || []) {
      let hours = 0
      if (entry.is_running && entry.started_at) {
        const startedAt = new Date(entry.started_at)
        const now = new Date()
        hours = (now.getTime() - startedAt.getTime()) / 3600000
      } else if (entry.duration) {
        hours = entry.duration / 60
      }

      totalHours += hours

      const userId = entry.user_id
      const userName = (entry as any).profiles?.full_name || 'Unknown'

      if (!userHours[userId]) {
        userHours[userId] = { user_name: userName, hours: 0 }
      }
      userHours[userId].hours += hours
    }

    return {
      total_hours: Math.round(totalHours * 100) / 100,
      by_user: Object.entries(userHours).map(([user_id, data]) => ({
        user_id,
        user_name: data.user_name,
        hours: Math.round(data.hours * 100) / 100,
      })),
    }
  }

  /**
   * Delete a time entry
   */
  static async deleteTimeEntry(entryId: string): Promise<void> {
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', entryId)

    if (error) throw new Error(`Failed to delete time entry: ${error.message}`)
  }

  /**
   * Update a time entry
   */
  static async updateTimeEntry(
    entryId: string,
    updates: { duration?: number; description?: string }
  ): Promise<TimeEntry> {
    const { data, error } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', entryId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update time entry: ${error.message}`)
    return data
  }
}
