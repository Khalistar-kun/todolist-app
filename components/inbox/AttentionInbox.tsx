"use client"

import { useState, useEffect, useCallback } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

interface AttentionItem {
  id: string
  attention_type: 'mention' | 'assignment' | 'due_soon' | 'overdue' | 'comment' | 'status_change' | 'unassignment'
  priority: 'urgent' | 'high' | 'normal' | 'low'
  title: string
  body: string | null
  read_at: string | null
  created_at: string
  task_id: string | null
  project_id: string | null
  task?: {
    id: string
    title: string
    status: string
    priority: string
  }
  project?: {
    id: string
    name: string
  }
  actor?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

type FilterType = 'all' | 'unread' | 'mentions' | 'assignments'

interface AttentionInboxProps {
  onItemClick?: (item: AttentionItem) => void
  className?: string
}

export function AttentionInbox({ onItemClick, className = '' }: AttentionInboxProps) {
  const [items, setItems] = useState<AttentionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/inbox?filter=${filter}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to fetch inbox')

      setItems(data.items || [])
      setUnreadCount(data.unread_count || 0)
    } catch (error) {
      console.error('[AttentionInbox] Error fetching items:', error)
      toast.error('Failed to load inbox')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const markAsRead = async (itemId: string) => {
    try {
      const response = await fetch('/api/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', item_id: itemId }),
      })

      if (!response.ok) throw new Error('Failed to mark as read')

      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, read_at: new Date().toISOString() } : item
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('[AttentionInbox] Error marking as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })

      if (!response.ok) throw new Error('Failed to mark all as read')

      setItems((prev) =>
        prev.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() }))
      )
      setUnreadCount(0)
      toast.success('All items marked as read')
    } catch (error) {
      console.error('[AttentionInbox] Error marking all as read:', error)
      toast.error('Failed to mark all as read')
    }
  }

  const dismissItem = async (itemId: string) => {
    try {
      const response = await fetch('/api/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', item_id: itemId }),
      })

      if (!response.ok) throw new Error('Failed to dismiss')

      setItems((prev) => prev.filter((item) => item.id !== itemId))
    } catch (error) {
      console.error('[AttentionInbox] Error dismissing item:', error)
      toast.error('Failed to dismiss')
    }
  }

  const handleItemClick = (item: AttentionItem) => {
    if (!item.read_at) {
      markAsRead(item.id)
    }
    onItemClick?.(item)
  }

  const getTypeIcon = (type: AttentionItem['attention_type']) => {
    switch (type) {
      case 'mention':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" />
          </svg>
        )
      case 'assignment':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        )
      case 'comment':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )
      case 'due_soon':
      case 'overdue':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'status_change':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        )
    }
  }

  const getTypeColor = (type: AttentionItem['attention_type'], priority: AttentionItem['priority']) => {
    if (priority === 'urgent') return 'text-red-500 bg-red-50 dark:bg-red-900/20'
    if (priority === 'high') return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20'

    switch (type) {
      case 'mention':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
      case 'assignment':
        return 'text-purple-500 bg-purple-50 dark:bg-purple-900/20'
      case 'comment':
        return 'text-green-500 bg-green-50 dark:bg-green-900/20'
      default:
        return 'text-gray-500 bg-gray-50 dark:bg-gray-700/50'
    }
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'mentions', label: '@Mentions' },
    { key: 'assignments', label: 'Assignments' },
  ]

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            Inbox
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-center">
              {filter === 'all'
                ? "You're all caught up!"
                : `No ${filter === 'unread' ? 'unread items' : filter} to show`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                  !item.read_at ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg flex-shrink-0 ${getTypeColor(item.attention_type, item.priority)}`}>
                    {getTypeIcon(item.attention_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!item.read_at && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                      <h3 className={`text-sm truncate ${!item.read_at ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                        {item.title}
                      </h3>
                    </div>

                    {item.body && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-1">
                        {item.body}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                      {item.project && (
                        <>
                          <span className="truncate max-w-[120px]">{item.project.name}</span>
                          <span>·</span>
                        </>
                      )}
                      <span title={format(new Date(item.created_at), 'PPp')}>
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {/* Dismiss button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      dismissItem(item.id)
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Dismiss"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Compact inbox button with badge for navigation
 */
interface InboxButtonProps {
  onClick?: () => void
  className?: string
}

export function InboxButton({ onClick, className = '' }: InboxButtonProps) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch('/api/inbox?filter=unread&limit=1')
        const data = await response.json()
        setUnreadCount(data.unread_count || 0)
      } catch (error) {
        console.error('[InboxButton] Error fetching count:', error)
      }
    }

    fetchCount()
    // Poll every 60 seconds
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <button
      onClick={onClick}
      className={`relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors ${className}`}
      title="Inbox"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
