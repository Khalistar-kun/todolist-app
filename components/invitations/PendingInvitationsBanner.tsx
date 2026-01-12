'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Invitation {
  id: string
  project_id: string
  role: string
  token: string
  project: {
    id: string
    name: string
    color: string
  }
  invited_by: {
    full_name: string | null
    email: string
  } | null
}

export function PendingInvitationsBanner() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        const response = await fetch('/api/invitations')
        if (response.ok) {
          const data = await response.json()
          setInvitations(data.invitations || [])
        }
      } catch (error) {
        console.error('Error fetching invitations:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInvitations()
  }, [])

  const handleAction = async (invitationId: string, action: 'accept' | 'decline') => {
    setProcessing(invitationId)
    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitationId, action }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || `Invitation ${action}ed`)
        setInvitations(invitations.filter(inv => inv.id !== invitationId))

        // If accepted, refresh the page to show the new project
        if (action === 'accept') {
          window.location.reload()
        }
      } else {
        toast.error(data.error || `Failed to ${action} invitation`)
      }
    } catch (error) {
      toast.error(`Failed to ${action} invitation`)
    } finally {
      setProcessing(null)
    }
  }

  if (loading || invitations.length === 0) {
    return null
  }

  return (
    <div className="mb-6 space-y-3">
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-200 dark:border-blue-800"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {/* Project Color Indicator */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: invitation.project?.color || '#3b82f6' }}
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                </svg>
              </div>

              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  You&apos;ve been invited to join &quot;{invitation.project?.name || 'a project'}&quot;
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {invitation.invited_by
                    ? `${invitation.invited_by.full_name || invitation.invited_by.email} invited you as ${invitation.role}`
                    : `You've been invited as ${invitation.role}`
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleAction(invitation.id, 'decline')}
                disabled={processing === invitation.id}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Decline
              </button>
              <button
                onClick={() => handleAction(invitation.id, 'accept')}
                disabled={processing === invitation.id}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {processing === invitation.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Accept'
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
