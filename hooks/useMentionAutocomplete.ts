import { useState, useCallback, useRef, useEffect } from 'react'
import { getCurrentMention, replaceMention } from '@/lib/mentions/parser'

export interface MentionUser {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  mention_handle: string
}

interface UseMentionAutocompleteOptions {
  projectId?: string
  onMentionSelect?: (user: MentionUser) => void
  debounceMs?: number
}

interface UseMentionAutocompleteReturn {
  // State
  users: MentionUser[]
  isLoading: boolean
  isOpen: boolean
  selectedIndex: number
  query: string

  // Actions
  handleTextChange: (text: string, cursorPosition: number) => void
  handleKeyDown: (e: React.KeyboardEvent) => boolean // Returns true if event was handled
  selectUser: (user: MentionUser) => { text: string; newCursorPosition: number } | null
  close: () => void

  // For positioning
  mentionStartIndex: number | null
}

export function useMentionAutocomplete(
  text: string,
  options: UseMentionAutocompleteOptions = {}
): UseMentionAutocompleteReturn {
  const { projectId, onMentionSelect, debounceMs = 200 } = options

  const [users, setUsers] = useState<MentionUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null)
  const [cursorPos, setCursorPos] = useState(0)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch users from API
  const fetchUsers = useCallback(
    async (searchQuery: string) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()

      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          limit: '10',
        })
        if (projectId) {
          params.set('project_id', projectId)
        }

        const response = await fetch(`/api/mentions/users?${params}`, {
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to fetch users')
        }

        const data = await response.json()
        setUsers(data.users || [])
        setSelectedIndex(0)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('[useMentionAutocomplete] Error fetching users:', error)
          setUsers([])
        }
      } finally {
        setIsLoading(false)
      }
    },
    [projectId]
  )

  // Handle text changes
  const handleTextChange = useCallback(
    (newText: string, cursorPosition: number) => {
      setCursorPos(cursorPosition)
      const mention = getCurrentMention(newText, cursorPosition)

      if (mention) {
        setIsOpen(true)
        setQuery(mention.query)
        setMentionStartIndex(mention.startIndex)

        // Debounce the API call
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }
        debounceRef.current = setTimeout(() => {
          fetchUsers(mention.query)
        }, debounceMs)
      } else {
        setIsOpen(false)
        setQuery('')
        setMentionStartIndex(null)
        setUsers([])
      }
    },
    [fetchUsers, debounceMs]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen || users.length === 0) {
        return false
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % users.length)
          return true

        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + users.length) % users.length)
          return true

        case 'Enter':
        case 'Tab':
          e.preventDefault()
          const selectedUser = users[selectedIndex]
          if (selectedUser && mentionStartIndex !== null) {
            const result = replaceMention(text, mentionStartIndex, cursorPos, selectedUser.mention_handle)
            onMentionSelect?.(selectedUser)
            setIsOpen(false)
            return true
          }
          return false

        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          return true

        default:
          return false
      }
    },
    [isOpen, users, selectedIndex, text, mentionStartIndex, cursorPos, onMentionSelect]
  )

  // Select a user (for click selection)
  const selectUser = useCallback(
    (user: MentionUser): { text: string; newCursorPosition: number } | null => {
      if (mentionStartIndex === null) return null

      const result = replaceMention(text, mentionStartIndex, cursorPos, user.mention_handle)
      onMentionSelect?.(user)
      setIsOpen(false)
      return result
    },
    [text, mentionStartIndex, cursorPos, onMentionSelect]
  )

  // Close autocomplete
  const close = useCallback(() => {
    setIsOpen(false)
    setUsers([])
    setQuery('')
    setMentionStartIndex(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    users,
    isLoading,
    isOpen,
    selectedIndex,
    query,
    handleTextChange,
    handleKeyDown,
    selectUser,
    close,
    mentionStartIndex,
  }
}
