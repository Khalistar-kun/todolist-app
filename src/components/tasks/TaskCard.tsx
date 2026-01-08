"use client"

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'
import { format } from 'date-fns'

interface TaskCardProps {
  task: Task
  onClick: () => void
  isDragging?: boolean
}

export function TaskCard({ task, onClick, isDragging = false }: TaskCardProps) {
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
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all duration-200 ${
        isDragging ? 'opacity-50 rotate-3' : ''
      }`}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {/* Header with priority and actions */}
      <div className="flex items-start justify-between mb-3">
        {/* Priority Badge */}
        {task.priority !== 'none' && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(
              task.priority
            )}`}
          >
            {getPriorityLabel(task.priority)}
          </span>
        )}

        {/* Drag Handle */}
        <div className="flex items-center space-x-1 opacity-0 hover:opacity-100 transition-opacity">
          <button
            className="p-1 hover:bg-gray-100 rounded"
            onClick={(e) => {
              e.stopPropagation()
              // Open task menu
            }}
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Task Title */}
      <h4 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
        {task.title}
      </h4>

      {/* Task Description */}
      {task.description && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-xs text-gray-500">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Due Date */}
        {task.due_date && (
          <div
            className={`flex items-center text-xs ${
              isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-gray-500'
            }`}
          >
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {format(new Date(task.due_date), 'MMM d')}
          </div>
        )}

        {/* Right side icons */}
        <div className="flex items-center space-x-2 ml-auto">
          {/* Comments Count */}
          <div className="flex items-center text-xs text-gray-500">
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {/* Comment count would come from props */}
          </div>

          {/* Attachments */}
          {/* Attachment count would come from props */}

          {/* Time Spent */}
          {/* Time spent would come from props */}

          {/* Assignees */}
          <div className="flex -space-x-2">
            {/* Assignee avatars would come from props */}
            <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center">
              <span className="text-xs font-medium text-gray-700">+</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtasks Progress */}
      {/* Subtask progress would be shown here if available */}
    </div>
  )
}