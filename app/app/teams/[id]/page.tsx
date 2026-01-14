"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/app/providers/AuthProvider'
import { TeamService, TeamWithDetails, TeamMember } from '@/lib/services/TeamService'
import { supabase } from '@/lib/supabase'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useSound } from '@/hooks/useSound'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'

function TeamDetailSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                    <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TeamDetailPage() {
  const router = useRouter()
  const params = useParams()
  const teamId = params.id as string
  const { user, status } = useAuth()
  const { playClick, playSuccess, playError } = useSound()
  const [team, setTeam] = useState<TeamWithDetails | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editColor, setEditColor] = useState('')
  const [orgMembers, setOrgMembers] = useState<any[]>([])
  const [selectedNewMember, setSelectedNewMember] = useState('')
  const isInitialLoadRef = useRef(true)

  const TEAM_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316',
  ]

  const fetchTeam = useCallback(async () => {
    try {
      const teamData = await TeamService.getTeam(teamId)
      setTeam(teamData)
      setEditName(teamData.name)
      setEditDescription(teamData.description || '')
      setEditColor(teamData.color)
    } catch (error) {
      console.error('Error fetching team:', error)
      toast.error('Failed to load team')
    } finally {
      setDataLoading(false)
    }
  }, [teamId])

  const fetchOrgMembers = useCallback(async () => {
    if (!team?.organization_id) return
    try {
      const { data: members } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          role,
          user:profiles(id, full_name, email, avatar_url)
        `)
        .eq('organization_id', team.organization_id)
      setOrgMembers(members || [])
    } catch (error) {
      console.error('Error fetching org members:', error)
    }
  }, [team?.organization_id])

  useEffect(() => {
    if (team?.organization_id) {
      fetchOrgMembers()
    }
  }, [team?.organization_id, fetchOrgMembers])

  useRealtimeSubscription({
    subscriptions: [
      { table: 'teams', filter: `id=eq.${teamId}` },
      { table: 'team_members', filter: `team_id=eq.${teamId}` },
      { table: 'projects', filter: `team_id=eq.${teamId}` },
    ],
    onChange: () => {
      if (!isInitialLoadRef.current) {
        fetchTeam()
      }
    },
    enabled: !!user && !!teamId,
  })

  useEffect(() => {
    if (user && teamId) {
      fetchTeam().then(() => {
        isInitialLoadRef.current = false
      })
    }
  }, [user, teamId, fetchTeam])

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim()) return

    setSaving(true)
    try {
      await TeamService.updateTeam(teamId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        color: editColor,
      })
      playSuccess()
      toast.success('Team updated!')
      setShowEditModal(false)
      fetchTeam()
    } catch (error: any) {
      playError()
      toast.error(error.message || 'Failed to update team')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedNewMember) return

    setSaving(true)
    try {
      await TeamService.addMember(teamId, selectedNewMember)
      playSuccess()
      toast.success('Member added!')
      setShowAddMemberModal(false)
      setSelectedNewMember('')
      fetchTeam()
    } catch (error: any) {
      playError()
      toast.error(error.message || 'Failed to add member')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from this team?`)) return

    try {
      await TeamService.removeMember(teamId, userId)
      playSuccess()
      toast.success('Member removed')
      fetchTeam()
    } catch (error: any) {
      playError()
      toast.error(error.message || 'Failed to remove member')
    }
  }

  const handleDeleteTeam = async () => {
    if (!confirm('Are you sure you want to delete this team? Projects will be unassigned but not deleted.')) return

    try {
      await TeamService.deleteTeam(teamId)
      playSuccess()
      toast.success('Team deleted')
      router.push('/app/team')
    } catch (error: any) {
      playError()
      toast.error(error.message || 'Failed to delete team')
    }
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'owner': return 'badge-primary'
      case 'admin': return 'badge-warning'
      default: return 'badge-gray'
    }
  }

  const canEdit = team?.user_role === 'owner' || team?.user_role === 'admin'
  const canDelete = team?.user_role === 'owner'

  // Get org members not in team
  const availableMembers = orgMembers.filter(
    om => !team?.members.some(m => m.user_id === om.user_id)
  )

  if (status === 'loading') {
    return <TeamDetailSkeleton />
  }

  if (status === 'authenticated' && dataLoading) {
    return <TeamDetailSkeleton />
  }

  if (status === 'unauthenticated' || !user) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-gray-500 dark:text-gray-400">Please sign in to view this team.</p>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-gray-500 dark:text-gray-400">Team not found.</p>
        <Link href="/app/team" className="btn btn-md btn-primary mt-4">
          Back to Teams
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { playClick(); router.push('/app/team') }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            {team.image_url ? (
              <img
                src={team.image_url}
                alt={team.name}
                className="w-16 h-16 rounded-xl object-cover"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
                style={{ backgroundColor: team.color }}
              >
                {team.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {team.name}
                {canEdit && (
                  <button
                    onClick={() => { playClick(); setShowEditModal(true) }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    title="Edit team"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                )}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {team.organization?.name || 'Organization'}
              </p>
            </div>
          </div>
          {canDelete && (
            <button
              onClick={() => { playClick(); handleDeleteTeam() }}
              className="btn btn-md btn-danger"
            >
              Delete Team
            </button>
          )}
        </div>

        {team.description && (
          <p className="text-gray-600 dark:text-gray-400 mb-6">{team.description}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects Section */}
          <div className="lg:col-span-2">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Projects ({team.projects.length})
                </h2>
                <Link
                  href={`/app/projects/new?team_id=${teamId}`}
                  className="btn btn-sm btn-primary"
                  onClick={() => playClick()}
                >
                  New Project
                </Link>
              </div>

              {team.projects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {team.projects.map(project => (
                    <Link
                      key={project.id}
                      href={`/app/projects/${project.id}`}
                      className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
                      onClick={() => playClick()}
                    >
                      <div className="flex items-center gap-3">
                        {project.image_url ? (
                          <img
                            src={project.image_url}
                            alt={project.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
                            style={{ backgroundColor: project.color }}
                          >
                            {project.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {project.name}
                          </h3>
                          <span className={`badge text-xs ${
                            project.status === 'active' ? 'badge-success' : 'badge-gray'
                          }`}>
                            {project.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">No projects yet</p>
                  <Link
                    href={`/app/projects/new?team_id=${teamId}`}
                    className="btn btn-sm btn-primary mt-3"
                    onClick={() => playClick()}
                  >
                    Create First Project
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Members Section */}
          <div>
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Members ({team.members.length})
                </h2>
                {canEdit && availableMembers.length > 0 && (
                  <button
                    onClick={() => { playClick(); setShowAddMemberModal(true) }}
                    className="btn btn-sm btn-secondary"
                  >
                    Add
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {team.members.map(member => (
                  <div key={member.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      {member.user.avatar_url ? (
                        member.user.avatar_url.startsWith('data:') ? (
                          <img
                            src={member.user.avatar_url}
                            alt={member.user.full_name || ''}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <Image
                            src={member.user.avatar_url}
                            alt={member.user.full_name || ''}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                            unoptimized
                          />
                        )
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-medium">
                          {(member.user.full_name || member.user.email || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                          {member.user.full_name || 'Unknown'}
                          {member.user_id === user.id && (
                            <span className="badge badge-primary text-[10px]">You</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${getRoleBadgeClass(member.role)}`}>
                        {member.role}
                      </span>
                      {canEdit && member.user_id !== user.id && member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.user_id, member.user.full_name || 'this member')}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove member"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Team Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Team</h2>
            </div>

            <form onSubmit={handleSaveTeam}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Team Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="input w-full resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TEAM_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditColor(color)}
                        className={`w-8 h-8 rounded-lg transition-transform ${
                          editColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-md btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !editName.trim()}
                  className="btn btn-md btn-primary"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Team Member</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Add members from your organization
              </p>
            </div>

            <form onSubmit={handleAddMember}>
              <div className="px-6 py-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Member
                </label>
                <select
                  value={selectedNewMember}
                  onChange={(e) => setSelectedNewMember(e.target.value)}
                  className="input w-full"
                  required
                >
                  <option value="">Choose a member...</option>
                  {availableMembers.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user?.full_name || m.user?.email || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddMemberModal(false); setSelectedNewMember('') }}
                  className="btn btn-md btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedNewMember}
                  className="btn btn-md btn-primary"
                >
                  {saving ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
