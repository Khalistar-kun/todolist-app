"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { AITaskService, TaskSuggestion } from '@/lib/services/AITaskService'

interface AISuggestionsProps {
  projectId: string
  projectName?: string
  onActionClick?: (action: TaskSuggestion['action']) => void
  useEnhancedAI?: boolean
}

interface Position {
  x: number
  y: number
}

// Storage key for persisting position
const POSITION_STORAGE_KEY = 'ai-insights-fab-position'

// Get initial position from localStorage or default
function getInitialPosition(): Position | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(POSITION_STORAGE_KEY)
    if (stored) {
      const pos = JSON.parse(stored)
      // Validate position is within viewport
      if (pos.x >= 0 && pos.y >= 0 && pos.x <= window.innerWidth - 56 && pos.y <= window.innerHeight - 56) {
        return pos
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

const SEVERITY_STYLES = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-800 dark:text-blue-200',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
    text: 'text-amber-800 dark:text-amber-200',
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    text: 'text-red-800 dark:text-red-200',
  },
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  overdue_reminder: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  workload_balance: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  ),
  dependency_blocker: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  similar_task: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  ),
  priority_adjustment: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21l3.75-3.75" />
    </svg>
  ),
  deadline_warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
}

export function AISuggestions({ projectId, projectName, onActionClick, useEnhancedAI = true }: AISuggestionsProps) {
  // ============================================================================
  // ALL HOOKS MUST BE DECLARED UNCONDITIONALLY AT THE TOP
  // ============================================================================

  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Drag state
  const [position, setPosition] = useState<Position | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hasMoved, setHasMoved] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  // ============================================================================
  // MEMOIZED VALUES (also hooks, must be unconditional)
  // ============================================================================

  const visibleSuggestions = useMemo(() => {
    return suggestions.filter(s => !dismissed.has(s.id))
  }, [suggestions, dismissed])

  const criticalCount = useMemo(() => {
    return visibleSuggestions.filter(s => s.severity === 'critical').length
  }, [visibleSuggestions])

  const warningCount = useMemo(() => {
    return visibleSuggestions.filter(s => s.severity === 'warning').length
  }, [visibleSuggestions])

  // ============================================================================
  // ALL CALLBACKS (hooks, must be unconditional)
  // ============================================================================

  // Get current position or default bottom-right
  const getCurrentPosition = useCallback(() => {
    if (position) {
      return { right: 'auto' as const, bottom: 'auto' as const, left: position.x, top: position.y }
    }
    // Default position
    return { right: 16, bottom: 80, left: 'auto' as const, top: 'auto' as const }
  }, [position])

  // Compute panel position based on FAB location
  const getPanelPosition = useCallback(() => {
    if (!position) {
      // Default: panel opens above and to the left
      return 'bottom-16 sm:bottom-18 right-0'
    }

    // Check if panel would go off-screen and adjust
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768

    // Determine horizontal position
    const openLeft = position.x > viewportWidth / 2

    // Determine vertical position
    const openAbove = position.y > viewportHeight / 2

    const classes = []
    if (openAbove) {
      classes.push('bottom-16 sm:bottom-18')
    } else {
      classes.push('top-16 sm:top-18')
    }
    if (openLeft) {
      classes.push('right-0')
    } else {
      classes.push('left-0')
    }

    return classes.join(' ')
  }, [position])

  const getBadgeColor = useCallback(() => {
    if (criticalCount > 0) return 'bg-red-500'
    if (warningCount > 0) return 'bg-amber-500'
    return 'bg-purple-500'
  }, [criticalCount, warningCount])

  // Handle dismiss
  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => new Set([...prev, id]))
  }, [])

  // Reset position to default
  const handleResetPosition = useCallback(() => {
    setPosition(null)
    localStorage.removeItem(POSITION_STORAGE_KEY)
  }, [])

  // Handle click - only toggle if we haven't moved
  const handleClick = useCallback(() => {
    if (!hasMoved) {
      setIsOpen(prev => !prev)
    }
    setHasMoved(false)
  }, [hasMoved])

  // Mouse move handler (declared before mouseDown which references it)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStartRef.current) return

    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    // Only start dragging if moved more than 5px (to distinguish from click)
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setIsDragging(true)
      setHasMoved(true)

      // Calculate new position
      let newX = dragStartRef.current.posX + deltaX
      let newY = dragStartRef.current.posY + deltaY

      // Constrain to viewport
      const fabSize = 56 // 14 * 4 = 56px on desktop
      newX = Math.max(0, Math.min(window.innerWidth - fabSize, newX))
      newY = Math.max(0, Math.min(window.innerHeight - fabSize, newY))

      setPosition({ x: newX, y: newY })
    }
  }, [])

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    dragStartRef.current = null
    setIsDragging(false)
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseMove])

  // Handle drag start (mouse)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isOpen) return // Don't drag when panel is open

    const fabElement = fabRef.current
    if (!fabElement) return

    const rect = fabElement.getBoundingClientRect()
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: rect.left,
      posY: rect.top,
    }
    setHasMoved(false)

    // Add listeners for drag
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [isOpen, handleMouseMove, handleMouseUp])

  // Handle drag start (touch)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isOpen) return

    const fabElement = fabRef.current
    if (!fabElement) return

    const touch = e.touches[0]
    const rect = fabElement.getBoundingClientRect()

    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      posX: rect.left,
      posY: rect.top,
    }
    setHasMoved(false)
  }, [isOpen])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStartRef.current) return

    const touch = e.touches[0]
    const deltaX = touch.clientX - dragStartRef.current.x
    const deltaY = touch.clientY - dragStartRef.current.y

    // Only start dragging if moved more than 10px
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      setIsDragging(true)
      setHasMoved(true)
      e.preventDefault() // Prevent scroll while dragging

      // Calculate new position
      let newX = dragStartRef.current.posX + deltaX
      let newY = dragStartRef.current.posY + deltaY

      // Constrain to viewport
      const fabSize = 48 // 12 * 4 = 48px on mobile
      newX = Math.max(0, Math.min(window.innerWidth - fabSize, newX))
      newY = Math.max(0, Math.min(window.innerHeight - fabSize, newY))

      setPosition({ x: newX, y: newY })
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    dragStartRef.current = null
    setIsDragging(false)
  }, [])

  // ============================================================================
  // ALL EFFECTS (hooks, must be unconditional)
  // ============================================================================

  // Initialize position from localStorage on mount
  useEffect(() => {
    const savedPos = getInitialPosition()
    if (savedPos) {
      setPosition(savedPos)
    }
  }, [])

  // Save position to localStorage when it changes
  useEffect(() => {
    if (position) {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position))
    }
  }, [position])

  // Fetch suggestions (enhanced with AI if available)
  useEffect(() => {
    let cancelled = false

    async function fetchSuggestions() {
      setLoading(true)
      try {
        // Use enhanced AI insights if enabled and project name is provided
        const data = useEnhancedAI && projectName
          ? await AITaskService.getEnhancedInsights(projectId, projectName)
          : await AITaskService.getProjectSuggestions(projectId)
        if (!cancelled) {
          setSuggestions(data)
        }
      } catch (error) {
        console.error('Error fetching AI suggestions:', error)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchSuggestions()

    return () => {
      cancelled = true
    }
  }, [projectId, projectName, useEnhancedAI])

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    // Close on escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // ============================================================================
  // EARLY RETURNS - ONLY AFTER ALL HOOKS
  // ============================================================================

  // Don't render if no suggestions and not loading
  if (!loading && visibleSuggestions.length === 0) {
    return null
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  const positionStyle = getCurrentPosition()

  return (
    <div
      ref={panelRef}
      className="fixed z-40"
      style={{
        left: positionStyle.left,
        top: positionStyle.top,
        right: positionStyle.right !== 'auto' ? positionStyle.right : undefined,
        bottom: positionStyle.bottom !== 'auto' ? positionStyle.bottom : undefined,
      }}
    >
      {/* Floating Action Button - Draggable */}
      <button
        ref={fabRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg flex items-center justify-center tap-highlight-none select-none ${
          isDragging
            ? 'scale-110 shadow-2xl cursor-grabbing'
            : isOpen
              ? 'bg-purple-700 cursor-pointer'
              : 'bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:scale-105 cursor-grab'
        } ${!isDragging ? 'transition-all duration-300' : ''}`}
        style={{
          background: isDragging ? 'linear-gradient(to bottom right, #7c3aed, #2563eb)' : undefined,
        }}
        aria-label="AI Insights"
      >
        {/* Sparkle Icon */}
        <svg
          className={`w-6 h-6 sm:w-7 sm:h-7 text-white transition-transform duration-300 ${isOpen ? 'rotate-180 scale-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          )}
        </svg>

        {/* Badge with count */}
        {!isOpen && visibleSuggestions.length > 0 && (
          <span className={`absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 ${getBadgeColor()} rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md animate-pulse`}>
            {visibleSuggestions.length}
          </span>
        )}
      </button>

      {/* Quest Panel */}
      {isOpen && (
        <div className={`absolute ${getPanelPosition()} w-80 sm:w-96 max-h-[70vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span className="font-semibold text-white">AI Insights</span>
              {/* Reset position button */}
              {position && (
                <button
                  onClick={handleResetPosition}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title="Reset position"
                >
                  <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                </button>
              )}
              <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-white/20 text-white rounded-full">
                {visibleSuggestions.length} {visibleSuggestions.length === 1 ? 'quest' : 'quests'}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[calc(70vh-52px)] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {visibleSuggestions.map(suggestion => {
                  const styles = SEVERITY_STYLES[suggestion.severity]

                  return (
                    <div
                      key={suggestion.id}
                      className={`p-3 rounded-lg border ${styles.bg} ${styles.border} transition-all hover:shadow-md`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>
                          {TYPE_ICONS[suggestion.type] || TYPE_ICONS.deadline_warning}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium text-sm ${styles.text}`}>
                            {suggestion.title}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {suggestion.description}
                          </p>

                          {/* Action Button */}
                          {suggestion.action && (
                            <button
                              onClick={() => {
                                onActionClick?.(suggestion.action)
                                setIsOpen(false)
                              }}
                              className="mt-2 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors tap-highlight-none touch-target"
                            >
                              {suggestion.action.label}
                            </button>
                          )}
                        </div>

                        {/* Dismiss Button */}
                        <button
                          onClick={() => handleDismiss(suggestion.id)}
                          className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors tap-highlight-none"
                          title="Dismiss"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Empty state after all dismissed */}
                {visibleSuggestions.length === 0 && (
                  <div className="py-8 text-center">
                    <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-gray-500 dark:text-gray-400">All caught up!</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">No pending insights</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
