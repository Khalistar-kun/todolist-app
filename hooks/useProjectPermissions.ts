import { useState, useEffect, useCallback } from 'react'
import type { ProjectRole } from '@/lib/types'

export interface ProjectPermissions {
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canManageMembers: boolean
  role: ProjectRole | null
}

const defaultPermissions: ProjectPermissions = {
  canView: false,
  canEdit: false,
  canDelete: false,
  canManageMembers: false,
  role: null,
}

export function useProjectPermissions(projectId: string | null) {
  const [permissions, setPermissions] = useState<ProjectPermissions>(defaultPermissions)
  const [loading, setLoading] = useState(true)

  const fetchPermissions = useCallback(async () => {
    if (!projectId) {
      setPermissions(defaultPermissions)
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/members`)
      if (response.ok) {
        const data = await response.json()
        const role = data.currentUserRole as ProjectRole

        setPermissions({
          canView: ['viewer', 'member', 'admin', 'owner'].includes(role),
          canEdit: ['member', 'admin', 'owner'].includes(role),
          canDelete: ['admin', 'owner'].includes(role),
          canManageMembers: ['admin', 'owner'].includes(role),
          role,
        })
      } else {
        setPermissions(defaultPermissions)
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
      setPermissions(defaultPermissions)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  return { permissions, loading, refetch: fetchPermissions }
}

// Helper function to check permissions without hook (for non-component use)
export function hasPermission(role: ProjectRole | null, action: 'view' | 'edit' | 'delete' | 'manage_members'): boolean {
  if (!role) return false

  const permissions: Record<ProjectRole, string[]> = {
    viewer: ['view'],
    member: ['view', 'edit'],
    admin: ['view', 'edit', 'delete', 'manage_members'],
    owner: ['view', 'edit', 'delete', 'manage_members'],
  }

  return permissions[role]?.includes(action) || false
}

// Role display names and colors for UI
export const roleConfig: Record<ProjectRole, { label: string; color: string; description: string }> = {
  owner: {
    label: 'Owner',
    color: 'purple',
    description: 'Full control including project deletion and ownership transfer',
  },
  admin: {
    label: 'Admin',
    color: 'blue',
    description: 'Can manage members, delete tasks, and edit project settings',
  },
  member: {
    label: 'Member',
    color: 'green',
    description: 'Can create and edit tasks',
  },
  viewer: {
    label: 'Viewer',
    color: 'gray',
    description: 'Read-only access to project and tasks',
  },
}
