"use client"

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useThemeSafe } from '@/contexts/ThemeContext'
import { OrganizationSlackIntegration } from '@/components/organizations/OrganizationSlackIntegration'
import toast from 'react-hot-toast'

interface Settings {
  theme: string
  email_notifications: boolean
  push_notifications: boolean
  weekly_digest: boolean
  task_reminders: boolean
  language: string
  timezone: string
}

interface Organization {
  id: string
  name: string
  role: string
}

const defaultSettings: Settings = {
  theme: 'system',
  email_notifications: true,
  push_notifications: false,
  weekly_digest: false,
  task_reminders: true,
  language: 'en',
  timezone: 'UTC',
}

export default function SettingsPage() {
  const { user } = useAuth()
  const themeContext = useThemeSafe()
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [loaded, setLoaded] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loadingOrg, setLoadingOrg] = useState(true)

  // Load settings from API on mount
  const loadSettings = useCallback(async () => {
    if (!user) return

    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.preferences) {
          setSettings({
            theme: data.preferences.theme || 'system',
            email_notifications: data.preferences.email_notifications ?? true,
            push_notifications: data.preferences.push_notifications ?? false,
            weekly_digest: data.preferences.weekly_digest ?? false,
            task_reminders: data.preferences.task_reminders ?? true,
            language: data.preferences.language || 'en',
            timezone: data.preferences.timezone || 'UTC',
          })
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      // Fall back to localStorage
      const savedSettings = localStorage.getItem(`settings-${user.id}`)
      if (savedSettings) {
        try {
          setSettings(JSON.parse(savedSettings))
        } catch (e) {
          console.error('Error parsing saved settings:', e)
        }
      }
    } finally {
      setLoaded(true)
    }
  }, [user])

  // Load user's organization
  const loadOrganization = useCallback(async () => {
    if (!user) return

    try {
      setLoadingOrg(true)
      const response = await fetch('/api/organizations')
      if (response.ok) {
        const data = await response.json()
        if (data.organizations && data.organizations.length > 0) {
          // Use the first organization (user's primary org)
          setOrganization(data.organizations[0])
        }
      }
    } catch (error) {
      console.error('Error loading organization:', error)
    } finally {
      setLoadingOrg(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadSettings()
      loadOrganization()
    }
  }, [user, loadSettings, loadOrganization])

  const handleToggle = (key: keyof Settings) => {
    if (typeof settings[key] !== 'boolean') return

    const newValue = !settings[key]
    setSettings(prev => ({ ...prev, [key]: newValue }))

    // If enabling push notifications, request permission
    if (key === 'push_notifications' && newValue) {
      requestNotificationPermission()
    }
  }

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('This browser does not support push notifications')
      setSettings(prev => ({ ...prev, push_notifications: false }))
      return
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      toast.error('Notification permission denied')
      setSettings(prev => ({ ...prev, push_notifications: false }))
    } else {
      toast.success('Push notifications enabled')
    }
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      // Save settings to API (database)
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      // Also save to localStorage as backup
      localStorage.setItem(`settings-${user.id}`, JSON.stringify(settings))

      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }

    // TODO: Implement account deletion
    toast.error('Account deletion is not yet implemented. Please contact support.')
    setDeleteConfirm(false)
  }

  const isDark = themeContext?.theme === 'dark'

  if (!loaded) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="spinner spinner-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your account settings and preferences.</p>
        </div>

        {/* Appearance Section */}
        <div className="card mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Theme</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Choose your preferred theme</p>
                </div>
                {themeContext && (
                  <button
                    onClick={themeContext.toggleTheme}
                    className={`
                      relative inline-flex h-10 w-20 items-center rounded-full transition-colors
                      ${isDark ? 'bg-blue-600' : 'bg-gray-200'}
                    `}
                  >
                    <span className="sr-only">Toggle theme</span>
                    <span
                      className={`
                        inline-flex h-8 w-8 transform items-center justify-center rounded-full bg-white shadow-sm transition-transform
                        ${isDark ? 'translate-x-11' : 'translate-x-1'}
                      `}
                    >
                      {isDark ? (
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="4" />
                          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                        </svg>
                      )}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="card mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notifications</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Email Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive email updates about your tasks</p>
                </div>
                <button
                  onClick={() => handleToggle('email_notifications')}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${settings.email_notifications ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
                      ${settings.email_notifications ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Push Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive push notifications in your browser</p>
                </div>
                <button
                  onClick={() => handleToggle('push_notifications')}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${settings.push_notifications ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
                      ${settings.push_notifications ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Weekly Digest</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive a weekly summary of your activity</p>
                </div>
                <button
                  onClick={() => handleToggle('weekly_digest')}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${settings.weekly_digest ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
                      ${settings.weekly_digest ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Task Reminders</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Get reminded about upcoming task deadlines</p>
                </div>
                <button
                  onClick={() => handleToggle('task_reminders')}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${settings.task_reminders ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
                      ${settings.task_reminders ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Slack Integration Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Integrations</h2>
          {loadingOrg ? (
            <div className="card p-6">
              <div className="flex items-center justify-center h-32">
                <div className="spinner spinner-lg"></div>
              </div>
            </div>
          ) : organization ? (
            <OrganizationSlackIntegration
              organizationId={organization.id}
              canManage={organization.role === 'owner' || organization.role === 'admin'}
            />
          ) : (
            <div className="card p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                No organization found. Create an organization to configure Slack integration.
              </p>
            </div>
          )}
        </div>

        {/* Account Section */}
        <div className="card mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Email</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email || 'Not available'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Change Password</p>
                <a
                  href="/auth/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Reset your password
                </a>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                {deleteConfirm ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-red-600 dark:text-red-400">Are you sure?</span>
                    <button
                      onClick={handleDeleteAccount}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                    >
                      Yes, delete my account
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleDeleteAccount}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                    >
                      Delete Account
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Permanently delete your account and all associated data
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-md btn-primary"
          >
            {saving ? (
              <>
                <div className="spinner spinner-sm mr-2"></div>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
