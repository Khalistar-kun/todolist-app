"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/AuthProvider'
import type { Profile } from '@/lib/supabase'
import { useSound } from '@/hooks/useSound'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { OrganizationSlackIntegration } from '@/components/organizations/OrganizationSlackIntegration'

interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
  created_by: string
}

interface TeamMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  user: Profile
}

interface Announcement {
  id: string
  organization_id: string
  title: string
  content: string
  created_by: string
  created_at: string
  author?: Profile
}

interface Meeting {
  id: string
  organization_id: string
  title: string
  description: string | null
  scheduled_at: string
  duration_minutes: number
  meeting_link: string | null
  created_by: string
  created_at: string
}

/**
 * OrganizationDetailSkeleton - Neutral loading state for organization detail page
 * Shows during auth loading AND data loading to prevent auth flash
 */
function OrganizationDetailSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
            <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex gap-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${i === 2 ? 'lg:col-span-2' : ''}`}>
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="p-5 space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-16 w-full bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function OrganizationDetailPage() {
  const params = useParams()
  const router = useRouter()
  // CRITICAL: Use status as primary auth indicator, not loading boolean
  const { user, status } = useAuth()
  const { playClick, playSuccess } = useSound()

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'announcements' | 'meetings' | 'members' | 'settings'>('overview')

  // Announcement modal
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementContent, setAnnouncementContent] = useState('')
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false)

  // Meeting modal
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingDescription, setMeetingDescription] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('')
  const [meetingDuration, setMeetingDuration] = useState('60')
  const [meetingLink, setMeetingLink] = useState('')
  const [creatingMeeting, setCreatingMeeting] = useState(false)

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)

  // Delete organization modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

  const organizationId = params.id as string
  const isInitialLoadRef = useRef(true)

  // Silent refetch function for real-time updates (no loading state)
  const refetchDataSilently = useCallback(async () => {
    if (!user || !organizationId) return

    try {
      const response = await fetch(`/api/organizations/${organizationId}`)
      const data = await response.json()

      if (response.ok) {
        setOrganization(data.organization)
        setCurrentUserRole(data.organization.role)
        setMembers((data.members as unknown as TeamMember[]) || [])
        setAnnouncements((data.announcements as unknown as Announcement[]) || [])
        setMeetings(data.meetings || [])
      }
    } catch (error) {
      console.error('Error refetching organization data:', error)
    }
  }, [user, organizationId])

  // Subscribe to real-time updates for this organization
  useRealtimeSubscription({
    subscriptions: [
      { table: 'organizations', filter: `id=eq.${organizationId}` },
      { table: 'organization_members', filter: `organization_id=eq.${organizationId}` },
      { table: 'organization_announcements', filter: `organization_id=eq.${organizationId}` },
      { table: 'organization_meetings', filter: `organization_id=eq.${organizationId}` },
    ],
    onChange: (payload) => {
      console.log('[Realtime] Organization data changed:', payload.table, payload.eventType)
      // Skip initial load to avoid duplicate fetch
      if (!isInitialLoadRef.current) {
        refetchDataSilently()
      }
    },
    enabled: !!organizationId && !!user,
  })

  const fetchOrganizationData = useCallback(async () => {
    if (!user || !organizationId) return

    try {
      // Use API route to fetch organization data (avoids RLS issues)
      const response = await fetch(`/api/organizations/${organizationId}`)
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Organization not found')
        router.push('/app/team')
        return
      }

      setOrganization(data.organization)
      setCurrentUserRole(data.organization.role)
      setMembers((data.members as unknown as TeamMember[]) || [])
      setAnnouncements((data.announcements as unknown as Announcement[]) || [])
      setMeetings(data.meetings || [])

    } catch (error) {
      console.error('Error fetching organization data:', error)
      toast.error('Failed to load organization data')
      router.push('/app/team')
    } finally {
      setDataLoading(false)
    }
  }, [user, organizationId, router])

  useEffect(() => {
    if (user) {
      fetchOrganizationData().then(() => {
        // Mark initial load as complete to enable real-time updates
        isInitialLoadRef.current = false
      })
    }
  }, [user, fetchOrganizationData])

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!announcementTitle.trim() || !announcementContent.trim()) return

    setCreatingAnnouncement(true)
    try {
      const response = await fetch(`/api/organizations/${organizationId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: announcementTitle.trim(),
          content: announcementContent.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      playSuccess()
      toast.success('Announcement posted!')
      setShowAnnouncementModal(false)
      setAnnouncementTitle('')
      setAnnouncementContent('')
      // Real-time subscription will automatically update the data
    } catch (error: any) {
      console.error('Error creating announcement:', error)
      toast.error(error.message || 'Failed to post announcement')
    } finally {
      setCreatingAnnouncement(false)
    }
  }

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!meetingTitle.trim() || !meetingDate || !meetingTime) return

    setCreatingMeeting(true)
    try {
      const scheduledAt = new Date(`${meetingDate}T${meetingTime}`).toISOString()

      const response = await fetch(`/api/organizations/${organizationId}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetingTitle.trim(),
          description: meetingDescription.trim() || null,
          scheduled_at: scheduledAt,
          duration_minutes: parseInt(meetingDuration),
          meeting_link: meetingLink.trim() || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      playSuccess()
      toast.success('Meeting scheduled!')
      setShowMeetingModal(false)
      setMeetingTitle('')
      setMeetingDescription('')
      setMeetingDate('')
      setMeetingTime('')
      setMeetingDuration('60')
      setMeetingLink('')
      // Real-time subscription will automatically update the data
    } catch (error: any) {
      console.error('Error creating meeting:', error)
      toast.error(error.message || 'Failed to schedule meeting')
    } finally {
      setCreatingMeeting(false)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviting(true)
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      playSuccess()
      toast.success('Member added!')
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('member')
      // Real-time subscription will automatically update the data
    } catch (error: any) {
      console.error('Error inviting member:', error)
      toast.error(error.message || 'Failed to invite member')
    } finally {
      setInviting(false)
    }
  }

  const handleDeleteOrganization = async () => {
    if (!organization || deleteConfirmation !== organization.name) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      playSuccess()
      toast.success('Organization deleted successfully')
      router.push('/app/organizations')
    } catch (error: any) {
      console.error('Error deleting organization:', error)
      toast.error(error.message || 'Failed to delete organization')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
      setDeleteConfirmation('')
    }
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'owner': return 'badge-primary'
      case 'admin': return 'badge-warning'
      case 'member': return 'badge-success'
      default: return 'badge-gray'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // CRITICAL ORDER OF CHECKS:
  // 1. Auth loading → show skeleton (neutral UI)
  // 2. Data loading (when authenticated) → show skeleton
  // 3. Unauthenticated → show login prompt
  // 4. Authenticated with data → show content

  if (status === 'loading') {
    return <OrganizationDetailSkeleton />
  }

  if (status === 'authenticated' && dataLoading) {
    return <OrganizationDetailSkeleton />
  }

  if (status === 'unauthenticated' || !user) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-gray-500 dark:text-gray-400">Please sign in to view this organization.</p>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-gray-500 dark:text-gray-400">Organization not found.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="page-header animate-slide-up mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/app/team')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="page-title text-3xl">{organization.name}</h1>
              {organization.description && (
                <p className="page-description">{organization.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8">
            {(['overview', 'announcements', 'meetings', 'members', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { playClick(); setActiveTab(tab) }}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Announcements */}
            <div className="card">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Announcements</h2>
                {canManage && (
                  <button
                    onClick={() => { playClick(); setShowAnnouncementModal(true) }}
                    className="btn btn-sm btn-primary"
                  >
                    Post
                  </button>
                )}
              </div>
              <div className="p-5">
                {announcements.length > 0 ? (
                  <div className="space-y-4">
                    {announcements.slice(0, 3).map((announcement) => (
                      <div key={announcement.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <h3 className="font-medium text-gray-900 dark:text-white">{announcement.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{announcement.content}</p>
                        <p className="text-xs text-gray-500 mt-2">{formatDate(announcement.created_at)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No announcements yet</p>
                )}
              </div>
            </div>

            {/* Upcoming Meetings */}
            <div className="card">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Meetings</h2>
                {canManage && (
                  <button
                    onClick={() => { playClick(); setShowMeetingModal(true) }}
                    className="btn btn-sm btn-primary"
                  >
                    Schedule
                  </button>
                )}
              </div>
              <div className="p-5">
                {meetings.length > 0 ? (
                  <div className="space-y-4">
                    {meetings.slice(0, 3).map((meeting) => (
                      <div key={meeting.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <h3 className="font-medium text-gray-900 dark:text-white">{meeting.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {formatDate(meeting.scheduled_at)} ({meeting.duration_minutes} min)
                        </p>
                        {meeting.meeting_link && (
                          <a
                            href={meeting.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                          >
                            Join Meeting
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No upcoming meetings</p>
                )}
              </div>
            </div>

            {/* Team Members */}
            <div className="card lg:col-span-2">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members ({members.length})</h2>
                {canManage && (
                  <button
                    onClick={() => { playClick(); setShowInviteModal(true) }}
                    className="btn btn-sm btn-primary"
                  >
                    Invite
                  </button>
                )}
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-4">
                  {members.slice(0, 8).map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                      {member.user?.avatar_url ? (
                        member.user.avatar_url.startsWith('data:') ? (
                          <img
                            className="h-10 w-10 rounded-full object-cover"
                            src={member.user.avatar_url}
                            alt={member.user.full_name || ''}
                          />
                        ) : (
                          <Image
                            className="rounded-full object-cover"
                            src={member.user.avatar_url}
                            alt={member.user.full_name || ''}
                            width={40}
                            height={40}
                            unoptimized
                          />
                        )
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-medium text-sm">
                          {(member.user?.full_name || member.user?.email || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.user?.full_name || 'Unknown'}
                        </p>
                        <span className={`badge ${getRoleBadgeClass(member.role)} text-xs`}>{member.role}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Announcements Tab */}
        {activeTab === 'announcements' && (
          <div className="space-y-4">
            {canManage && (
              <div className="flex justify-end">
                <button
                  onClick={() => { playClick(); setShowAnnouncementModal(true) }}
                  className="btn btn-md btn-primary inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Post Announcement
                </button>
              </div>
            )}
            {announcements.length > 0 ? (
              announcements.map((announcement) => (
                <div key={announcement.id} className="card p-5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{announcement.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">{announcement.content}</p>
                  <p className="text-sm text-gray-500 mt-4">{formatDate(announcement.created_at)}</p>
                </div>
              ))
            ) : (
              <div className="card p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">No announcements yet</p>
              </div>
            )}
          </div>
        )}

        {/* Meetings Tab */}
        {activeTab === 'meetings' && (
          <div className="space-y-4">
            {canManage && (
              <div className="flex justify-end">
                <button
                  onClick={() => { playClick(); setShowMeetingModal(true) }}
                  className="btn btn-md btn-primary inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Schedule Meeting
                </button>
              </div>
            )}
            {meetings.length > 0 ? (
              meetings.map((meeting) => (
                <div key={meeting.id} className="card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{meeting.title}</h3>
                      {meeting.description && (
                        <p className="text-gray-600 dark:text-gray-400 mt-1">{meeting.description}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-2">
                        {formatDate(meeting.scheduled_at)} - {meeting.duration_minutes} minutes
                      </p>
                    </div>
                    {meeting.meeting_link && (
                      <a
                        href={meeting.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-primary"
                      >
                        Join
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="card p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">No upcoming meetings</p>
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {canManage && (
              <div className="flex justify-end">
                <button
                  onClick={() => { playClick(); setShowInviteModal(true) }}
                  className="btn btn-md btn-primary inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Invite Member
                </button>
              </div>
            )}
            <div className="card">
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {members.map((member) => (
                  <li key={member.id} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {member.user?.avatar_url ? (
                        member.user.avatar_url.startsWith('data:') ? (
                          <img
                            className="h-10 w-10 rounded-full object-cover"
                            src={member.user.avatar_url}
                            alt={member.user.full_name || ''}
                          />
                        ) : (
                          <Image
                            className="rounded-full object-cover"
                            src={member.user.avatar_url}
                            alt={member.user.full_name || ''}
                            width={40}
                            height={40}
                            unoptimized
                          />
                        )
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-medium text-sm">
                          {(member.user?.full_name || member.user?.email || '?')[0].toUpperCase()}
                        </div>
                      )}
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
                    <span className={`badge ${getRoleBadgeClass(member.role)}`}>{member.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {canManage ? (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Organization Settings</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Configure integrations and manage your organization</p>
                </div>
                <OrganizationSlackIntegration organizationId={organizationId} canManage={canManage} />

                {/* Danger Zone - Only visible to owner */}
                {currentUserRole === 'owner' && (
                  <div className="card border-red-200 dark:border-red-900/50">
                    <div className="px-5 py-4 border-b border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 rounded-t-xl">
                      <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Delete this organization</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Once deleted, all members will lose access. Projects will be unlinked but not deleted.
                          </p>
                        </div>
                        <button
                          onClick={() => { playClick(); setShowDeleteModal(true) }}
                          className="btn btn-md bg-red-600 hover:bg-red-700 text-white flex-shrink-0"
                        >
                          Delete Organization
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="card p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Only organization admins can access settings.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Post Announcement</h2>
            </div>
            <form onSubmit={handleCreateAnnouncement}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    className="input w-full"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Content <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    className="input w-full resize-none"
                    rows={5}
                    required
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="btn btn-md btn-secondary"
                  disabled={creatingAnnouncement}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAnnouncement || !announcementTitle.trim() || !announcementContent.trim()}
                  className="btn btn-md btn-primary"
                >
                  {creatingAnnouncement ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Schedule Meeting</h2>
            </div>
            <form onSubmit={handleCreateMeeting}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="input w-full"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={meetingDescription}
                    onChange={(e) => setMeetingDescription(e.target.value)}
                    className="input w-full resize-none"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={meetingTime}
                      onChange={(e) => setMeetingTime(e.target.value)}
                      className="input w-full"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Duration (minutes)
                  </label>
                  <select
                    value={meetingDuration}
                    onChange={(e) => setMeetingDuration(e.target.value)}
                    className="input w-full"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Meeting Link
                  </label>
                  <input
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    className="input w-full"
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowMeetingModal(false)}
                  className="btn btn-md btn-secondary"
                  disabled={creatingMeeting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingMeeting || !meetingTitle.trim() || !meetingDate || !meetingTime}
                  className="btn btn-md btn-primary"
                >
                  {creatingMeeting ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Invite Member</h2>
            </div>
            <form onSubmit={handleInviteMember}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="input w-full"
                    placeholder="user@example.com"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="input w-full"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-md btn-secondary"
                  disabled={inviting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="btn btn-md btn-primary"
                >
                  {inviting ? 'Inviting...' : 'Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Organization Modal */}
      {showDeleteModal && organization && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Organization</h2>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This action <strong className="text-red-600 dark:text-red-400">cannot be undone</strong>. This will permanently delete the organization <strong>{organization.name}</strong> and remove all members.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Projects belonging to this organization will be unlinked but not deleted.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type <strong>{organization.name}</strong> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="input w-full"
                  placeholder={organization.name}
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmation('') }}
                className="btn btn-md btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteOrganization}
                disabled={deleting || deleteConfirmation !== organization.name}
                className="btn btn-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete Organization'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
