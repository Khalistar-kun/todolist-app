import { supabase, Portfolio, PortfolioWithProjects, ProjectWithDetails } from '@/lib/supabase'

export class PortfolioService {
  /**
   * Get all portfolios for an organization
   */
  static async getOrganizationPortfolios(organizationId: string): Promise<PortfolioWithProjects[]> {
    const { data: portfolios, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch portfolios: ${error.message}`)

    // Get projects for each portfolio
    const portfoliosWithProjects = await Promise.all(
      (portfolios || []).map(async (portfolio) => {
        const projects = await this.getPortfolioProjects(portfolio.id)
        return {
          ...portfolio,
          projects,
        }
      })
    )

    return portfoliosWithProjects
  }

  /**
   * Get a single portfolio by ID
   */
  static async getPortfolio(portfolioId: string): Promise<PortfolioWithProjects | null> {
    const { data: portfolio, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('id', portfolioId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch portfolio: ${error.message}`)
    }

    const projects = await this.getPortfolioProjects(portfolioId)

    return {
      ...portfolio,
      projects,
    }
  }

  /**
   * Get projects in a portfolio with their stats
   */
  static async getPortfolioProjects(portfolioId: string): Promise<Array<ProjectWithDetails & { display_order: number }>> {
    const { data: portfolioProjects, error } = await supabase
      .from('portfolio_projects')
      .select(`
        display_order,
        project:projects (*)
      `)
      .eq('portfolio_id', portfolioId)
      .order('display_order', { ascending: true })

    if (error) throw new Error(`Failed to fetch portfolio projects: ${error.message}`)

    // Get task stats for each project
    const projectsWithStats = await Promise.all(
      (portfolioProjects || []).map(async (pp) => {
        const project = (pp as any).project
        if (!project) return null

        // Get task counts
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, stage_id, approval_status, due_date')
          .eq('project_id', project.id)
          .is('parent_task_id', null) // Only count top-level tasks

        const now = new Date()
        const tasksCount = tasks?.length || 0

        // Find done stage
        const workflowStages = project.workflow_stages || []
        const doneStage = workflowStages.find((s: any) =>
          s.is_done_stage || s.id === 'done' || s.name?.toLowerCase() === 'done'
        ) || workflowStages[workflowStages.length - 1]
        const doneStageId = doneStage?.id || 'done'

        const completedCount = tasks?.filter((t: any) =>
          t.stage_id === doneStageId && t.approval_status === 'approved'
        ).length || 0

        const pendingApprovalCount = tasks?.filter((t: any) =>
          t.stage_id === doneStageId && t.approval_status === 'pending'
        ).length || 0

        const overdueCount = tasks?.filter((t: any) =>
          t.due_date && new Date(t.due_date) < now && t.stage_id !== doneStageId
        ).length || 0

        // Get member count
        const { count: membersCount } = await supabase
          .from('project_members')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id)

        return {
          ...project,
          display_order: pp.display_order,
          tasks_count: tasksCount,
          completed_tasks_count: completedCount,
          pending_approval_count: pendingApprovalCount,
          overdue_tasks_count: overdueCount,
          members_count: membersCount || 0,
        }
      })
    )

    return projectsWithStats.filter(Boolean) as Array<ProjectWithDetails & { display_order: number }>
  }

  /**
   * Create a new portfolio
   */
  static async createPortfolio(
    organizationId: string,
    name: string,
    options?: {
      description?: string
      color?: string
      createdBy?: string
    }
  ): Promise<Portfolio> {
    const { data, error } = await supabase
      .from('portfolios')
      .insert({
        organization_id: organizationId,
        name,
        description: options?.description,
        color: options?.color || '#8B5CF6',
        created_by: options?.createdBy,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create portfolio: ${error.message}`)
    return data
  }

  /**
   * Update a portfolio
   */
  static async updatePortfolio(
    portfolioId: string,
    updates: {
      name?: string
      description?: string
      color?: string
    }
  ): Promise<Portfolio> {
    const { data, error } = await supabase
      .from('portfolios')
      .update(updates)
      .eq('id', portfolioId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update portfolio: ${error.message}`)
    return data
  }

  /**
   * Delete a portfolio
   */
  static async deletePortfolio(portfolioId: string): Promise<void> {
    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', portfolioId)

    if (error) throw new Error(`Failed to delete portfolio: ${error.message}`)
  }

  /**
   * Add a project to a portfolio
   */
  static async addProjectToPortfolio(portfolioId: string, projectId: string): Promise<void> {
    // Get the current max display_order
    const { data: existing } = await supabase
      .from('portfolio_projects')
      .select('display_order')
      .eq('portfolio_id', portfolioId)
      .order('display_order', { ascending: false })
      .limit(1)

    const nextOrder = (existing?.[0]?.display_order || 0) + 1

    const { error } = await supabase
      .from('portfolio_projects')
      .insert({
        portfolio_id: portfolioId,
        project_id: projectId,
        display_order: nextOrder,
      })

    if (error) {
      if (error.code === '23505') {
        throw new Error('Project is already in this portfolio')
      }
      throw new Error(`Failed to add project to portfolio: ${error.message}`)
    }
  }

  /**
   * Remove a project from a portfolio
   */
  static async removeProjectFromPortfolio(portfolioId: string, projectId: string): Promise<void> {
    const { error } = await supabase
      .from('portfolio_projects')
      .delete()
      .eq('portfolio_id', portfolioId)
      .eq('project_id', projectId)

    if (error) throw new Error(`Failed to remove project from portfolio: ${error.message}`)
  }

  /**
   * Reorder projects in a portfolio
   */
  static async reorderPortfolioProjects(portfolioId: string, projectIds: string[]): Promise<void> {
    // Update each project's display_order
    await Promise.all(
      projectIds.map((projectId, index) =>
        supabase
          .from('portfolio_projects')
          .update({ display_order: index })
          .eq('portfolio_id', portfolioId)
          .eq('project_id', projectId)
      )
    )
  }

  /**
   * Get portfolio summary stats
   */
  static async getPortfolioStats(portfolioId: string): Promise<{
    total_projects: number
    total_tasks: number
    completed_tasks: number
    overdue_tasks: number
    completion_rate: number
  }> {
    const projects = await this.getPortfolioProjects(portfolioId)

    const stats = projects.reduce(
      (acc, project) => ({
        total_projects: acc.total_projects + 1,
        total_tasks: acc.total_tasks + project.tasks_count,
        completed_tasks: acc.completed_tasks + project.completed_tasks_count,
        overdue_tasks: acc.overdue_tasks + (project.overdue_tasks_count || 0),
      }),
      { total_projects: 0, total_tasks: 0, completed_tasks: 0, overdue_tasks: 0 }
    )

    return {
      ...stats,
      completion_rate: stats.total_tasks > 0
        ? Math.round((stats.completed_tasks / stats.total_tasks) * 100)
        : 0,
    }
  }
}
