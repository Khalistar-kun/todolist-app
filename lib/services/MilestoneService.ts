import { supabase, Milestone, MilestoneWithTasks } from '@/lib/supabase'

export class MilestoneService {
  /**
   * Get all milestones for a project
   */
  static async getProjectMilestones(projectId: string): Promise<MilestoneWithTasks[]> {
    const { data: milestones, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('target_date', { ascending: true })

    if (error) throw new Error(`Failed to fetch milestones: ${error.message}`)

    // Get task counts for each milestone
    const milestonesWithTasks = await Promise.all(
      (milestones || []).map(async (milestone) => {
        const { data: tasks, error: tasksError } = await supabase
          .from('TODOAAPP.tasks')
          .select('id, stage_id, approval_status')
          .eq('milestone_id', milestone.id)

        if (tasksError) {
          console.error('Error fetching milestone tasks:', tasksError)
          return { ...milestone, tasks_count: 0, completed_tasks_count: 0, progress_percent: 0 }
        }

        const tasksCount = tasks?.length || 0
        // Count tasks that are in done stage and approved
        const completedCount = tasks?.filter(t =>
          t.stage_id === 'done' && t.approval_status === 'approved'
        ).length || 0

        return {
          ...milestone,
          tasks_count: tasksCount,
          completed_tasks_count: completedCount,
          progress_percent: tasksCount > 0 ? Math.round((completedCount / tasksCount) * 100) : 0,
        }
      })
    )

    return milestonesWithTasks
  }

  /**
   * Get a single milestone by ID
   */
  static async getMilestone(milestoneId: string): Promise<MilestoneWithTasks | null> {
    const { data: milestone, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('id', milestoneId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch milestone: ${error.message}`)
    }

    // Get task counts
    const { data: tasks } = await supabase
      .from('TODOAAPP.tasks')
      .select('id, stage_id, approval_status')
      .eq('milestone_id', milestoneId)

    const tasksCount = tasks?.length || 0
    const completedCount = tasks?.filter(t =>
      t.stage_id === 'done' && t.approval_status === 'approved'
    ).length || 0

    return {
      ...milestone,
      tasks_count: tasksCount,
      completed_tasks_count: completedCount,
      progress_percent: tasksCount > 0 ? Math.round((completedCount / tasksCount) * 100) : 0,
    }
  }

  /**
   * Create a new milestone
   */
  static async createMilestone(
    projectId: string,
    name: string,
    targetDate: Date,
    options?: {
      description?: string
      color?: string
      createdBy?: string
    }
  ): Promise<Milestone> {
    const { data, error } = await supabase
      .from('milestones')
      .insert({
        project_id: projectId,
        name,
        target_date: targetDate.toISOString().split('T')[0],
        description: options?.description,
        color: options?.color || '#6366F1',
        created_by: options?.createdBy,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create milestone: ${error.message}`)
    return data
  }

  /**
   * Update a milestone
   */
  static async updateMilestone(
    milestoneId: string,
    updates: {
      name?: string
      description?: string
      target_date?: Date
      color?: string
      completed_at?: Date | null
    }
  ): Promise<Milestone> {
    const updateData: any = { ...updates }
    if (updates.target_date) {
      updateData.target_date = updates.target_date.toISOString().split('T')[0]
    }
    if (updates.completed_at) {
      updateData.completed_at = updates.completed_at.toISOString()
    }

    const { data, error } = await supabase
      .from('milestones')
      .update(updateData)
      .eq('id', milestoneId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update milestone: ${error.message}`)
    return data
  }

  /**
   * Delete a milestone
   */
  static async deleteMilestone(milestoneId: string): Promise<void> {
    // First, unlink any tasks from this milestone
    await supabase
      .from('TODOAAPP.tasks')
      .update({ milestone_id: null })
      .eq('milestone_id', milestoneId)

    const { error } = await supabase
      .from('milestones')
      .delete()
      .eq('id', milestoneId)

    if (error) throw new Error(`Failed to delete milestone: ${error.message}`)
  }

  /**
   * Mark a milestone as complete
   */
  static async completeMilestone(milestoneId: string): Promise<Milestone> {
    return this.updateMilestone(milestoneId, { completed_at: new Date() })
  }

  /**
   * Reopen a completed milestone
   */
  static async reopenMilestone(milestoneId: string): Promise<Milestone> {
    return this.updateMilestone(milestoneId, { completed_at: null })
  }

  /**
   * Link a task to a milestone
   */
  static async linkTaskToMilestone(taskId: string, milestoneId: string | null): Promise<void> {
    const { error } = await supabase
      .from('TODOAAPP.tasks')
      .update({ milestone_id: milestoneId })
      .eq('id', taskId)

    if (error) throw new Error(`Failed to link task to milestone: ${error.message}`)
  }

  /**
   * Get tasks linked to a milestone
   */
  static async getMilestoneTasks(milestoneId: string) {
    const { data, error } = await supabase
      .from('TODOAAPP.tasks')
      .select('*')
      .eq('milestone_id', milestoneId)
      .order('position', { ascending: true })

    if (error) throw new Error(`Failed to fetch milestone tasks: ${error.message}`)
    return data || []
  }

  /**
   * Get upcoming milestones (within next N days)
   */
  static async getUpcomingMilestones(projectId: string, daysAhead: number = 30): Promise<MilestoneWithTasks[]> {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + daysAhead)

    const { data: milestones, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .is('completed_at', null)
      .lte('target_date', futureDate.toISOString().split('T')[0])
      .order('target_date', { ascending: true })

    if (error) throw new Error(`Failed to fetch upcoming milestones: ${error.message}`)

    return Promise.all(
      (milestones || []).map(async (milestone) => {
        const result = await this.getMilestone(milestone.id)
        return result!
      })
    )
  }
}
