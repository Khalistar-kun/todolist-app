"use client"

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'

interface NotificationData {
  id: string
  title: string
  message: string
  type: string
  data?: {
    project_id?: string
    project_name?: string
    task_id?: string
    task_title?: string
    moved_by_name?: string
    moved_by_role?: string
    old_stage_name?: string
    new_stage_name?: string
  }
}

export function NotificationBanner() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [isVisible, setIsVisible] = useState(false)

  const handleNewNotification = useCallback((payload: any) => {
    console.log('[NotificationBanner] Received payload:', payload)
    if (payload.eventType === 'INSERT' && payload.new) {
      const newNotif = payload.new as NotificationData
      console.log('[NotificationBanner] New notification:', newNotif)

      setNotifications(prev => {
        // Avoid duplicates
        if (prev.some(n => n.id === newNotif.id)) return prev
        return [newNotif, ...prev]
      })
      setIsVisible(true)

      // Auto-hide after 8 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id))
      }, 8000)
    }
  }, [])

  // Subscribe to real-time notifications
  useRealtimeSubscription({
    subscriptions: [
      { table: 'notifications', filter: user?.id ? `user_id=eq.${user.id}` : undefined, event: 'INSERT' },
    ],
    onInsert: handleNewNotification,
    enabled: !!user?.id,
  })

  // Hide when no notifications
  useEffect(() => {
    if (notifications.length === 0) {
      setIsVisible(false)
    }
  }, [notifications])

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const dismissAll = () => {
    setNotifications([])
    setIsVisible(false)
  }

  if (!isVisible || notifications.length === 0) return null

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <div className="space-y-2">
        {notifications.map((notif, index) => (
          <div
            key={notif.id}
            className="animate-slide-down bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Colored top bar based on notification type */}
            <div className={`h-1 ${
              notif.type === 'task_moved' ? 'bg-blue-500' :
              notif.type === 'new_announcement' ? 'bg-purple-500' :
              notif.type === 'new_meeting' ? 'bg-green-500' :
              'bg-gray-500'
            }`} />

            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  notif.type === 'task_moved' ? 'bg-blue-100 dark:bg-blue-900/50' :
                  notif.type === 'new_announcement' ? 'bg-purple-100 dark:bg-purple-900/50' :
                  notif.type === 'new_meeting' ? 'bg-green-100 dark:bg-green-900/50' :
                  'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {notif.type === 'task_moved' ? (
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                  ) : notif.type === 'new_announcement' ? (
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {notif.title}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {notif.message}
                  </p>

                  {/* Additional details for task_moved */}
                  {notif.type === 'task_moved' && notif.data && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {notif.data.old_stage_name}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
                        {notif.data.new_stage_name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Close button */}
                <button
                  onClick={() => dismissNotification(notif.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Dismiss all button when multiple notifications */}
        {notifications.length > 1 && (
          <div className="text-center">
            <button
              onClick={dismissAll}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Dismiss all
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
