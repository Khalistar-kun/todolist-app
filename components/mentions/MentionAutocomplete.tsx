"use client"

import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MentionUser } from '@/hooks/useMentionAutocomplete'

interface MentionAutocompleteProps {
  users: MentionUser[]
  isLoading: boolean
  isOpen: boolean
  selectedIndex: number
  onSelect: (user: MentionUser) => void
  // Position relative to text input
  anchorRef?: React.RefObject<HTMLElement | null>
  // For positioning based on caret position
  caretPosition?: { top: number; left: number }
  // Ref to expose dropdown element for outside-click detection
  dropdownRef?: React.RefObject<HTMLDivElement | null>
}

export function MentionAutocomplete({
  users,
  isLoading,
  isOpen,
  selectedIndex,
  onSelect,
  anchorRef,
  caretPosition,
  dropdownRef,
}: MentionAutocompleteProps) {
  const internalRef = useRef<HTMLDivElement>(null)
  const listRef = dropdownRef || internalRef
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate position when anchor changes or dropdown opens
  useEffect(() => {
    if (!isOpen) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      if (caretPosition) {
        setPosition({
          top: caretPosition.top + 24,
          left: caretPosition.left,
        })
      } else if (anchorRef?.current) {
        const rect = anchorRef.current.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const dropdownWidth = 256 // w-64
        const dropdownHeight = 320 // max-h-80

        // Position below the input
        let top = rect.bottom + 4
        let left = rect.left

        // Ensure dropdown doesn't overflow right edge
        if (left + dropdownWidth > viewportWidth - 16) {
          left = Math.max(16, viewportWidth - dropdownWidth - 16)
        }

        // Ensure dropdown doesn't overflow bottom - position above if needed
        if (top + dropdownHeight > viewportHeight - 16) {
          top = Math.max(16, rect.top - dropdownHeight - 4)
        }

        // Ensure left doesn't go negative
        if (left < 16) left = 16

        setPosition({ top, left })
      }
    }

    updatePosition()

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, anchorRef, caretPosition])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && users.length > 0) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, users.length])

  if (!isOpen || !mounted || !position) return null

  const dropdown = (
    <div
      ref={listRef}
      data-mention-dropdown="true"
      data-radix-focus-guard=""
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 99999,
        pointerEvents: 'auto',
      }}
      className="w-64 max-h-80 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
      onMouseDown={(e) => {
        // CRITICAL: Prevent blur on input and stop propagation to parent handlers
        e.preventDefault()
        e.stopPropagation()
      }}
      onPointerDown={(e) => {
        // Also prevent pointer events from bubbling (for Radix Dialog compatibility)
        e.stopPropagation()
      }}
      onClick={(e) => {
        // Stop click from bubbling to outside-click handlers
        e.stopPropagation()
      }}
    >
      {isLoading ? (
        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
          Searching for users...
        </div>
      ) : users.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          No matching users found
        </div>
      ) : (
        <>
          {users.map((user, index) => (
            <button
              key={user.id}
              data-index={index}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect(user)
              }}
              onMouseDown={(e) => {
                // Prevent blur and any parent mousedown handlers
                e.preventDefault()
                e.stopPropagation()
              }}
              onPointerDown={(e) => {
                // Prevent Radix Dialog focus trapping interference
                e.preventDefault()
                e.stopPropagation()
              }}
              className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
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
          ))}

          {/* Keyboard hint */}
          <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Enter</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Esc</kbd>
              close
            </span>
          </div>
        </>
      )}
    </div>
  )

  // Use portal to render outside modal/scroll containers
  return createPortal(dropdown, document.body)
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
