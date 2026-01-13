"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/app/providers/AuthProvider'

interface Position {
  x: number
  y: number
}

interface ProjectSummary {
  id: string
  name: string
  taskCount: number
  completedCount: number
}

const POSITION_STORAGE_KEY = 'global-ai-fab-position'

function getInitialPosition(): Position | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(POSITION_STORAGE_KEY)
    if (stored) {
      const pos = JSON.parse(stored)
      if (pos.x >= 0 && pos.y >= 0 && pos.x <= window.innerWidth - 56 && pos.y <= window.innerHeight - 56) {
        return pos
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

export function GlobalAIButton() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [contextLoaded, setContextLoaded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Drag state
  const [position, setPosition] = useState<Position | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hasMoved, setHasMoved] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  // Hide on auth pages and project detail pages (they have their own AI Insights button)
  const isAuthPage = pathname?.startsWith('/auth') || pathname === '/' || pathname?.startsWith('/login') || pathname?.startsWith('/signup')
  const isProjectDetailPage = /^\/app\/projects\/[^/]+$/.test(pathname || '')

  // Get current position or default bottom-right
  const getCurrentPosition = useCallback(() => {
    if (position) {
      return { right: 'auto' as const, bottom: 'auto' as const, left: position.x, top: position.y }
    }
    return { right: 16, bottom: 24, left: 'auto' as const, top: 'auto' as const }
  }, [position])

  // Compute panel position based on FAB location
  const getPanelPosition = useCallback(() => {
    if (!position) {
      return 'bottom-16 right-0'
    }
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768
    const openLeft = position.x > viewportWidth / 2
    const openAbove = position.y > viewportHeight / 2
    const classes = []
    if (openAbove) {
      classes.push('bottom-16')
    } else {
      classes.push('top-16')
    }
    if (openLeft) {
      classes.push('right-0')
    } else {
      classes.push('left-0')
    }
    return classes.join(' ')
  }, [position])

  // Handle click - only toggle if we haven't moved
  const handleClick = useCallback(() => {
    if (!hasMoved) {
      setIsOpen(prev => !prev)
    }
    setHasMoved(false)
  }, [hasMoved])

  // Mouse move handler
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStartRef.current) return
    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setIsDragging(true)
      setHasMoved(true)
      let newX = dragStartRef.current.posX + deltaX
      let newY = dragStartRef.current.posY + deltaY
      const fabSize = 56
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
    if (isOpen) return
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

  // Touch move handler
  const handleTouchMoveNative = useCallback((e: TouchEvent) => {
    if (!dragStartRef.current) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - dragStartRef.current.x
    const deltaY = touch.clientY - dragStartRef.current.y
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      setIsDragging(true)
      setHasMoved(true)
      e.preventDefault()
      let newX = dragStartRef.current.posX + deltaX
      let newY = dragStartRef.current.posY + deltaY
      const fabSize = 48
      newX = Math.max(0, Math.min(window.innerWidth - fabSize, newX))
      newY = Math.max(0, Math.min(window.innerHeight - fabSize, newY))
      setPosition({ x: newX, y: newY })
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    dragStartRef.current = null
    setIsDragging(false)
  }, [])

  // Reset position
  const handleResetPosition = useCallback(() => {
    setPosition(null)
    localStorage.removeItem(POSITION_STORAGE_KEY)
  }, [])

  // Fetch user's projects for context
  const fetchProjectContext = useCallback(async () => {
    if (!user || contextLoaded) return

    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        const projectSummaries: ProjectSummary[] = (data.projects || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          taskCount: p.tasks_count || 0,
          completedCount: p.completed_tasks_count || 0,
        }))
        setProjects(projectSummaries)
        setContextLoaded(true)
      }
    } catch (error) {
      console.error('Error fetching project context:', error)
    }
  }, [user, contextLoaded])

  // Build context string from projects
  const buildContextString = useCallback(() => {
    if (projects.length === 0) return ''

    const projectList = projects.map(p =>
      `- "${p.name}": ${p.taskCount} tasks, ${p.completedCount} completed`
    ).join('\n')

    return `\n\nUser's Projects:\n${projectList}\n\nTotal Projects: ${projects.length}`
  }, [projects])

  // Send message to AI
  const sendMessage = useCallback(async () => {
    if (!message.trim() || isLoading) return

    const userMessage = message.trim()
    setMessage('')
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    const projectContext = buildContextString()

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          messages: [
            {
              role: 'system',
              content: `You are a helpful AI assistant for TodoApp, a task and project management application.

Your role:
- Help users manage their tasks and projects effectively
- Provide productivity tips and project management advice
- Answer questions about their projects and tasks
- Suggest ways to improve workflow and organization

${projectContext ? `Current user context:${projectContext}` : 'No project data available yet.'}

Guidelines:
- Be concise and actionable
- Reference specific projects by name when relevant
- Suggest practical next steps
- Keep responses focused and helpful`
            },
            ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: userMessage }
          ]
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.response || 'Sorry, I could not process that request.' }])
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Sorry, there was an error processing your request.'
        setChatHistory(prev => [...prev, { role: 'assistant', content: errorMessage }])
      }
    } catch (error) {
      console.error('AI chat error:', error)
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }, [message, chatHistory, isLoading, buildContextString])

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  // Add non-passive touch move listener
  useEffect(() => {
    const fabElement = fabRef.current
    if (!fabElement) return
    fabElement.addEventListener('touchmove', handleTouchMoveNative, { passive: false })
    return () => {
      fabElement.removeEventListener('touchmove', handleTouchMoveNative)
    }
  }, [handleTouchMoveNative])

  // Initialize position from localStorage
  useEffect(() => {
    const savedPos = getInitialPosition()
    if (savedPos) {
      setPosition(savedPos)
    }
  }, [])

  // Save position to localStorage
  useEffect(() => {
    if (position) {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position))
    }
  }, [position])

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
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

  // Focus input when panel opens and fetch context
  useEffect(() => {
    if (isOpen) {
      if (inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      // Fetch project context when panel opens
      fetchProjectContext()
    }
  }, [isOpen, fetchProjectContext])

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatHistory])

  // Don't render on auth pages, project detail pages, or if not logged in
  if (isAuthPage || isProjectDetailPage || !user) {
    return null
  }

  const positionStyle = getCurrentPosition()

  return (
    <div
      ref={panelRef}
      className="fixed z-50"
      style={{
        left: positionStyle.left,
        top: positionStyle.top,
        right: positionStyle.right !== 'auto' ? positionStyle.right : undefined,
        bottom: positionStyle.bottom !== 'auto' ? positionStyle.bottom : undefined,
      }}
    >
      {/* Floating Action Button */}
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
        aria-label="AI Assistant"
      >
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
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className={`absolute ${getPanelPosition()} w-[calc(100vw-32px)] sm:w-96 max-w-[380px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span className="font-semibold text-white">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              {position && (
                <button
                  onClick={handleResetPosition}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors"
                  title="Reset position"
                >
                  <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setChatHistory([])}
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
                title="Clear chat"
              >
                <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div ref={chatContainerRef} className="h-64 sm:h-80 overflow-y-auto p-3 space-y-3">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <svg className="w-12 h-12 text-purple-300 dark:text-purple-600 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-400">Hi! I&apos;m your AI assistant.</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {projects.length > 0
                    ? `I can see you have ${projects.length} project${projects.length > 1 ? 's' : ''}. Ask me about your tasks!`
                    : 'Ask me anything about tasks, projects, or productivity!'}
                </p>
              </div>
            ) : (
              chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!message.trim() || isLoading}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
