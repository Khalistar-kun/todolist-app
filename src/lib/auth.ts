import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { UserProfile, ProjectRole } from './types'

// Server-side auth utilities
export async function createClient() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
  return supabase
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    redirect('/auth/signin')
  }
  return user
}

// Project membership and permissions
export async function checkProjectMembership(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const supabase = await createClient()
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single()

  return member?.role || null
}

export async function requireProjectMembership(
  userId: string,
  projectId: string,
  requiredRole?: ProjectRole
): Promise<ProjectRole> {
  const role = await checkProjectMembership(userId, projectId)
  if (!role) {
    redirect(`/projects/${projectId}/request-access`)
  }

  if (requiredRole) {
    const roleHierarchy = { viewer: 1, member: 2, admin: 3, owner: 4 }
    const userLevel = roleHierarchy[role]
    const requiredLevel = roleHierarchy[requiredRole]

    if (userLevel < requiredLevel) {
      redirect(`/projects/${projectId}?error=insufficient_permissions`)
    }
  }

  return role
}

// Server action helpers
export async function createProfile(userId: string, email: string, metadata?: any): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email,
      full_name: metadata?.full_name || metadata?.name,
      avatar_url: metadata?.avatar_url,
      created_at: new Date().toISOString()
    })

  if (error) {
    throw new Error(`Failed to create profile: ${error.message}`)
  }
}

export async function updateLastSeen(userId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      last_seen_at: new Date().toISOString(),
      is_online: true
    })
    .eq('id', userId)

  if (error) {
    console.error('Failed to update last seen:', error)
  }
}

// Get user's projects
export async function getUserProjects(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('project_members')
    .select(`
      role,
      project:projects(
        id,
        name,
        description,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to fetch user projects: ${error.message}`)
  }

  return data
}

// Check if user can perform action on project
export async function canPerformAction(
  userId: string,
  projectId: string,
  action: 'view' | 'edit' | 'delete' | 'manage_members'
): Promise<boolean> {
  const role = await checkProjectMembership(userId, projectId)
  if (!role) return false

  const permissions = {
    viewer: ['view'],
    member: ['view', 'edit'],
    admin: ['view', 'edit', 'manage_members'],
    owner: ['view', 'edit', 'delete', 'manage_members']
  }

  return permissions[role].includes(action)
}

// User preferences
export async function getUserPreferences(userId: string, projectId?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)

  if (projectId) {
    query = query.eq('project_id', projectId)
  } else {
    query = query.is('project_id', null)
  }

  const { data, error } = await query.single()

  if (error && error.code !== 'PGRST116') { // Not found error
    throw new Error(`Failed to fetch user preferences: ${error.message}`)
  }

  return data
}

export async function updateUserPreferences(
  userId: string,
  preferences: any,
  projectId?: string
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      project_id: projectId || null,
      ...preferences,
      updated_at: new Date().toISOString()
    })

  if (error) {
    throw new Error(`Failed to update user preferences: ${error.message}`)
  }
}

// Search users by email or name
export async function searchUsers(query: string, projectId?: string): Promise<UserProfile[]> {
  const supabase = await createClient()

  let dbQuery = supabase
    .from('profiles')
    .select('*')
    .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(10)

  // If projectId is provided, only return project members
  if (projectId) {
    const { data: memberIds } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)

    const userIds = memberIds?.map(m => m.user_id) || []
    if (userIds.length > 0) {
      dbQuery = dbQuery.in('id', userIds)
    } else {
      return []
    }
  }

  const { data, error } = await dbQuery

  if (error) {
    throw new Error(`Failed to search users: ${error.message}`)
  }

  return data || []
}

// Get project members with profiles
export async function getProjectMembers(projectId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('project_members')
    .select(`
      *,
      user:profiles(
        id,
        email,
        full_name,
        avatar_url,
        is_online,
        last_seen_at
      )
    `)
    .eq('project_id', projectId)
    .order('joined_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch project members: ${error.message}`)
  }

  return data
}

// Statistics and analytics
export async function getUserStats(userId: string) {
  const supabase = await createClient()

  const [projectsResult, tasksResult] = await Promise.all([
    supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId),
    supabase
      .from('tasks')
      .select('id, status, created_at')
      .or(`created_by.eq.${userId},assigned_to.cs.{${userId}}`)
  ])

  return {
    projectCount: projectsResult.data?.length || 0,
    taskCount: tasksResult.data?.length || 0,
    completedTasks: tasksResult.data?.filter(t => t.status === 'done').length || 0
  }
}