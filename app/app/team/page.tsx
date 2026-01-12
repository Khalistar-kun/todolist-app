"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Organization, Profile } from '@/lib/supabase'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useSound } from '@/hooks/useSound'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface TeamMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  user: Profile
}

interface OrganizationWithMembers extends Organization {
  members: TeamMember[]
}

/**
 * TeamSkeleton - Neutral loading state for team page
 * Shows during auth loading AND data loading to prevent auth flash
 */
function TeamSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              {[...Array(3)].map((_, j) => (
                <div key={j} className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0 flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                    <div className="h-3 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TeamPage() {
  const router = useRouter()
  // CRITICAL: Use isInitialized to block render until auth resolves
  const { user, status, isInitialized } = useAuth()
  const { playClick, playSuccess } = useSound()
  const [organizations, setOrganizations] = useState<OrganizationWithMembers[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgDescription, setNewOrgDescription] = useState('')
  const isInitialLoadRef = useRef(true)

  // Silent refetch for real-time updates
  const refetchTeamDataSilently = useCallback(async () => {
    if (!user) return
    try {
      const { data: orgMembers } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)

      const orgIds = orgMembers?.map(om => om.organization_id) || []
      if (orgIds.length === 0) {
        setOrganizations([])
        return
      }

      const { data: orgsData } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)

      const orgsWithMembers: OrganizationWithMembers[] = []
      for (const org of orgsData || []) {
        const { data: members } = await supabase
          .from('organization_members')
          .select(`id, user_id, role, joined_at, user:profiles(*)`)
          .eq('organization_id', org.id)

        orgsWithMembers.push({
          ...org,
          members: (members as unknown as TeamMember[]) || [],
        })
      }
      setOrganizations(orgsWithMembers)
    } catch (error) {
      console.error('Error refetching team data:', error)
    }
  }, [user])

  // Subscribe to real-time updates
  useRealtimeSubscription({
    subscriptions: [
      { table: 'organizations' },
      { table: 'organization_members' },
    ],
    onChange: () => {
      if (!isInitialLoadRef.current) {
        refetchTeamDataSilently()
      }
    },
    enabled: !!user,
  })

  const fetchTeamData = useCallback(async () => {
    if (!user) return
    try {
      // Get user's organizations
      const { data: orgMembers } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)

      const orgIds = orgMembers?.map(om => om.organization_id) || []

      if (orgIds.length === 0) {
        setOrganizations([])
        setDataLoading(false)
        return
      }

      // Fetch organizations with members
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)

      // Fetch members for each organization
      const orgsWithMembers: OrganizationWithMembers[] = []

      for (const org of orgsData || []) {
        const { data: members } = await supabase
          .from('organization_members')
          .select(`
            id,
            user_id,
            role,
            joined_at,
            user:profiles(*)
          `)
          .eq('organization_id', org.id)

        orgsWithMembers.push({
          ...org,
          members: (members as unknown as TeamMember[]) || [],
        })
      }

      setOrganizations(orgsWithMembers)
    } catch (error) {
      console.error('Error fetching team data:', error)
    } finally {
      setDataLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchTeamData().then(() => {
        isInitialLoadRef.current = false
      })
    }
  }, [user, fetchTeamData])

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newOrgName.trim(),
          description: newOrgDescription.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        playSuccess()
        toast.success('Organization created successfully!')
        setShowCreateModal(false)
        setNewOrgName('')
        setNewOrgDescription('')
        // Redirect to the new organization page
        router.push(`/app/organizations/${data.organization.id}`)
      } else {
        toast.error(data.error || 'Failed to create organization')
      }
    } catch (error) {
      toast.error('Failed to create organization')
    } finally {
      setCreating(false)
    }
  }

  const openCreateModal = () => {
    playClick()
    setShowCreateModal(true)
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'owner': return 'badge-primary'
      case 'admin': return 'badge-warning'
      case 'editor': return 'badge-success'
      default: return 'badge-gray'
    }
  }

  // CRITICAL ORDER OF CHECKS:
  // 1. Auth not initialized → show skeleton (blocks ALL rendering)
  // 2. Data loading (when authenticated) → show skeleton
  // 3. Unauthenticated → show login prompt (only after auth is resolved)
  // 4. Authenticated with data → show content

  if (!isInitialized || status === 'loading') {
    return <TeamSkeleton />
  }

  if (status === 'authenticated' && dataLoading) {
    return <TeamSkeleton />
  }

  if (status === 'unauthenticated' || !user) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-gray-500 dark:text-gray-400">Please sign in to view your team.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="page-header animate-slide-up flex items-center justify-between">
          <div>
            <h1 className="page-title text-3xl">Team</h1>
            <p className="page-description">Manage your team members across organizations</p>
          </div>
          {organizations.length > 0 && (
            <button
              onClick={openCreateModal}
              className="btn btn-md btn-primary hover-lift inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Organization
            </button>
          )}
        </div>

        {organizations.length > 0 ? (
          <div className="space-y-6">
            {organizations.map((org, orgIndex) => (
              <div
                key={org.id}
                className="card overflow-hidden animate-slide-up cursor-pointer hover:shadow-lg transition-shadow"
                style={{ animationDelay: `${orgIndex * 100}ms` }}
                onClick={() => { playClick(); router.push(`/app/organizations/${org.id}`) }}
              >
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {org.name}
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </h2>
                      {org.description && (
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{org.description}</p>
                      )}
                    </div>
                    <span className="badge badge-gray">
                      {org.members.length} member{org.members.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {org.members.map((member, memberIndex) => (
                    <li
                      key={member.id}
                      className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200 animate-fade-in"
                      style={{ animationDelay: `${(orgIndex * 100) + (memberIndex * 50)}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0">
                            {member.user?.avatar_url ? (
                              member.user.avatar_url.startsWith('data:') ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  className="h-10 w-10 rounded-full ring-2 ring-white dark:ring-gray-800 shadow-sm object-cover"
                                  src={member.user.avatar_url}
                                  alt={member.user.full_name || member.user.email}
                                />
                              ) : (
                                <Image
                                  className="rounded-full ring-2 ring-white dark:ring-gray-800 shadow-sm object-cover"
                                  src={member.user.avatar_url}
                                  alt={member.user.full_name || member.user.email}
                                  width={40}
                                  height={40}
                                  unoptimized
                                />
                              )
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white ring-2 ring-white dark:ring-gray-800 shadow-sm flex items-center justify-center font-medium text-sm">
                                {(member.user?.full_name || member.user?.email || '?')[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                              {member.user?.full_name || 'Unknown User'}
                              {member.user_id === user.id && (
                                <span className="badge badge-primary text-[10px]">You</span>
                              )}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{member.user?.email}</p>
                          </div>
                        </div>
                        <span className={`badge ${getRoleBadgeClass(member.role)}`}>
                          {member.role}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="card animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="empty-state py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="empty-state-title">No organizations yet</h3>
              <p className="empty-state-description">
                Create an organization to start collaborating with your team.
              </p>
              <div className="mt-6">
                <button
                  onClick={openCreateModal}
                  className="btn btn-md btn-primary hover-lift inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Organization
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create Organization
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Organizations help you collaborate with your team
              </p>
            </div>

            <form onSubmit={handleCreateOrganization}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label
                    htmlFor="org-name"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="org-name"
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="My Team"
                    className="input w-full"
                    maxLength={100}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    htmlFor="org-description"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Description <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    id="org-description"
                    value={newOrgDescription}
                    onChange={(e) => setNewOrgDescription(e.target.value)}
                    placeholder="What does this organization do?"
                    className="input w-full resize-none"
                    rows={3}
                    maxLength={500}
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewOrgName('')
                    setNewOrgDescription('')
                  }}
                  className="btn btn-md btn-secondary"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newOrgName.trim()}
                  className="btn btn-md btn-primary"
                >
                  {creating ? (
                    <>
                      <div className="spinner spinner-sm mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Organization'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
