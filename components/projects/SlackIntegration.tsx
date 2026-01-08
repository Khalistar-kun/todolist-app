"use client"

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

interface SlackIntegrationData {
  id: string
  project_id: string
  access_token: string | null
  channel_id: string | null
  channel_name: string | null
  notify_on_task_create: boolean
  notify_on_task_update: boolean
  notify_on_task_delete: boolean
  notify_on_task_move: boolean
  notify_on_task_complete: boolean
}

interface SlackIntegrationProps {
  projectId: string
  canManage: boolean
}

export function SlackIntegration({ projectId, canManage }: SlackIntegrationProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [integration, setIntegration] = useState<SlackIntegrationData | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Form state
  const [accessToken, setAccessToken] = useState('')
  const [channelId, setChannelId] = useState('')
  const [channelName, setChannelName] = useState('')
  const [notifyOnCreate, setNotifyOnCreate] = useState(true)
  const [notifyOnUpdate, setNotifyOnUpdate] = useState(true)
  const [notifyOnDelete, setNotifyOnDelete] = useState(true)
  const [notifyOnMove, setNotifyOnMove] = useState(true)
  const [notifyOnComplete, setNotifyOnComplete] = useState(true)

  const fetchIntegration = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/slack`)
      if (response.ok) {
        const data = await response.json()
        if (data.integration) {
          setIntegration(data.integration)
          setAccessToken(data.integration.access_token || '')
          setChannelId(data.integration.channel_id || '')
          setChannelName(data.integration.channel_name || '')
          setNotifyOnCreate(data.integration.notify_on_task_create)
          setNotifyOnUpdate(data.integration.notify_on_task_update)
          setNotifyOnDelete(data.integration.notify_on_task_delete)
          setNotifyOnMove(data.integration.notify_on_task_move)
          setNotifyOnComplete(data.integration.notify_on_task_complete)
        }
      }
    } catch (error) {
      console.error('Error fetching Slack integration:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

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
      const response = await fetch(`/api/projects/${projectId}/slack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          channel_id: channelId,
          channel_name: channelName || null,
          notify_on_task_create: notifyOnCreate,
          notify_on_task_update: notifyOnUpdate,
          notify_on_task_delete: notifyOnDelete,
          notify_on_task_move: notifyOnMove,
          notify_on_task_complete: notifyOnComplete,
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
    if (!confirm('Are you sure you want to disconnect Slack? You will stop receiving notifications.')) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/slack`, {
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
      setNotifyOnCreate(true)
      setNotifyOnUpdate(true)
      setNotifyOnDelete(true)
      setNotifyOnMove(true)
      setNotifyOnComplete(true)
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
      setNotifyOnCreate(integration.notify_on_task_create)
      setNotifyOnUpdate(integration.notify_on_task_update)
      setNotifyOnDelete(integration.notify_on_task_delete)
      setNotifyOnMove(integration.notify_on_task_move)
      setNotifyOnComplete(integration.notify_on_task_complete)
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Slack Integration</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Get notified in Slack when tasks are created, updated, or moved
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
                Keep your team in the loop! Get instant Slack notifications when tasks are created, updated, or completed.
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
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">Only project admins can configure integrations</p>
              )}
            </div>
          ) : isEditing ? (
            // Edit mode
            <div className="space-y-4">
              {/* Quick start banner */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Paste your Slack Access Token below. Follow the step-by-step guide to get your token.
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
                  placeholder="#project-updates"
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
                      checked={notifyOnCreate}
                      onChange={(e) => setNotifyOnCreate(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white block">Task Created</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">When someone adds a new task</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifyOnUpdate}
                      onChange={(e) => setNotifyOnUpdate(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white block">Task Updated</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">When task details change</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifyOnMove}
                      onChange={(e) => setNotifyOnMove(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white block">Task Moved</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Between workflow stages</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifyOnComplete}
                      onChange={(e) => setNotifyOnComplete(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white block">Task Completed</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">When tasks are marked done</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors sm:col-span-2 sm:w-1/2">
                    <input
                      type="checkbox"
                      checked={notifyOnDelete}
                      onChange={(e) => setNotifyOnDelete(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white block">Task Deleted</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">When tasks are removed</span>
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className={`px-3 py-2 rounded-lg text-sm ${integration?.notify_on_task_create ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {integration?.notify_on_task_create ? '✓' : '✗'} Task Created
                </div>
                <div className={`px-3 py-2 rounded-lg text-sm ${integration?.notify_on_task_update ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {integration?.notify_on_task_update ? '✓' : '✗'} Task Updated
                </div>
                <div className={`px-3 py-2 rounded-lg text-sm ${integration?.notify_on_task_move ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {integration?.notify_on_task_move ? '✓' : '✗'} Task Moved
                </div>
                <div className={`px-3 py-2 rounded-lg text-sm ${integration?.notify_on_task_complete ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {integration?.notify_on_task_complete ? '✓' : '✗'} Task Completed
                </div>
                <div className={`px-3 py-2 rounded-lg text-sm ${integration?.notify_on_task_delete ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {integration?.notify_on_task_delete ? '✓' : '✗'} Task Deleted
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

      {/* Step-by-Step Setup Guide */}
      <div className="card">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">How to set up Slack integration</h4>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Follow these simple steps to connect your Slack workspace. It only takes about 2 minutes!
          </p>

          {/* Step 1 */}
          <div className="mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-semibold text-sm">
                1
              </div>
              <div className="flex-1">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Open Slack API Apps page</h5>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Click the button below to open the Slack API page where you'll create your app.
                </p>
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A154B] hover:bg-[#3e1240] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                  Open Slack API
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-semibold text-sm">
                2
              </div>
              <div className="flex-1">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Create a new Slack App</h5>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  On the Slack API page:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Click <span className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Create New App</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Select <span className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">From scratch</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Enter a name (e.g., "TodoList Notifications")</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Select your workspace and click <span className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Create App</span></span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-semibold text-sm">
                3
              </div>
              <div className="flex-1">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Add Bot Permissions</h5>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  In your new app's settings:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Click <span className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">OAuth & Permissions</span> in the left sidebar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Scroll to <span className="font-medium text-gray-900 dark:text-white">Bot Token Scopes</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Click <span className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Add an OAuth Scope</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Add these scopes: <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">chat:write</code> and <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">chat:write.public</code></span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-semibold text-sm">
                4
              </div>
              <div className="flex-1">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Install App to Workspace</h5>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Still on the OAuth & Permissions page:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Scroll up and click <span className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Install to Workspace</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Click <span className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Allow</span></span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="mb-2">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center font-semibold text-sm">
                5
              </div>
              <div className="flex-1">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Copy your Access Token</h5>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  After installation, you'll see your Bot User OAuth Token. It looks like:
                </p>
                <code className="block text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 p-3 rounded-lg mb-3 overflow-x-auto">
                  xoxb-your-access-token-here
                </code>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Click <span className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Copy</span> and paste it in the Access Token field above!
                </p>
              </div>
            </div>
          </div>

          {/* Step 6 - Get Channel ID */}
          <div className="mb-2 mt-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center font-semibold text-sm">
                6
              </div>
              <div className="flex-1">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Get Channel ID</h5>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  In Slack, find the channel where you want notifications:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Right-click the channel name</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Select <span className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">View channel details</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>Scroll to the bottom and copy the <span className="font-medium text-gray-900 dark:text-white">Channel ID</span> (starts with C)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Quick tip */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Pro tip</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Create a dedicated channel like <span className="font-mono">#project-updates</span> for task notifications to keep them organized!
                </p>
              </div>
            </div>
          </div>

          {/* Need help */}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Need more help?{' '}
              <a
                href="https://api.slack.com/authentication/basics"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                View Slack's official guide
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Slash Commands Card - Only show when connected */}
      {integration && (
        <div className="card">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Slash Commands (Optional)</h4>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create tasks directly from Slack! Set up a slash command to use <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">/todolist create Buy groceries</code>
            </p>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Setup Instructions:</h5>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
                  <li>Go to your Slack app settings at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">api.slack.com/apps</a></li>
                  <li>Click on <span className="font-medium text-gray-900 dark:text-white">Slash Commands</span> in the sidebar</li>
                  <li>Click <span className="font-medium text-gray-900 dark:text-white">Create New Command</span></li>
                  <li>Set the command to <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">/todolist</code></li>
                  <li>Set the Request URL to:</li>
                </ol>
                <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded font-mono text-xs break-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/slack/commands` : '/api/slack/commands'}
                </div>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside mt-2" start={6}>
                  <li>Add a description like "Create and manage tasks"</li>
                  <li>Click <span className="font-medium text-gray-900 dark:text-white">Save</span></li>
                </ol>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Available Commands:</h5>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">/todolist create &lt;title&gt;</code> - Create a new task</li>
                  <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">/todolist list</code> - Show recent tasks</li>
                  <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">/todolist todo</code> - Show To Do tasks</li>
                  <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">/todolist doing</code> - Show In Progress tasks</li>
                  <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">/todolist done</code> - Show completed tasks</li>
                  <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">/todolist help</code> - Show help</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
