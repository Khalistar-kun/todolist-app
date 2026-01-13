"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/AuthProvider'
import { ThemeToggleCompact } from '@/components/ui/ThemeToggle'
import { supabase } from '@/lib/supabase'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import toast from 'react-hot-toast'

const navigation = [
  { name: 'Dashboard', href: '/app', icon: HomeIcon },
  { name: 'Projects', href: '/app/projects', icon: FolderIcon },
  { name: 'My Tasks', href: '/app/tasks', icon: ChecklistIcon },
  { name: 'Team', href: '/app/team', icon: UsersIcon },
  { name: 'Organizations', href: '/app/organizations', icon: BuildingIcon },
]

interface SavedProfile {
  full_name: string | null
  avatar_url: string | null
}

interface NotificationData {
  project_id?: string
  project_name?: string
  task_id?: string
  task_title?: string
  organization_id?: string
  organization_name?: string
  meeting_id?: string
  announcement_id?: string
  old_stage?: string
  old_stage_name?: string
  new_stage?: string
  new_stage_name?: string
  moved_by?: string
  moved_by_name?: string
  moved_by_role?: string
}

interface Notification {
  id: string
  title: string
  message: string
  time: string
  read: boolean
  type: string
  data?: NotificationData
}

export function AppNavigation() {
  const { user, signOut } = useAuth()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [savedProfile, setSavedProfile] = useState<SavedProfile | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [hasNewNotification, setHasNewNotification] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const isInitialLoadRef = useRef(true)

  // Fetch notifications from database
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error fetching notifications:', error)
        return
      }

      if (data) {
        const formattedNotifications: Notification[] = data.map(n => ({
          id: n.id,
          title: n.title,
          message: n.message,
          time: n.created_at,
          read: n.read || n.is_read || false,
          type: n.type || 'info',
          data: n.data || undefined,
        }))
        setNotifications(formattedNotifications)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [user?.id])

  // Handle new notification arriving in real-time
  const handleNewNotification = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT' && payload.new) {
      const newNotif = payload.new
      // Add the new notification to the top of the list
      const formattedNotif: Notification = {
        id: newNotif.id,
        title: newNotif.title,
        message: newNotif.message,
        time: newNotif.created_at,
        read: newNotif.read || newNotif.is_read || false,
        type: newNotif.type || 'info',
        data: newNotif.data || undefined,
      }

      setNotifications(prev => {
        // Avoid duplicates
        if (prev.some(n => n.id === formattedNotif.id)) return prev
        return [formattedNotif, ...prev]
      })

      // Trigger pulse animation on bell icon
      setHasNewNotification(true)
      setTimeout(() => setHasNewNotification(false), 3000)

      // Show toast notification
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <BellIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formattedNotif.title}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {formattedNotif.message}
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      ), {
        duration: 5000,
        position: 'top-right',
      })
    }
  }, [])

  // Subscribe to real-time notification updates (only for INSERTs from other users)
  useRealtimeSubscription({
    subscriptions: [
      { table: 'notifications', filter: user?.id ? `user_id=eq.${user.id}` : undefined, event: 'INSERT' },
    ],
    onInsert: handleNewNotification,
    enabled: !!user?.id,
  })

  // Load saved profile from localStorage - runs on mount and when user changes
  const loadProfileFromStorage = (userId: string) => {
    const saved = localStorage.getItem(`profile-${userId}`)
    if (saved) {
      try {
        setSavedProfile(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading saved profile:', e)
      }
    } else {
      setSavedProfile(null)
    }
  }

  useEffect(() => {
    if (user?.id) {
      loadProfileFromStorage(user.id)
    }
  }, [user?.id])

  // Listen for profile updates (from same tab or other tabs)
  useEffect(() => {
    if (!user?.id) return

    const userId = user.id

    const handleProfileUpdate = () => {
      loadProfileFromStorage(userId)
    }

    window.addEventListener('storage', handleProfileUpdate)
    window.addEventListener('profile-updated', handleProfileUpdate)

    return () => {
      window.removeEventListener('storage', handleProfileUpdate)
      window.removeEventListener('profile-updated', handleProfileUpdate)
    }
  }, [user?.id])

  // Get display name (prefer saved profile, then user data)
  const displayName = savedProfile?.full_name || user?.full_name || user?.email?.split('@')[0] || 'User'
  const avatarUrl = savedProfile?.avatar_url || user?.avatar_url

  // Load notifications from database first, fallback to localStorage
  useEffect(() => {
    if (user?.id) {
      // Try to fetch from database first
      fetchNotifications().then(() => {
        isInitialLoadRef.current = false
      }).catch(() => {
        // Fallback to localStorage
        const savedNotifications = localStorage.getItem(`notifications-${user.id}`)
        const hasSeenWelcome = localStorage.getItem(`welcome-seen-${user.id}`)

        if (savedNotifications) {
          try {
            setNotifications(JSON.parse(savedNotifications))
          } catch (e) {
            console.error('Error loading notifications:', e)
            setNotifications([])
          }
        } else if (!hasSeenWelcome) {
          const defaultNotifications: Notification[] = [
            {
              id: '1',
              title: 'Welcome to TodoApp!',
              message: 'Start by creating your first project.',
              time: new Date().toISOString(),
              read: false,
              type: 'info'
            },
            {
              id: '2',
              title: 'Profile Setup',
              message: 'Complete your profile to personalize your experience.',
              time: new Date().toISOString(),
              read: false,
              type: 'info'
            }
          ]
          setNotifications(defaultNotifications)
          localStorage.setItem(`notifications-${user.id}`, JSON.stringify(defaultNotifications))
          localStorage.setItem(`welcome-seen-${user.id}`, 'true')
        } else {
          setNotifications([])
        }
        isInitialLoadRef.current = false
      })
    }
  }, [user?.id, fetchNotifications])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      // Use window.location for a hard redirect to ensure cookies are cleared
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
      // Force redirect anyway
      window.location.href = '/'
    }
  }

  const markAsRead = async (id: string) => {
    console.log('[Notification] markAsRead called with id:', id)

    // Optimistically update UI immediately
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n)
      console.log('[Notification] Updated notifications state:', updated.length)
      return updated
    })

    // Update in database (fire and forget for better UX)
    supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('[Notification] Error marking as read in DB:', error)
        } else {
          console.log('[Notification] Successfully marked as read in DB')
        }
      })
  }

  const markAllAsRead = async () => {
    console.log('[Notification] markAllAsRead called')

    // Optimistically update UI immediately
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))

    // Update all in database
    if (user?.id) {
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) {
            console.error('[Notification] Error marking all as read in DB:', error)
          } else {
            console.log('[Notification] Successfully marked all as read in DB')
          }
        })
    }
  }

  const clearNotification = async (id: string) => {
    console.log('[Notification] clearNotification called with id:', id)

    // Optimistically update UI immediately
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id)
      console.log('[Notification] Filtered notifications, remaining:', updated.length)
      return updated
    })

    // Delete from database (fire and forget for better UX)
    supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('[Notification] Error deleting from DB:', error)
        } else {
          console.log('[Notification] Successfully deleted from DB')
        }
      })
  }

  // Handle notification click - navigate to relevant page
  const handleNotificationClick = (notification: Notification) => {
    console.log('[Notification] Click handler:', notification.type, notification.data)

    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id)
    }

    // Close the dropdown
    setShowNotifications(false)

    // Navigate based on notification type and data
    const { type, data } = notification

    if (!data) {
      // No navigation data - just mark as read
      console.log('[Notification] No data for navigation')
      return
    }

    // Handle different notification types
    switch (type) {
      case 'task_moved':
      case 'task_assigned':
      case 'task_updated':
      case 'task_created':
      case 'task_completed':
      case 'deadline_reminder':
        // Navigate to the project board (task view)
        if (data.project_id) {
          router.push(`/app/projects/${data.project_id}`)
        }
        break

      case 'project_invite':
      case 'project_member_added':
        // Navigate to the project
        if (data.project_id) {
          router.push(`/app/projects/${data.project_id}`)
        }
        break

      case 'comment_added':
        // Navigate to the project where the comment was made
        if (data.project_id) {
          router.push(`/app/projects/${data.project_id}`)
        }
        break

      case 'organization_invite':
      case 'organization_member':
        // Navigate to the organization
        if (data.organization_id) {
          router.push(`/app/organizations/${data.organization_id}`)
        }
        break

      case 'meeting_scheduled':
      case 'meeting_reminder':
        // Navigate to the organization meetings
        if (data.organization_id) {
          router.push(`/app/organizations/${data.organization_id}`)
        }
        break

      case 'announcement':
        // Navigate to the organization
        if (data.organization_id) {
          router.push(`/app/organizations/${data.organization_id}`)
        }
        break

      default:
        // For unknown types, try to navigate based on available data
        if (data.project_id) {
          router.push(`/app/projects/${data.project_id}`)
        } else if (data.organization_id) {
          router.push(`/app/organizations/${data.organization_id}`)
        } else if (data.task_id) {
          router.push('/app/tasks')
        }
        break
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const isActive = (href: string) => {
    if (href === '/app') return pathname === '/app'
    return pathname.startsWith(href)
  }

  return (
    <nav className="sticky top-0 z-40 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Nav Links */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/app" className="flex items-center gap-2 group">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-105"
                style={{ background: 'var(--btn-primary-gradient)' }}
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>TodoApp</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      backgroundColor: active ? 'rgba(19, 151, 211, 0.1)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'
                        e.currentTarget.style.color = 'var(--text-primary)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'var(--text-secondary)'
                      }
                    }}
                  >
                    <span style={{ color: active ? 'var(--accent-primary)' : 'var(--icon-default)' }}>
                      <item.icon className="w-4 h-4" />
                    </span>
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <ThemeToggleCompact />

            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications)
                  setHasNewNotification(false)
                }}
                className={`relative p-2 rounded-lg transition-colors ${
                  hasNewNotification ? 'animate-bounce' : ''
                }`}
                style={{ color: 'var(--icon-default)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'
                  e.currentTarget.style.color = 'var(--icon-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--icon-default)'
                }}
              >
                <BellIcon className={`w-5 h-5 ${hasNewNotification ? 'text-[var(--accent-primary)]' : ''}`} />
                {unreadCount > 0 && (
                  <span
                    className={`absolute top-1 right-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center font-medium ${
                      hasNewNotification ? 'animate-ping-once' : ''
                    }`}
                    style={{ backgroundColor: 'var(--accent-danger)' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {hasNewNotification && (
                  <span
                    className="absolute top-1 right-1 w-4 h-4 rounded-full animate-ping"
                    style={{ backgroundColor: 'var(--accent-danger)' }}
                  ></span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden animate-scale-in">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <BellIcon className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                            !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                              notification.read ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  {formatTime(notification.time)}
                                </p>
                                {notification.data && (notification.data.project_id || notification.data.organization_id) && (
                                  <span className="inline-flex items-center text-xs text-blue-500 dark:text-blue-400">
                                    <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                    </svg>
                                    View
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {!notification.read && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    console.log('[Notification] Marking as read:', notification.id)
                                    markAsRead(notification.id)
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:text-gray-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 rounded transition-colors"
                                  title="Mark as read"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  console.log('[Notification] Deleting:', notification.id)
                                  clearNotification(notification.id)
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded transition-colors"
                                title="Remove"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <Link
                      href="/app/settings"
                      onClick={() => setShowNotifications(false)}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      Notification settings
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1 rounded-lg transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {avatarUrl ? (
                  avatarUrl.startsWith('data:') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <Image
                      src={avatarUrl}
                      alt={displayName}
                      width={32}
                      height={32}
                      className="rounded-full object-cover"
                      unoptimized
                    />
                  )
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ background: 'var(--btn-primary-gradient)' }}
                  >
                    {displayName[0].toUpperCase()}
                  </div>
                )}
                <span style={{ color: 'var(--icon-default)' }}>
                  <ChevronDownIcon
                    className={`hidden sm:block w-4 h-4 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>

              {/* Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg py-1 animate-scale-in">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/app/settings"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <SettingsIcon className="w-4 h-4 text-gray-400" />
                      Settings
                    </Link>
                    <Link
                      href="/app/profile"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      Your profile
                    </Link>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <LogoutIcon className="w-4 h-4 text-gray-400" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: 'var(--icon-default)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'
                e.currentTarget.style.color = 'var(--icon-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--icon-default)'
              }}
            >
              {showMobileMenu ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div
          className="md:hidden"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div className="px-4 py-3 space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: active ? 'rgba(19, 151, 211, 0.1)' : 'transparent',
                  }}
                >
                  <span style={{ color: active ? 'var(--accent-primary)' : 'var(--icon-default)' }}>
                    <item.icon className="w-5 h-5" />
                  </span>
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
}

// Icons
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )
}
