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
  pending_approval_count?: number
}

export class ProjectService {
  // Get all projects for the current user
  static async getUserProjects(): Promise<ProjectWithMembers[]> {
    const response = await fetch('/api/projects')

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to fetch projects')
    }

    const data = await response.json()
    // Return project data with task counts from API - detailed member info can be fetched per project
    return (data.projects || []).map((project: any) => ({
      ...project,
      members: [],
      tasks_count: project.tasks_count || 0,
      completed_tasks_count: project.completed_tasks_count || 0,
      pending_approval_count: project.pending_approval_count || 0,
    }))
  }

  // Get a single project by ID
  static async getProject(projectId: string): Promise<ProjectWithMembers | null> {
    const response = await fetch(`/api/projects/${projectId}`)

    if (!response.ok) {
      if (response.status === 404) return null
      const data = await response.json()
      throw new Error(data.error || 'Failed to fetch project')
    }

    const data = await response.json()
    return data.project
  }

  // Create a new project
  static async createProject(data: CreateProjectData): Promise<Project> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // First, verify the organization exists or create one
    let organizationId = data.organization_id

    // Check if the provided organization_id is valid
    const { data: existingOrg, error: orgCheckError } = await supabase
      .from('TODOAAPP.organizations')
      .select('id')
      .eq('id', organizationId)
      .single()

    if (orgCheckError || !existingOrg) {
      console.log('[ProjectService] Organization not found, creating new one...')

      // Create an organization for the user
      const userEmail = user.email || 'user'
      const username = userEmail.split('@')[0]
      const slug = `${username}-workspace-${Date.now()}`

      const { data: newOrg, error: createOrgError } = await supabase
        .from('TODOAAPP.organizations')
        .insert({
          name: `${username}'s Workspace`,
          slug: slug,
          description: 'Personal workspace',
          created_by: user.id,
        })
        .select()
        .single()

      if (createOrgError) {
        console.error('[ProjectService] Failed to create organization:', createOrgError)
        throw new Error(`Failed to create workspace: ${createOrgError.message}`)
      }

      organizationId = newOrg.id

      // Add user as organization owner
      const { error: memberError } = await supabase
        .from('TODOAAPP.organization_members')
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          role: 'owner',
        })

      if (memberError) {
        console.error('[ProjectService] Failed to add user as org member:', memberError)
      }
    }

    // Create the project
    const { data: project, error } = await supabase
      .from('TODOAAPP.projects')
      .insert({
        ...data,
        organization_id: organizationId,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[ProjectService] Failed to create project:', error)
      throw new Error(`Failed to create project: ${error.message}`)
    }

    // Add creator as project owner
    const { error: projectMemberError } = await supabase
      .from('TODOAAPP.project_members')
      .insert({
        project_id: project.id,
        user_id: user.id,
        role: 'owner',
      })

    if (projectMemberError) {
      console.error('[ProjectService] Failed to add user as project member:', projectMemberError)
    }

    return project
  }

  // Update a project
  static async updateProject(projectId: string, data: UpdateProjectData): Promise<Project> {
    const { data: project, error } = await supabase
      .from('TODOAAPP.projects')
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
      .from('TODOAAPP.projects')
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
      .from('TODOAAPP.project_members')
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
      .from('TODOAAPP.project_members')
      .update({ role })
      .eq('project_id', projectId)
      .eq('user_id', userId)

    if (error) throw error
  }

  // Remove a member from a project
  static async removeMember(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('TODOAAPP.project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)

    if (error) throw error
  }

  // Get project members
  static async getProjectMembers(projectId: string) {
    const { data, error } = await supabase
      .from('TODOAAPP.project_members')
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
      .from('TODOAAPP.project_members')
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
      .from('TODOAAPP.project_members')
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