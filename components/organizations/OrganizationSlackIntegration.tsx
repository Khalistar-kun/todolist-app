"use client"

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

interface OrgSlackIntegrationData {
  id: string
  organization_id: string
  access_token: string | null
  channel_id: string | null
  channel_name: string | null
  notify_on_announcement: boolean
  notify_on_meeting: boolean
  notify_on_member_join: boolean
  notify_on_member_leave: boolean
}

interface OrganizationSlackIntegrationProps {
  organizationId: string
  canManage: boolean
}

export function OrganizationSlackIntegration({ organizationId, canManage }: OrganizationSlackIntegrationProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [integration, setIntegration] = useState<OrgSlackIntegrationData | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Form state
  const [accessToken, setAccessToken] = useState('')
  const [channelId, setChannelId] = useState('')
  const [channelName, setChannelName] = useState('')
  const [notifyOnAnnouncement, setNotifyOnAnnouncement] = useState(true)
  const [notifyOnMeeting, setNotifyOnMeeting] = useState(true)
  const [notifyOnMemberJoin, setNotifyOnMemberJoin] = useState(true)
  const [notifyOnMemberLeave, setNotifyOnMemberLeave] = useState(true)

  const fetchIntegration = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/organizations/${organizationId}/slack`)
      if (response.ok) {
        const data = await response.json()
        if (data.integration) {
          setIntegration(data.integration)
          setAccessToken(data.integration.access_token || '')
          setChannelId(data.integration.channel_id || '')
          setChannelName(data.integration.channel_name || '')
          setNotifyOnAnnouncement(data.integration.notify_on_announcement)
          setNotifyOnMeeting(data.integration.notify_on_meeting)
          setNotifyOnMemberJoin(data.integration.notify_on_member_join)
          setNotifyOnMemberLeave(data.integration.notify_on_member_leave)
        }
      }
    } catch (error) {
      console.error('Error fetching org Slack integration:', error)
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchIntegration()
  }, [fetchIntegration])

  const handleSave = async () => {
    if (!accessToken.trim()) {
      toast.error('Access Token is required')
      return
    }

    if (!accessToken.startsWith('xoxb-') && !accessToken.startsWith('xoxp-') && !accessToken.startsWith('xoxe.xoxp-')) {
      toast.error('Please enter a valid Slack Access Token (starts with xoxb-, xoxp-, or xoxe.xoxp-)')
      return
    }

    if (!channelId.trim()) {
      toast.error('Channel ID is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/organizations/${organizationId}/slack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          channel_id: channelId,
          channel_name: channelName || null,
          notify_on_announcement: notifyOnAnnouncement,
          notify_on_meeting: notifyOnMeeting,
          notify_on_member_join: notifyOnMemberJoin,
          notify_on_member_leave: notifyOnMemberLeave,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save Slack integration')
      }

      setIntegration(data.integration)
      setIsEditing(false)
      toast.success('Slack integration configured successfully!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to save Slack integration')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack? You will stop receiving organization notifications.')) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/organizations/${organizationId}/slack`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect Slack')
      }

      setIntegration(null)
      setAccessToken('')
      setChannelId('')
      setChannelName('')
      setNotifyOnAnnouncement(true)
      setNotifyOnMeeting(true)
      setNotifyOnMemberJoin(true)
      setNotifyOnMemberLeave(true)
      toast.success('Slack disconnected successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect Slack')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (integration) {
      setAccessToken(integration.access_token || '')
      setChannelId(integration.channel_id || '')
      setChannelName(integration.channel_name || '')
      setNotifyOnAnnouncement(integration.notify_on_announcement)
      setNotifyOnMeeting(integration.notify_on_meeting)
      setNotifyOnMemberJoin(integration.notify_on_member_join)
      setNotifyOnMemberLeave(integration.notify_on_member_leave)
    } else {
      setAccessToken('')
      setChannelId('')
      setChannelName('')
    }
    setIsEditing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="spinner spinner-lg"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Slack Integration Card */}
      <div className="card">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#4A154B] rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Organization Slack Integration</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Get notified in Slack for announcements, meetings, and member changes
              </p>
            </div>
            {integration && !isEditing && (
              <span className="ml-auto px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                Connected
              </span>
            )}
          </div>

          {!integration && !isEditing ? (
            // Not connected state
            <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="w-16 h-16 mx-auto bg-[#4A154B]/10 dark:bg-[#4A154B]/20 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#4A154B] dark:text-[#E01E5A]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Connect to Slack</h4>
              <p className="text-gray-600 dark:text-gray-400 mb-2 max-w-sm mx-auto">
                Keep your organization in the loop! Get instant Slack notifications for announcements, meetings, and member updates.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Setup takes less than 2 minutes
              </p>
              {canManage ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4A154B] hover:bg-[#3e1240] text-white font-medium rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  Connect Slack
                </button>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">Only organization admins can configure integrations</p>
              )}
            </div>
          ) : isEditing ? (
            // Edit mode
            <div className="space-y-4">
              {/* Quick start banner */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Paste your Slack Access Token below. You can use the same token from your project integration or create a new app.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Access Token <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="xoxb-your-access-token"
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors font-mono text-sm"
                  />
                  {accessToken && (accessToken.startsWith('xoxb-') || accessToken.startsWith('xoxp-') || accessToken.startsWith('xoxe.xoxp-')) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Paste the Access Token you copied from Slack (starts with xoxb- or xoxp-)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Channel ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="C0123456789"
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors font-mono text-sm"
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Right-click on a channel in Slack, select "View channel details", then copy the Channel ID at the bottom
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Channel Name (optional)
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="#org-announcements"
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  For your reference only - helps you remember which channel is connected
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Notification Settings</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Choose what triggers notifications</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifyOnAnnouncement}
                      onChange={(e) => setNotifyOnAnnouncement(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white block">Announcements</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">When new announcements are posted</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifyOnMeeting}
                      onChange={(e) => setNotifyOnMeeting(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white block">Meetings</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">When meetings are scheduled</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifyOnMemberJoin}
                      onChange={(e) => setNotifyOnMemberJoin(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white block">Member Joined</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">When new members are added</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifyOnMemberLeave}
                      onChange={(e) => setNotifyOnMemberLeave(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white block">Member Left</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">When members leave the organization</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="btn btn-md btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !accessToken.trim() || !channelId.trim()}
                  className="btn btn-md btn-primary"
                >
                  {saving ? (
                    <>
                      <div className="spinner spinner-sm mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    'Save & Connect'
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Connected state - view mode
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Access Token</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    ****{integration?.access_token?.slice(-8) || '****'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Channel</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {integration?.channel_name || integration?.channel_id || 'Not specified'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className={`px-3 py-2 rounded-lg text-sm ${integration?.notify_on_announcement ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {integration?.notify_on_announcement ? '✓' : '✗'} Announcements
                </div>
                <div className={`px-3 py-2 rounded-lg text-sm ${integration?.notify_on_meeting ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {integration?.notify_on_meeting ? '✓' : '✗'} Meetings
                </div>
                <div className={`px-3 py-2 rounded-lg text-sm ${integration?.notify_on_member_join ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {integration?.notify_on_member_join ? '✓' : '✗'} Member Joined
                </div>
                <div className={`px-3 py-2 rounded-lg text-sm ${integration?.notify_on_member_leave ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {integration?.notify_on_member_leave ? '✓' : '✗'} Member Left
                </div>
              </div>

              {canManage && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleDisconnect}
                    disabled={saving}
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                  >
                    Disconnect
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    disabled={saving}
                    className="btn btn-md btn-secondary"
                  >
                    Edit Settings
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Setup Guide - only show when editing */}
      {isEditing && (
        <div className="card">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Need help setting up?</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              If you haven't created a Slack app yet, follow our step-by-step guide in the project Slack integration settings. You can use the same access token for both project and organization notifications.
            </p>
            <a
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open Slack API Apps
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
