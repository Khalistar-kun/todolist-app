"use client"

import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task } from '@/lib/supabase'
import { TaskCard } from '../tasks/TaskCard'

interface KanbanColumnProps {
  stage: {
    id: string
    name: string
    color: string
  }
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onCommentClick?: (task: Task, anchorRect: DOMRect) => void
  onExpandClick?: (task: Task) => void
  onTaskDelete?: (task: Task) => void
  onTaskDuplicate?: (task: Task) => void
  onTaskColorChange?: (task: Task, color: string | null) => void
  onTaskApprove?: (task: Task) => void
  onTaskReject?: (task: Task) => void
  canApprove?: boolean
  selectedTaskIds?: Set<string>
  onTaskSelect?: (taskId: string, ctrlKey: boolean) => void
  onAddTask?: (stageId: string) => void
  onSortByPriority?: () => void
  onSortByDueDate?: () => void
  onCollapse?: () => void
  isCollapsed?: boolean
}

export function KanbanColumn({
  stage,
  tasks,
  onTaskClick,
  onCommentClick,
  onExpandClick,
  onTaskDelete,
  onTaskDuplicate,
  onTaskColorChange,
  onTaskApprove,
  onTaskReject,
  canApprove = false,
  selectedTaskIds,
  onTaskSelect,
  onAddTask,
  onSortByPriority,
  onSortByDueDate,
  onCollapse,
  isCollapsed = false,
}: KanbanColumnProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  })

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <div className="flex-shrink-0 w-[85vw] sm:w-80 snap-start sm:snap-align-none">
      <div className="card h-full flex flex-col">
        {/* Column Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <h3 className="font-medium text-gray-900 dark:text-white">{stage.name}</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">({tasks.length})</span>
            </div>
            <div className="relative">
              <button
                ref={buttonRef}
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
                >
                  <button
                    onClick={() => {
                      onAddTask?.(stage.id)
                      setMenuOpen(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Task
                  </button>
                  <button
                    onClick={() => {
                      onSortByPriority?.()
                      setMenuOpen(false)
                    }}
                    disabled={!onSortByPriority || tasks.length === 0}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                    </svg>
                    Sort by Priority
                  </button>
                  <button
                    onClick={() => {
                      onSortByDueDate?.()
                      setMenuOpen(false)
                    }}
                    disabled={!onSortByDueDate || tasks.length === 0}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    Sort by Due Date
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                  <button
                    onClick={() => {
                      onCollapse?.()
                      setMenuOpen(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      {isCollapsed ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                      )}
                    </svg>
                    {isCollapsed ? 'Expand Column' : 'Collapse Column'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task List - Hidden when collapsed */}
        {!isCollapsed && (
          <div
            ref={setNodeRef}
            className={`flex-1 p-4 space-y-3 overflow-y-auto min-h-[200px] transition-colors ${
              isOver ? 'bg-gray-50 dark:bg-gray-700/50' : ''
            }`}
          >
            {tasks.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">No tasks in this stage</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Drag tasks here to add them</p>
              </div>
            ) : (
              <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    onCommentClick={onCommentClick}
                    onExpandClick={onExpandClick}
                    onDelete={onTaskDelete}
                    onDuplicate={onTaskDuplicate}
                    onColorChange={onTaskColorChange}
                    onApprove={onTaskApprove}
                    onReject={onTaskReject}
                    canApprove={canApprove}
                    isSelected={selectedTaskIds?.has(task.id) || false}
                    onSelect={onTaskSelect}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        )}

        {/* Collapsed indicator */}
        {isCollapsed && (
          <div
            ref={setNodeRef}
            className="flex-1 flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            onClick={onCollapse}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400 dark:text-gray-500 mb-1">
                {tasks.length}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {tasks.length === 1 ? 'task' : 'tasks'}
              </p>
              <p className="text-xs text-blue-500 mt-2">Click to expand</p>
            </div>
          </div>
        )}

        {/* Add Task Button - Hidden when collapsed */}
        {!isCollapsed && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => onAddTask?.(stage.id)}
              className="w-full flex items-center justify-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Task
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
