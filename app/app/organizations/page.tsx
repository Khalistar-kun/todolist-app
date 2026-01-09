"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSound } from '@/hooks/useSound'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
  role: string
}

/**
 * OrganizationsSkeleton - Neutral loading state for organizations page
 * Shows during auth loading AND data loading to prevent auth flash
 */
function OrganizationsSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
            <div className="h-4 w-80 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
                <div className="h-5 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              </div>
              <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function OrganizationsPage() {
  const router = useRouter()
  // CRITICAL: Use status as primary auth indicator, not loading boolean
  const { user, status } = useAuth()
  const { playClick, playSuccess } = useSound()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgDescription, setNewOrgDescription] = useState('')
  const isInitialLoadRef = useRef(true)

  // Silent refetch function for real-time updates (no loading state)
  const refetchOrganizationsSilently = useCallback(async () => {
    if (!user) return
    try {
      const response = await fetch('/api/organizations')
      const data = await response.json()

      if (response.ok) {
        setOrganizations(data.organizations || [])
      }
    } catch (error) {
      console.error('Error refetching organizations:', error)
    }
  }, [user])

  // Subscribe to real-time updates for organizations and memberships
  useRealtimeSubscription({
    subscriptions: [
      { table: 'organizations' },
      { table: 'organization_members' },
    ],
    onChange: (payload) => {
      console.log('[Realtime] Organizations data changed:', payload.table, payload.eventType)
      // Skip initial load to avoid duplicate fetch
      if (!isInitialLoadRef.current) {
        refetchOrganizationsSilently()
      }
    },
    enabled: !!user,
  })

  const fetchOrganizations = useCallback(async () => {
    if (!user) return
    try {
      const response = await fetch('/api/organizations')
      const data = await response.json()

      if (response.ok) {
        setOrganizations(data.organizations || [])
      } else {
        console.error('Error fetching organizations:', data.error)
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setDataLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchOrganizations().then(() => {
        // Mark initial load as complete to enable real-time updates
        isInitialLoadRef.current = false
      })
    }
  }, [user, fetchOrganizations])

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
      case 'member': return 'badge-success'
      default: return 'badge-gray'
    }
  }

  // CRITICAL ORDER OF CHECKS:
  // 1. Auth loading → show skeleton (neutral UI)
  // 2. Data loading (when authenticated) → show skeleton
  // 3. Unauthenticated → show login prompt (only after auth is resolved)
  // 4. Authenticated with data → show content

  if (status === 'loading') {
    return <OrganizationsSkeleton />
  }

  if (status === 'authenticated' && dataLoading) {
    return <OrganizationsSkeleton />
  }

  if (status === 'unauthenticated' || !user) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-gray-500 dark:text-gray-400">Please sign in to view organizations.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="page-header animate-slide-up flex items-center justify-between">
          <div>
            <h1 className="page-title text-3xl">Organizations</h1>
            <p className="page-description">Manage your organizations and collaborate with teams</p>
          </div>
          <button
            onClick={openCreateModal}
            className="btn btn-md btn-primary hover-lift inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Organization
          </button>
        </div>

        {organizations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org, index) => (
              <div
                key={org.id}
                className="card overflow-hidden animate-slide-up cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => { playClick(); router.push(`/app/organizations/${org.id}`) }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                      {org.name[0].toUpperCase()}
                    </div>
                    <span className={`badge ${getRoleBadgeClass(org.role)}`}>
                      {org.role}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {org.name}
                  </h3>
                  {org.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                      {org.description}
                    </p>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Created {new Date(org.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="empty-state py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
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
