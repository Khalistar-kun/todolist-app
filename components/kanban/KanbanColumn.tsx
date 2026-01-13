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
  doneStageId?: string
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
  doneStageId = 'done',
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
    <div className="flex-shrink-0 w-[80vw] sm:w-80 snap-start sm:snap-align-none">
      <div className="card h-full flex flex-col" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
        {/* Column Header */}
        <div className="px-4 py-3" style={{ backgroundColor: 'var(--bg-section)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <h3 className="font-medium text-sm sm:text-base truncate" style={{ color: 'var(--text-primary)' }}>{stage.name}</h3>
              <span className="text-xs sm:text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>({tasks.length})</span>
            </div>
            <div className="relative">
              <button
                ref={buttonRef}
                onClick={() => setMenuOpen(!menuOpen)}
                className="touch-target p-2 rounded transition-colors tap-highlight-none hover:opacity-80"
                style={{ color: 'var(--icon-default)' }}
                aria-label="Column menu"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1 w-48 rounded-lg py-1 z-50 animate-scale-in"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-dropdown)' }}
                >
                  <button
                    onClick={() => {
                      onAddTask?.(stage.id)
                      setMenuOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm flex items-center gap-2 tap-highlight-none touch-target transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <svg className="w-4 h-4" style={{ color: 'var(--icon-default)' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
                    className="w-full px-4 py-3 text-left text-sm flex items-center gap-2 tap-highlight-none touch-target transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)' }}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <svg className="w-4 h-4" style={{ color: 'var(--icon-default)' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
                    className="w-full px-4 py-3 text-left text-sm flex items-center gap-2 tap-highlight-none touch-target transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)' }}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <svg className="w-4 h-4" style={{ color: 'var(--icon-default)' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    Sort by Due Date
                  </button>
                  <div className="my-1" style={{ borderTop: '1px solid var(--border-subtle)' }} />
                  <button
                    onClick={() => {
                      onCollapse?.()
                      setMenuOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm flex items-center gap-2 tap-highlight-none touch-target transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <svg className="w-4 h-4" style={{ color: 'var(--icon-default)' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
            className="flex-1 p-4 space-y-3 overflow-y-auto transition-colors"
            style={{
              // Show approximately 3 task cards (each ~110px) + some padding
              maxHeight: 'calc(3 * 120px + 16px)',
              minHeight: '200px',
              backgroundColor: isOver ? 'var(--bg-card-hover)' : 'transparent',
            }}
          >
            {tasks.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                  <svg className="w-6 h-6" style={{ color: 'var(--icon-muted)' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tasks in this stage</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-placeholder)' }}>Drag tasks here to add them</p>
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
                    doneStageId={doneStageId}
                    isSelected={selectedTaskIds?.has(task.id) || false}
                    onSelect={onTaskSelect}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        )}

        {/* Scroll indicator when there are more than 3 tasks */}
        {!isCollapsed && tasks.length > 3 && (
          <div className="px-4 py-2" style={{ backgroundColor: 'var(--bg-section)', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-3 h-3 animate-bounce" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              <span>Scroll for {tasks.length - 3} more</span>
            </div>
          </div>
        )}

        {/* Collapsed indicator */}
        {isCollapsed && (
          <div
            ref={setNodeRef}
            className="flex-1 flex items-center justify-center p-4 cursor-pointer transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onClick={onCollapse}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div className="text-center">
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
                {tasks.length}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tasks.length === 1 ? 'task' : 'tasks'}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--accent-primary)' }}>Click to expand</p>
            </div>
          </div>
        )}

        {/* Add Task Button - Hidden when collapsed */}
        {!isCollapsed && (
          <div className="px-4 py-3" style={{ backgroundColor: 'var(--bg-section)', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => onAddTask?.(stage.id)}
              className="w-full touch-target flex items-center justify-center px-3 py-3 text-sm rounded-md transition-colors tap-highlight-none press-scale"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              aria-label={`Add task to ${stage.name}`}
            >
              <svg className="w-4 h-4 mr-2" style={{ color: 'var(--icon-default)' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
