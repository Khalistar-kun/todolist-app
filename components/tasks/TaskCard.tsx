"use client"

import { useState, useRef, useCallback } from 'react'
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
  isDragging?: boolean
  isSelected?: boolean
  onSelect?: (taskId: string, ctrlKey: boolean) => void
}

export function TaskCard({
  task,
  onClick,
  onCommentClick,
  onExpandClick,
  isDragging = false,
  isSelected = false,
  onSelect,
}: TaskCardProps) {
  const commentButtonRef = useRef<HTMLButtonElement>(null)

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
      className={`relative bg-white dark:bg-gray-800 border rounded-lg p-4 cursor-pointer hover:shadow-md dark:hover:shadow-gray-900/50 transition-all duration-200 group ${
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
      {/* Selection checkbox indicator */}
      {isSelected && (
        <div className="absolute -top-2 -left-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-md z-10">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      )}

      {/* Header with priority and actions */}
      <div className="flex items-start justify-between mb-3">
        {/* Priority Badge */}
        <div className="flex-1">
          {task.priority !== 'none' && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(
                task.priority
              )}`}
            >
              {getPriorityLabel(task.priority)}
            </span>
          )}
        </div>

        {/* Action Buttons - Always visible on touch devices, hover on desktop */}
        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {/* More menu button */}
          <button
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              // TODO: Open task menu
            }}
            onKeyDown={(e) => handleIconKeyDown(e, () => {})}
            title="More options"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
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
