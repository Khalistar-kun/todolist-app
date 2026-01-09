"use client"

import { useRef, useEffect } from 'react'
import { MentionUser } from '@/hooks/useMentionAutocomplete'

interface MentionAutocompleteProps {
  users: MentionUser[]
  isLoading: boolean
  isOpen: boolean
  selectedIndex: number
  onSelect: (user: MentionUser) => void
  // Position relative to text input
  anchorRef?: React.RefObject<HTMLElement>
  // For positioning based on caret position
  caretPosition?: { top: number; left: number }
}

export function MentionAutocomplete({
  users,
  isLoading,
  isOpen,
  selectedIndex,
  onSelect,
  anchorRef,
  caretPosition,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && users.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, users.length])

  if (!isOpen) return null

  // Calculate position
  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
  }

  if (caretPosition) {
    style.top = caretPosition.top + 24 // Below the caret
    style.left = caretPosition.left
  } else if (anchorRef?.current) {
    const rect = anchorRef.current.getBoundingClientRect()
    style.top = rect.bottom + 4
    style.left = rect.left
  }

  return (
    <div
      ref={listRef}
      style={style}
      className="w-64 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
    >
      {isLoading ? (
        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
          Searching...
        </div>
      ) : users.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          No users found
        </div>
      ) : (
        users.map((user, index) => (
          <button
            key={user.id}
            onClick={() => onSelect(user)}
            className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
              index === selectedIndex
                ? 'bg-blue-50 dark:bg-blue-900/30'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center overflow-hidden">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name || user.email || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {(user.full_name || user.email || 'U')[0].toUpperCase()}
                </span>
              )}
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.full_name || user.email || 'Unknown user'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                @{user.mention_handle}
              </div>
            </div>
          </button>
        ))
      )}

      {/* Keyboard hint */}
      {users.length > 0 && (
        <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">↑↓</kbd>
          <span>navigate</span>
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] ml-2">Enter</kbd>
          <span>select</span>
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] ml-2">Esc</kbd>
          <span>close</span>
        </div>
      )}
    </div>
  )
}

/**
 * Component to render text with highlighted mentions
 */
interface MentionTextProps {
  text: string
  onMentionClick?: (username: string) => void
  className?: string
}

export function MentionText({ text, onMentionClick, className = '' }: MentionTextProps) {
  // Simple regex to find mentions
  const parts = text.split(/(@[a-zA-Z0-9_.-]+)/g)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const username = part.slice(1)
          return (
            <span
              key={index}
              onClick={() => onMentionClick?.(username)}
              className={`text-blue-600 dark:text-blue-400 font-medium ${
                onMentionClick ? 'cursor-pointer hover:underline' : ''
              }`}
            >
              {part}
            </span>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </span>
  )
}
