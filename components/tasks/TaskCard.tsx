"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '@/lib/supabase'
import { format } from 'date-fns'

interface TaskCardProps {
  task: Task & {
    comments_count?: number
    assignees?: Array<{ id: string; full_name: string | null; avatar_url: string | null }>
  }
  onClick: () => void
  onCommentClick?: (task: Task, anchorRect: DOMRect) => void
  onExpandClick?: (task: Task) => void
  onDelete?: (task: Task) => void
  onDuplicate?: (task: Task) => void
  onColorChange?: (task: Task, color: string | null) => void
  onApprove?: (task: Task) => void
  onReject?: (task: Task) => void
  canApprove?: boolean
  doneStageId?: string
  isDragging?: boolean
  isSelected?: boolean
  onSelect?: (taskId: string, ctrlKey: boolean) => void
}

// Preset colors for task color picker
const TASK_COLORS = [
  { value: null, label: 'None', color: 'transparent' },
  { value: '#EF4444', label: 'Red', color: '#EF4444' },
  { value: '#F97316', label: 'Orange', color: '#F97316' },
  { value: '#EAB308', label: 'Yellow', color: '#EAB308' },
  { value: '#22C55E', label: 'Green', color: '#22C55E' },
  { value: '#3B82F6', label: 'Blue', color: '#3B82F6' },
  { value: '#8B5CF6', label: 'Purple', color: '#8B5CF6' },
  { value: '#EC4899', label: 'Pink', color: '#EC4899' },
]

export function TaskCard({
  task,
  onClick,
  onCommentClick,
  onExpandClick,
  onDelete,
  onDuplicate,
  onColorChange,
  onApprove,
  onReject,
  canApprove = false,
  doneStageId = 'done',
  isDragging = false,
  isSelected = false,
  onSelect,
}: TaskCardProps) {
  const commentButtonRef = useRef<HTMLButtonElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'Urgent'
      case 'high':
        return 'High'
      case 'medium':
        return 'Medium'
      case 'low':
        return 'Low'
      default:
        return 'None'
    }
  }

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  const isDueSoon = task.due_date && new Date(task.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) && task.status !== 'done'

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  // Handle menu button click
  const handleMenuClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(!menuOpen)
  }, [menuOpen])

  // Handle delete
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    onDelete?.(task)
  }, [task, onDelete])

  // Handle duplicate
  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    onDuplicate?.(task)
  }, [task, onDuplicate])

  // Handle color change
  const handleColorSelect = useCallback((color: string | null) => {
    setMenuOpen(false)
    onColorChange?.(task, color)
  }, [task, onColorChange])

  // Handle approve
  const handleApprove = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onApprove?.(task)
  }, [task, onApprove])

  // Handle reject
  const handleReject = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onReject?.(task)
  }, [task, onReject])

  // Main card click - opens task detail
  const handleCardClick = (e: React.MouseEvent) => {
    // Check if Ctrl key is held for multi-select
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      e.stopPropagation()
      onSelect?.(task.id, true)
    } else {
      // Normal click - notify selection handler and trigger onClick
      onSelect?.(task.id, false)
      onClick()
    }
  }

  // Comment icon click - opens quick comment panel
  const handleCommentClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    // CRITICAL: Stop propagation to prevent card click and drag
    e.preventDefault()
    e.stopPropagation()

    if (onCommentClick && commentButtonRef.current) {
      const rect = commentButtonRef.current.getBoundingClientRect()
      onCommentClick(task, rect)
    }
  }, [task, onCommentClick])

  // Expand icon click - opens full task detail view
  const handleExpandClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    // CRITICAL: Stop propagation to prevent card click and drag
    e.preventDefault()
    e.stopPropagation()

    if (onExpandClick) {
      onExpandClick(task)
    } else {
      // Fallback to main onClick
      onClick()
    }
  }, [task, onExpandClick, onClick])

  // Handle keyboard accessibility for icons
  const handleIconKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLButtonElement>,
    action: () => void
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      action()
    }
  }, [])

  const commentsCount = task.comments_count || 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-white dark:bg-gray-800 border rounded-lg p-4 cursor-pointer hover:shadow-md dark:hover:shadow-gray-900/50 transition-all duration-200 group overflow-hidden ${
        isDragging ? 'opacity-50 rotate-3' : ''
      } ${
        isSelected
          ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/30 dark:ring-blue-400/30 bg-blue-50/50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700'
      }`}
      onClick={handleCardClick}
      {...attributes}
      {...listeners}
    >
      {/* Color indicator stripe */}
      {task.color && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: task.color }}
        />
      )}
      {/* Selection checkbox indicator */}
      {isSelected && (
        <div className="absolute -top-2 -left-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-md z-10">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      )}

      {/* Header with priority, approval status, and actions */}
      <div className="flex items-start justify-between mb-3">
        {/* Priority Badge + Approval Status */}
        <div className="flex-1 flex flex-wrap gap-1">
          {task.priority !== 'none' && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(
                task.priority
              )}`}
            >
              {getPriorityLabel(task.priority)}
            </span>
          )}
          {/* Approval Status Badge */}
          {task.stage_id === doneStageId && task.approval_status === 'pending' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800">
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pending Approval
            </span>
          )}
          {task.approval_status === 'approved' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Approved
            </span>
          )}
        </div>

        {/* Action Buttons - Always visible on touch devices, hover on desktop */}
        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity relative">
          {/* More menu button */}
          <button
            ref={menuButtonRef}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            onClick={handleMenuClick}
            onKeyDown={(e) => handleIconKeyDown(e, () => setMenuOpen(!menuOpen))}
            title="More options"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Edit Task */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMenuOpen(false)
                  onClick()
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Edit Task
              </button>

              {/* Color Picker - inline in menu for better UX */}
              {onColorChange && (
                <>
                  <div className="px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
                    </svg>
                    Color
                  </div>
                  <div className="px-3 pb-2">
                    <div className="flex flex-wrap gap-1.5">
                      {TASK_COLORS.map((color) => (
                        <button
                          key={color.label}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleColorSelect(color.value)
                          }}
                          className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                            task.color === color.value
                              ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                          } ${color.value === null ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                          style={color.value ? { backgroundColor: color.value } : undefined}
                          title={color.label}
                          aria-label={`Set color to ${color.label}`}
                        >
                          {color.value === null && (
                            <svg className="w-full h-full text-gray-400 dark:text-gray-500 p-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          )}
                          {task.color === color.value && color.value !== null && (
                            <svg className="w-full h-full text-white p-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                </>
              )}

              {/* Duplicate */}
              {onDuplicate && (
                <button
                  onClick={handleDuplicate}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                  </svg>
                  Duplicate
                </button>
              )}

              {/* Divider */}
              {onDelete && <div className="border-t border-gray-200 dark:border-gray-700 my-1" />}

              {/* Delete */}
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Task Title */}
      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
        {task.title}
      </h4>

      {/* Task Description */}
      {task.description && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Approval Actions - Show for tasks pending approval when user can approve */}
      {canApprove && task.stage_id === doneStageId && task.approval_status === 'pending' && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <span className="text-xs text-yellow-700 dark:text-yellow-300 flex-1">Needs approval</span>
          <button
            onClick={handleApprove}
            className="px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors flex items-center gap-1"
            title="Approve task"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Approve
          </button>
          <button
            onClick={handleReject}
            className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors flex items-center gap-1"
            title="Reject task"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Reject
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Due Date */}
        {task.due_date && (
          <div
            className={`flex items-center text-xs ${
              isOverdue ? 'text-red-600 dark:text-red-400' : isDueSoon ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {format(new Date(task.due_date), 'MMM d')}
          </div>
        )}

        {/* Right side icons - Interactive */}
        <div className="flex items-center gap-1 ml-auto">
          {/* Comment Button - CLICKABLE */}
          <button
            ref={commentButtonRef}
            onClick={handleCommentClick}
            onKeyDown={(e) => handleIconKeyDown(e, () => {
              if (commentButtonRef.current) {
                const rect = commentButtonRef.current.getBoundingClientRect()
                onCommentClick?.(task, rect)
              }
            })}
            className="flex items-center gap-1 px-1.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="View comments"
            aria-label={`${commentsCount} comment${commentsCount !== 1 ? 's' : ''}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {commentsCount > 0 && (
              <span className="font-medium">{commentsCount}</span>
            )}
          </button>

          {/* Expand Button - CLICKABLE */}
          <button
            onClick={handleExpandClick}
            onKeyDown={(e) => handleIconKeyDown(e, () => onExpandClick?.(task) || onClick())}
            className="flex items-center justify-center w-6 h-6 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="View task details"
            aria-label="Expand task"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          </button>

          {/* Assignees */}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex -space-x-1.5 ml-1">
              {task.assignees.slice(0, 3).map((assignee) => (
                <div
                  key={assignee.id}
                  className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center overflow-hidden"
                  title={assignee.full_name || 'Unassigned'}
                >
                  {assignee.avatar_url ? (
                    <img
                      src={assignee.avatar_url}
                      alt={assignee.full_name || 'Assignee'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {(assignee.full_name || 'U')[0].toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    +{task.assignees.length - 3}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
