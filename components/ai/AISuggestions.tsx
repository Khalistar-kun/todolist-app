"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { AITaskService, TaskSuggestion } from '@/lib/services/AITaskService'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import toast from 'react-hot-toast'

interface ProjectMember {
  id: string
  user_id: string
  profile?: {
    full_name?: string
    avatar_url?: string
  }
}

interface VoiceTaskData {
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  assignee_ids?: string[]
}

type VoiceWizardStep = 'idle' | 'title' | 'description' | 'priority' | 'due_date' | 'assignees' | 'confirm'

interface AISuggestionsProps {
  projectId: string
  projectName?: string
  onActionClick?: (action: TaskSuggestion['action']) => void
  onCreateTask?: (task: VoiceTaskData) => void
  useEnhancedAI?: boolean
  members?: ProjectMember[]
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

export function AISuggestions({ projectId, projectName, onActionClick, onCreateTask, useEnhancedAI = true, members = [] }: AISuggestionsProps) {
  // ============================================================================
  // ALL HOOKS MUST BE DECLARED UNCONDITIONALLY AT THE TOP
  // ============================================================================

  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Voice wizard state
  const [wizardStep, setWizardStep] = useState<VoiceWizardStep>('idle')
  const [taskData, setTaskData] = useState<VoiceTaskData>({ title: '' })
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])

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

  // Wizard step prompts
  const STEP_PROMPTS: Record<VoiceWizardStep, string> = {
    idle: 'Tap mic to start creating a task',
    title: 'What is the task title?',
    description: 'Add a description (or say "skip")',
    priority: 'Priority? (low, medium, high, urgent, or skip)',
    due_date: 'When is it due? (e.g., "tomorrow", "next Friday", or "skip")',
    assignees: 'Who should be assigned? (say name or "skip")',
    confirm: 'Review and confirm your task',
  }

  // Parse date from voice input
  const parseDateFromVoice = useCallback(async (text: string): Promise<string | undefined> => {
    const lowerText = text.toLowerCase()
    if (lowerText === 'skip' || lowerText === 'no' || lowerText === 'none') {
      return undefined
    }

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          messages: [
            {
              role: 'system',
              content: `Convert the time reference to an ISO date string (YYYY-MM-DD format). Today is ${new Date().toISOString().split('T')[0]}.
Examples:
- "tomorrow" -> "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}"
- "next week" -> "${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}"
- "in 3 days" -> "${new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]}"
Only return the date in YYYY-MM-DD format, nothing else. If you cannot parse the date, return "INVALID".`
            },
            { role: 'user', content: text }
          ]
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const dateStr = data.response?.trim()
        if (dateStr && dateStr !== 'INVALID' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr
        }
      }
    } catch (error) {
      console.error('[VoiceInput] Date parsing error:', error)
    }
    return undefined
  }, [])

  // Find member by name
  const findMemberByName = useCallback((name: string): ProjectMember | undefined => {
    const lowerName = name.toLowerCase()
    return members.find(m =>
      m.profile?.full_name?.toLowerCase().includes(lowerName)
    )
  }, [members])

  // Process voice input based on current wizard step
  const processWizardStep = useCallback(async (text: string) => {
    const lowerText = text.toLowerCase().trim()
    const isSkip = lowerText === 'skip' || lowerText === 'no' || lowerText === 'none' || lowerText === 'next'

    switch (wizardStep) {
      case 'title':
        setTaskData(prev => ({ ...prev, title: text }))
        setWizardStep('description')
        toast.success(`Title: "${text}"`)
        break

      case 'description':
        if (!isSkip) {
          setTaskData(prev => ({ ...prev, description: text }))
          toast.success('Description added')
        }
        setWizardStep('priority')
        break

      case 'priority':
        if (!isSkip) {
          const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
            'low': 'low',
            'medium': 'medium',
            'high': 'high',
            'urgent': 'urgent',
            'critical': 'urgent',
          }
          const priority = priorityMap[lowerText] || 'medium'
          setTaskData(prev => ({ ...prev, priority }))
          toast.success(`Priority: ${priority}`)
        }
        setWizardStep('due_date')
        break

      case 'due_date':
        if (!isSkip) {
          setIsProcessingVoice(true)
          const dueDate = await parseDateFromVoice(text)
          setIsProcessingVoice(false)
          if (dueDate) {
            setTaskData(prev => ({ ...prev, due_date: dueDate }))
            toast.success(`Due: ${dueDate}`)
          }
        }
        if (members.length > 0) {
          setWizardStep('assignees')
        } else {
          setWizardStep('confirm')
        }
        break

      case 'assignees':
        if (!isSkip) {
          const member = findMemberByName(text)
          if (member) {
            setSelectedAssignees(prev => [...prev, member.user_id])
            setTaskData(prev => ({
              ...prev,
              assignee_ids: [...(prev.assignee_ids || []), member.user_id]
            }))
            toast.success(`Assigned to: ${member.profile?.full_name || 'team member'}`)
          } else {
            toast.error(`Member "${text}" not found`)
          }
        }
        setWizardStep('confirm')
        break

      default:
        break
    }
  }, [wizardStep, parseDateFromVoice, findMemberByName, members.length])

  // Voice input result handler
  const handleVoiceResult = useCallback(async (result: { transcript: string; isFinal: boolean }) => {
    if (!result.isFinal) return

    const text = result.transcript.trim()
    if (!text) return

    setVoiceTranscript(text)

    if (wizardStep !== 'idle' && wizardStep !== 'confirm') {
      await processWizardStep(text)
    }
  }, [wizardStep, processWizardStep])

  // Start the wizard
  const startWizard = useCallback(() => {
    setTaskData({ title: '' })
    setSelectedAssignees([])
    setVoiceTranscript('')
    setWizardStep('title')
  }, [])

  // Cancel wizard
  const cancelWizard = useCallback(() => {
    setWizardStep('idle')
    setTaskData({ title: '' })
    setSelectedAssignees([])
    setVoiceTranscript('')
  }, [])

  // Confirm and create task
  const confirmTask = useCallback(() => {
    if (onCreateTask && taskData.title) {
      onCreateTask(taskData)
      toast.success(`Task created: ${taskData.title}`)
      cancelWizard()
    }
  }, [onCreateTask, taskData, cancelWizard])

  // Voice input error handler
  const handleVoiceError = useCallback((error: string) => {
    toast.error(error)
  }, [])

  // Voice input hook
  const {
    isListening,
    isSupported: isVoiceSupported,
    transcript: liveTranscript,
    startListening,
    stopListening,
  } = useVoiceInput({
    onResult: handleVoiceResult,
    onError: handleVoiceError,
    continuous: false,
  })

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

  // Touch move handler - uses native event for non-passive listener
  const handleTouchMoveNative = useCallback((e: TouchEvent) => {
    if (!dragStartRef.current) return

    const touch = e.touches[0]
    const deltaX = touch.clientX - dragStartRef.current.x
    const deltaY = touch.clientY - dragStartRef.current.y

    // Only start dragging if moved more than 10px
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      setIsDragging(true)
      setHasMoved(true)
      e.preventDefault() // Prevent scroll while dragging - works with non-passive listener

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

  // Add non-passive touch move listener to allow preventDefault
  useEffect(() => {
    const fabElement = fabRef.current
    if (!fabElement) return

    // Add touch move with passive: false to allow preventDefault
    fabElement.addEventListener('touchmove', handleTouchMoveNative, { passive: false })

    return () => {
      fabElement.removeEventListener('touchmove', handleTouchMoveNative)
    }
  }, [handleTouchMoveNative])

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

      {/* Quest Panel - Mobile optimized */}
      {isOpen && (
        <div className={`absolute ${getPanelPosition()} w-[calc(100vw-32px)] sm:w-96 max-w-[380px] max-h-[75vh] sm:max-h-[70vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span className="font-semibold text-white text-sm sm:text-base">AI Insights</span>
              {/* Reset position button */}
              {position && (
                <button
                  onClick={handleResetPosition}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors touch-target tap-highlight-none"
                  title="Reset position"
                >
                  <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                </button>
              )}
              <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-white/20 text-white rounded-full whitespace-nowrap">
                {visibleSuggestions.length} {visibleSuggestions.length === 1 ? 'quest' : 'quests'}
              </span>
            </div>
          </div>

          {/* Voice Input Section with Wizard - Mobile optimized */}
          {isVoiceSupported && onCreateTask && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              {/* Wizard Progress */}
              {wizardStep !== 'idle' && (
                <div className="mb-2.5 sm:mb-3">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                      Step {['title', 'description', 'priority', 'due_date', 'assignees', 'confirm'].indexOf(wizardStep) + 1} of {members.length > 0 ? 6 : 5}
                    </span>
                    <button
                      onClick={cancelWizard}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 -mr-2 touch-target tap-highlight-none"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex gap-0.5 sm:gap-1">
                    {['title', 'description', 'priority', 'due_date', ...(members.length > 0 ? ['assignees'] : []), 'confirm'].map((step, i) => (
                      <div
                        key={step}
                        className={`h-1.5 sm:h-1 flex-1 rounded-full transition-colors ${
                          ['title', 'description', 'priority', 'due_date', 'assignees', 'confirm'].indexOf(wizardStep) >= i
                            ? 'bg-purple-500'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm Step UI - Mobile optimized */}
              {wizardStep === 'confirm' ? (
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="p-2.5 sm:p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                    <div>
                      <span className="text-xs text-gray-500">Title</span>
                      <p className="text-sm font-medium text-gray-900 dark:text-white break-words">{taskData.title}</p>
                    </div>
                    {taskData.description && (
                      <div>
                        <span className="text-xs text-gray-500">Description</span>
                        <p className="text-sm text-gray-700 dark:text-gray-300 break-words line-clamp-3">{taskData.description}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 sm:gap-4">
                      {taskData.priority && (
                        <div>
                          <span className="text-xs text-gray-500">Priority</span>
                          <p className={`text-sm font-medium capitalize ${
                            taskData.priority === 'urgent' ? 'text-red-600' :
                            taskData.priority === 'high' ? 'text-orange-600' :
                            taskData.priority === 'medium' ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>{taskData.priority}</p>
                        </div>
                      )}
                      {taskData.due_date && (
                        <div>
                          <span className="text-xs text-gray-500">Due Date</span>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{taskData.due_date}</p>
                        </div>
                      )}
                    </div>
                    {selectedAssignees.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500">Assigned to</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedAssignees.map(userId => {
                            const member = members.find(m => m.user_id === userId)
                            return (
                              <span key={userId} className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                                {member?.profile?.full_name || 'Unknown'}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={cancelWizard}
                      className="flex-1 px-3 py-2.5 sm:py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors touch-target tap-highlight-none active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmTask}
                      className="flex-1 px-3 py-2.5 sm:py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors touch-target tap-highlight-none active:scale-[0.98]"
                    >
                      Create Task
                    </button>
                  </div>
                </div>
              ) : (
                /* Voice Input UI - Mobile optimized */
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <button
                    onClick={() => {
                      if (wizardStep === 'idle') {
                        startWizard()
                        setTimeout(() => startListening(), 100)
                      } else if (isListening) {
                        stopListening()
                      } else {
                        startListening()
                      }
                    }}
                    disabled={isProcessingVoice}
                    className={`relative flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all touch-target tap-highlight-none active:scale-95 ${
                      isListening
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-lg shadow-red-500/30'
                        : isProcessingVoice
                          ? 'bg-purple-100 dark:bg-purple-900/30 cursor-wait'
                          : 'bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                    }`}
                    title={isListening ? 'Stop listening' : wizardStep === 'idle' ? 'Start creating task' : 'Speak your answer'}
                  >
                    {isProcessingVoice ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-300 border-t-purple-600" />
                    ) : isListening ? (
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    {isListening ? (
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                          <span className="text-sm font-medium text-red-600 dark:text-red-400">Listening...</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{STEP_PROMPTS[wizardStep]}</p>
                        {liveTranscript && (
                          <p className="text-sm text-gray-800 dark:text-gray-200 truncate">&quot;{liveTranscript}&quot;</p>
                        )}
                      </div>
                    ) : isProcessingVoice ? (
                      <div className="space-y-0.5 sm:space-y-1">
                        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Processing...</span>
                        {voiceTranscript && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{voiceTranscript}</p>
                        )}
                      </div>
                    ) : wizardStep !== 'idle' ? (
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 line-clamp-1">{STEP_PROMPTS[wizardStep]}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tap mic to answer or say &quot;skip&quot;</p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Voice Task Creator</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tap mic to create a task step by step</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className={`max-h-[calc(70vh-${isVoiceSupported && onCreateTask ? '120px' : '52px'})] overflow-y-auto`}>
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
