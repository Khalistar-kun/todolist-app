'use client'

import { useState, useEffect, useCallback } from 'react'
import { useProjectPermissions, roleConfig } from '@/hooks/useProjectPermissions'
import type { ProjectRole } from '@/lib/types'
import toast from 'react-hot-toast'

interface Member {
  id: string
  user_id: string
  role: ProjectRole
  joined_at: string
  user: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

interface PendingInvitation {
  id: string
  email: string
  role: ProjectRole
  status: string
  created_at: string
  expires_at: string
}

interface MemberManagementProps {
  projectId: string
  currentUserId: string
}

export default function MemberManagement({ projectId, currentUserId }: MemberManagementProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<ProjectRole>('member')
  const [inviting, setInviting] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const { permissions } = useProjectPermissions(projectId)

  const fetchMembers = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
        setPendingInvitations(data.pendingInvitations || [])
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.member) {
          // User was added directly
          toast.success('Member added successfully')
          setMembers([...members, data.member])
        } else if (data.invitation) {
          // Invitation was created
          toast.success(data.message || 'Invitation sent')
          setPendingInvitations([...pendingInvitations, data.invitation])
        }
        setInviteEmail('')
        setShowInviteForm(false)
      } else {
        toast.error(data.error || 'Failed to add member')
      }
    } catch (error) {
      toast.error('Failed to add member')
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return

    try {
      const response = await fetch(`/api/invitations?id=${invitationId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Invitation cancelled')
        setPendingInvitations(pendingInvitations.filter(inv => inv.id !== invitationId))
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to cancel invitation')
      }
    } catch (error) {
      toast.error('Failed to cancel invitation')
    }
  }

  const handleRoleChange = async (userId: string, newRole: ProjectRole) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Role updated successfully')
        setMembers(members.map(m =>
          m.user_id === userId ? { ...m, role: newRole } : m
        ))
      } else {
        toast.error(data.error || 'Failed to update role')
      }
    } catch (error) {
      toast.error('Failed to update role')
    }
  }

  const handleRemoveMember = async (userId: string, memberName: string) => {
    const isLeavingProject = userId === currentUserId

    if (!confirm(isLeavingProject
      ? 'Are you sure you want to leave this project?'
      : `Are you sure you want to remove ${memberName} from this project?`
    )) return

    try {
      const response = await fetch(
        `/api/projects/${projectId}/members?user_id=${userId}`,
        { method: 'DELETE' }
      )

      const data = await response.json()

      if (response.ok) {
        if (isLeavingProject) {
          toast.success('You have left the project')
          window.location.href = '/app'
        } else {
          toast.success('Member removed successfully')
          setMembers(members.filter(m => m.user_id !== userId))
        }
      } else {
        toast.error(data.error || 'Failed to remove member')
      }
    } catch (error) {
      toast.error('Failed to remove member')
    }
  }

  const getRoleBadgeClasses = (role: ProjectRole) => {
    const colorMap: Record<string, string> = {
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    }
    return colorMap[roleConfig[role].color] || colorMap.gray
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="spinner spinner-lg"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Team Members ({members.length})
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage who has access to this project
          </p>
        </div>
        {permissions.canManageMembers && (
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="btn btn-sm btn-primary"
          >
            {showInviteForm ? 'Cancel' : 'Add Member'}
          </button>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && permissions.canManageMembers && (
        <form onSubmit={handleInvite} className="card p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
              className="input w-full"
            >
              <option value="viewer">Viewer - Read-only access</option>
              <option value="member">Member - Can create and edit tasks</option>
              {permissions.role === 'owner' && (
                <option value="admin">Admin - Can manage members and delete tasks</option>
              )}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowInviteForm(false)}
              className="btn btn-sm btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="btn btn-sm btn-primary"
            >
              {inviting ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      )}

      {/* Member List */}
      <div className="space-y-2">
        {members.map((member) => {
          const isCurrentUser = member.user_id === currentUserId
          const canModifyMember = permissions.canManageMembers &&
            !isCurrentUser &&
            (permissions.role === 'owner' || member.role !== 'owner')

          return (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  {member.user.avatar_url ? (
                    <img
                      src={member.user.avatar_url}
                      alt={member.user.full_name || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {(member.user.full_name || member.user.email)?.[0]?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {member.user.full_name || member.user.email}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {member.user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Role Badge or Selector */}
                {canModifyMember ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.user_id, e.target.value as ProjectRole)}
                    className="text-xs rounded-full px-2 py-1 border-none bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    {permissions.role === 'owner' && (
                      <option value="owner">Owner</option>
                    )}
                  </select>
                ) : (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${getRoleBadgeClasses(member.role)}`}>
                    {roleConfig[member.role].label}
                  </span>
                )}

                {/* Remove Button */}
                {(canModifyMember || isCurrentUser) && (
                  <button
                    onClick={() => handleRemoveMember(member.user_id, member.user.full_name || member.user.email)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title={isCurrentUser ? 'Leave project' : 'Remove member'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && permissions.canManageMembers && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Pending Invitations ({pendingInvitations.length})
          </h4>
          {pendingInvitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
            >
              <div className="flex items-center gap-3">
                {/* Pending Icon */}
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                {/* Info */}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {invitation.email}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Invitation pending - expires {new Date(invitation.expires_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${getRoleBadgeClasses(invitation.role)}`}>
                  {roleConfig[invitation.role].label}
                </span>
                <button
                  onClick={() => handleCancelInvitation(invitation.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Cancel invitation"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role Descriptions */}
      <div className="mt-6 p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Role Permissions</h4>
        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
          {Object.entries(roleConfig).map(([role, config]) => (
            <div key={role} className="flex items-start gap-2">
              <span className={`font-medium px-2 py-0.5 rounded-full ${getRoleBadgeClasses(role as ProjectRole)}`}>
                {config.label}
              </span>
              <span>{config.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
