import { supabase } from '@/lib/supabase'
import type { Project, Task } from '@/lib/supabase'
import type { ProjectMember } from '@/lib/types'

export interface CreateProjectData {
  name: string
  description?: string
  color?: string
  organization_id: string
  workflow_stages?: Array<{
    id: string
    name: string
    color: string
  }>
}

export interface UpdateProjectData {
  name?: string
  description?: string
  color?: string
  status?: string
  workflow_stages?: Array<{
    id: string
    name: string
    color: string
  }>
}

export interface ProjectWithMembers extends Project {
  members: (ProjectMember & {
    user: {
      id: string
      full_name: string | null
      email: string
      avatar_url: string | null
    }
  })[]
  tasks_count: number
  completed_tasks_count: number
}

export class ProjectService {
  // Get all projects for the current user
  static async getUserProjects(): Promise<ProjectWithMembers[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Get user's project memberships
    const { data: memberships, error: membershipError } = await supabase
      .from('project_members')
      .select(`
        project_id,
        role,
        project:projects(
          id,
          name,
          description,
          color,
          status,
          workflow_stages,
          created_at,
          updated_at,
          organization_id
        )
      `)
      .eq('user_id', user.id)

    if (membershipError) throw membershipError

    // Extract projects from memberships - handle both array and single object cases
    const projects = memberships?.map(m => {
      const proj = m.project
      // Supabase returns single object for foreign key relations
      return Array.isArray(proj) ? proj[0] : proj
    }).filter(Boolean) || []

    // Get additional details for each project
    const projectsWithDetails = await Promise.all(
      projects.map(async (project: any) => {
        // Get members
        const { data: members } = await supabase
          .from('project_members')
          .select(`
            *,
            user:profiles(id, full_name, email, avatar_url)
          `)
          .eq('project_id', project.id)

        // Get task counts
        const { data: tasks } = await supabase
          .from('tasks')
          .select('status')
          .eq('project_id', project.id)

        const tasksCount = tasks?.length || 0
        const completedTasksCount = tasks?.filter(t => t.status === 'done').length || 0

        return {
          ...project,
          members: members || [],
          tasks_count: tasksCount,
          completed_tasks_count: completedTasksCount,
        }
      })
    )

    return projectsWithDetails
  }

  // Get a single project by ID
  static async getProject(projectId: string): Promise<ProjectWithMembers | null> {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    // Get members
    const { data: members } = await supabase
      .from('project_members')
      .select(`
        *,
        user:profiles(id, full_name, email, avatar_url)
      `)
      .eq('project_id', projectId)

    // Get task counts
    const { data: tasks } = await supabase
      .from('tasks')
      .select('status')
      .eq('project_id', projectId)

    const tasksCount = tasks?.length || 0
    const completedTasksCount = tasks?.filter(t => t.status === 'done').length || 0

    return {
      ...project,
      members: members || [],
      tasks_count: tasksCount,
      completed_tasks_count: completedTasksCount,
    }
  }

  // Create a new project
  static async createProject(data: CreateProjectData): Promise<Project> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        ...data,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // Add creator as project owner
    await supabase
      .from('project_members')
      .insert({
        project_id: project.id,
        user_id: user.id,
        role: 'owner',
      })

    return project
  }

  // Update a project
  static async updateProject(projectId: string, data: UpdateProjectData): Promise<Project> {
    const { data: project, error } = await supabase
      .from('projects')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single()

    if (error) throw error
    return project
  }

  // Delete a project
  static async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (error) throw error
  }

  // Add a member to a project
  static async addMember(
    projectId: string,
    userId: string,
    role: 'owner' | 'admin' | 'editor' | 'reader' = 'reader'
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: userId,
        role,
        assigned_by: user.id,
      })

    if (error) throw error
  }

  // Update member role
  static async updateMemberRole(
    projectId: string,
    userId: string,
    role: 'owner' | 'admin' | 'editor' | 'reader'
  ): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .update({ role })
      .eq('project_id', projectId)
      .eq('user_id', userId)

    if (error) throw error
  }

  // Remove a member from a project
  static async removeMember(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)

    if (error) throw error
  }

  // Get project members
  static async getProjectMembers(projectId: string) {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        user:profiles(id, full_name, email, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true })

    if (error) throw error
    return data
  }

  // Check if user is a member of a project
  static async isMember(projectId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return false
      throw error
    }

    return !!data
  }

  // Get user's role in a project
  static async getUserRole(projectId: string, userId: string): Promise<'owner' | 'admin' | 'editor' | 'reader' | null> {
    const { data, error } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data.role
  }
}