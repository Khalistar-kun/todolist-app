"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { Organization, Profile } from '@/lib/supabase'
import { TeamService, Team } from '@/lib/services/TeamService'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useSound } from '@/hooks/useSound'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface OrganizationMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  user: Profile
}

interface OrganizationWithMembers extends Organization {
  members: OrganizationMember[]
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="flex-1">
                  <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                  <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-3" />
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse border-2 border-white dark:border-gray-800" />
                  ))}
                </div>
                <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TeamPage() {
  const router = useRouter()
  const { user, status } = useAuth()
  const { playClick, playSuccess } = useSound()
  const [teams, setTeams] = useState<Team[]>([])
  const [organizations, setOrganizations] = useState<OrganizationWithMembers[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'teams' | 'organizations'>('teams')
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false)
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')
  const [newTeamColor, setNewTeamColor] = useState('#3B82F6')
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgDescription, setNewOrgDescription] = useState('')
  const isInitialLoadRef = useRef(true)

  const TEAM_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316',
  ]

  // Fetch teams
  const fetchTeams = useCallback(async () => {
    try {
      const userTeams = await TeamService.getUserTeams()
      setTeams(userTeams)
    } catch (error) {
      console.error('Error fetching teams:', error)
    }
  }, [])

  // Fetch organizations with members
  const fetchOrganizations = useCallback(async () => {
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
          members: (members as unknown as OrganizationMember[]) || [],
        })
      }
      setOrganizations(orgsWithMembers)
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }, [user])

  // Combined fetch
  const fetchAllData = useCallback(async () => {
    await Promise.all([fetchTeams(), fetchOrganizations()])
    setDataLoading(false)
  }, [fetchTeams, fetchOrganizations])

  // Subscribe to real-time updates
  useRealtimeSubscription({
    subscriptions: [
      { table: 'teams' },
      { table: 'team_members' },
      { table: 'organizations' },
      { table: 'organization_members' },
    ],
    onChange: () => {
      if (!isInitialLoadRef.current) {
        fetchAllData()
      }
    },
    enabled: !!user,
  })

  useEffect(() => {
    if (user) {
      fetchAllData().then(() => {
        isInitialLoadRef.current = false
      })
    }
  }, [user, fetchAllData])

  // Set default selected org when organizations load
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id)
    }
  }, [organizations, selectedOrgId])

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim() || !selectedOrgId) return

    setCreating(true)
    try {
      const team = await TeamService.createTeam({
        name: newTeamName.trim(),
        description: newTeamDescription.trim() || undefined,
        color: newTeamColor,
        organization_id: selectedOrgId,
      })
      playSuccess()
      toast.success('Team created successfully!')
      setShowCreateTeamModal(false)
      setNewTeamName('')
      setNewTeamDescription('')
      setNewTeamColor('#3B82F6')
      fetchTeams()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create team')
    } finally {
      setCreating(false)
    }
  }

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
        setShowCreateOrgModal(false)
        setNewOrgName('')
        setNewOrgDescription('')
        fetchOrganizations()
      } else {
        toast.error(data.error || 'Failed to create organization')
      }
    } catch (error) {
      toast.error('Failed to create organization')
    } finally {
      setCreating(false)
    }
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'owner': return 'badge-primary'
      case 'admin': return 'badge-warning'
      case 'editor': return 'badge-success'
      default: return 'badge-gray'
    }
  }

  if (status === 'loading') {
    return <TeamSkeleton />
  }

  if (status === 'authenticated' && dataLoading) {
    return <TeamSkeleton />
  }

  if (status === 'unauthenticated' || !user) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-gray-500 dark:text-gray-400">Please sign in to view your teams.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="page-header animate-slide-up flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title text-3xl">Teams</h1>
            <p className="page-description">Manage your teams and organizations</p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'teams' && organizations.length > 0 && (
              <button
                onClick={() => { playClick(); setShowCreateTeamModal(true) }}
                className="btn btn-md btn-primary hover-lift inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Team
              </button>
            )}
            {activeTab === 'organizations' && (
              <button
                onClick={() => { playClick(); setShowCreateOrgModal(true) }}
                className="btn btn-md btn-primary hover-lift inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Organization
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-6 sm:space-x-8 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => { playClick(); setActiveTab('teams') }}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'teams'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Teams
              {teams.length > 0 && (
                <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">
                  {teams.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { playClick(); setActiveTab('organizations') }}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'organizations'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Organizations
              {organizations.length > 0 && (
                <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">
                  {organizations.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <>
            {teams.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map((team, index) => (
                  <Link
                    key={team.id}
                    href={`/app/teams/${team.id}`}
                    className="card p-5 hover:shadow-lg transition-shadow animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => playClick()}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {team.image_url ? (
                        <img
                          src={team.image_url}
                          alt={team.name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-semibold text-lg flex-shrink-0"
                          style={{ backgroundColor: team.color }}
                        >
                          {team.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {team.name}
                        </h3>
                        <span className={`badge ${getRoleBadgeClass(team.user_role || 'member')} text-xs`}>
                          {team.user_role || 'member'}
                        </span>
                      </div>
                    </div>

                    {team.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {team.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                          </svg>
                          {team.members_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                          </svg>
                          {team.projects_count || 0} projects
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : organizations.length > 0 ? (
              <div className="card animate-slide-up">
                <div className="empty-state py-12">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                  <h3 className="empty-state-title">No teams yet</h3>
                  <p className="empty-state-description">
                    Create a team to organize your projects and collaborate with others.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={() => { playClick(); setShowCreateTeamModal(true) }}
                      className="btn btn-md btn-primary hover-lift inline-flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create Team
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card animate-slide-up">
                <div className="empty-state py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                    </svg>
                  </div>
                  <h3 className="empty-state-title">Create an organization first</h3>
                  <p className="empty-state-description">
                    Organizations contain teams. Create an organization to get started.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={() => { playClick(); setActiveTab('organizations'); setShowCreateOrgModal(true) }}
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
          </>
        )}

        {/* Organizations Tab */}
        {activeTab === 'organizations' && (
          <>
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
                      {org.members.slice(0, 5).map((member, memberIndex) => (
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
                      {org.members.length > 5 && (
                        <li className="px-5 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                          +{org.members.length - 5} more members
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card animate-slide-up" style={{ animationDelay: '100ms' }}>
                <div className="empty-state py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                    </svg>
                  </div>
                  <h3 className="empty-state-title">No organizations yet</h3>
                  <p className="empty-state-description">
                    Create an organization to start collaborating with your team.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={() => { playClick(); setShowCreateOrgModal(true) }}
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
          </>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create Team
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Teams help organize projects within an organization
              </p>
            </div>

            <form onSubmit={handleCreateTeam}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Organization <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="input w-full"
                    required
                  >
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Team Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Engineering"
                    className="input w-full"
                    maxLength={100}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    placeholder="What does this team work on?"
                    className="input w-full resize-none"
                    rows={2}
                    maxLength={500}
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
                        onClick={() => setNewTeamColor(color)}
                        className={`w-8 h-8 rounded-lg transition-transform ${
                          newTeamColor === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 scale-110' : ''
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
                  onClick={() => {
                    setShowCreateTeamModal(false)
                    setNewTeamName('')
                    setNewTeamDescription('')
                  }}
                  className="btn btn-md btn-secondary"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTeamName.trim() || !selectedOrgId}
                  className="btn btn-md btn-primary"
                >
                  {creating ? (
                    <>
                      <div className="spinner spinner-sm mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Team'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateOrgModal && (
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
                Organizations contain teams and members
              </p>
            </div>

            <form onSubmit={handleCreateOrganization}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="My Company"
                    className="input w-full"
                    maxLength={100}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
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
                    setShowCreateOrgModal(false)
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
