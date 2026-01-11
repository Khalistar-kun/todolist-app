"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  DragCancelEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { Project, Task } from '@/lib/supabase'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from '../tasks/TaskCard'
import { QuickCommentPanel } from '../tasks/QuickCommentPanel'

// State for comment panel
interface CommentPanelState {
  isOpen: boolean
  task: Task | null
  anchorRect: DOMRect | null
}

interface KanbanBoardProps {
  project: Project
  tasks: Record<string, Task[]>
  onTaskClick: (task: Task) => void
  onTaskMove?: (taskId: string, newStageId: string, newPosition: number) => void
  onReorder?: (stageId: string, taskIds: string[]) => void
  onBulkStatusChange?: (taskIds: string[], newStageId: string) => void
  onBulkDelete?: (taskIds: string[]) => void
  onAddTask?: (stageId: string) => void
  onSortColumn?: (stageId: string, sortBy: 'priority' | 'due_date') => void
  onTaskDelete?: (task: Task) => void
  onTaskDuplicate?: (task: Task) => void
  onTaskColorChange?: (task: Task, color: string | null) => void
  onTaskApprove?: (task: Task) => void
  onTaskReject?: (task: Task) => void
  canApprove?: boolean
  filterPendingApproval?: boolean
}

export function KanbanBoard({
  project,
  tasks,
  onTaskClick,
  onTaskMove,
  onReorder,
  onBulkStatusChange,
  onBulkDelete,
  onAddTask,
  onSortColumn,
  onTaskDelete,
  onTaskDuplicate,
  onTaskColorChange,
  onTaskApprove,
  onTaskReject,
  canApprove = false,
  filterPendingApproval = false,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set())
  const [localSortedTasks, setLocalSortedTasks] = useState<Record<string, Task[]>>({})

  // Define workflow stages early so they can be used in callbacks
  const workflowStages = project.workflow_stages || [
    { id: 'todo', name: 'To Do', color: '#6B7280' },
    { id: 'in_progress', name: 'In Progress', color: '#3B82F6' },
    { id: 'review', name: 'Review', color: '#F59E0B' },
    { id: 'done', name: 'Done', color: '#10B981' },
  ]

  // Find the "Done" stage ID - could be 'done' or have a different ID in custom workflows
  const doneStage = workflowStages.find((s) => s.id === 'done' || s.name?.toLowerCase() === 'done')
    || workflowStages[workflowStages.length - 1]
  const doneStageId = doneStage?.id || 'done'

  // Toggle column collapse
  const handleCollapseColumn = useCallback((stageId: string) => {
    setCollapsedColumns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stageId)) {
        newSet.delete(stageId)
      } else {
        newSet.add(stageId)
      }
      return newSet
    })
  }, [])

  // Priority order for sorting (lower = higher priority)
  const PRIORITY_ORDER: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
    none: 4,
  }

  // Local sorting handler (frontend-only, immediate feedback)
  const handleLocalSort = useCallback((stageId: string, sortBy: 'priority' | 'due_date') => {
    const stageTasks = [...(tasks[stageId] || [])]

    if (sortBy === 'priority') {
      stageTasks.sort((a, b) => {
        const aPriority = PRIORITY_ORDER[a.priority] ?? 4
        const bPriority = PRIORITY_ORDER[b.priority] ?? 4
        return aPriority - bPriority
      })
    } else if (sortBy === 'due_date') {
      stageTasks.sort((a, b) => {
        // Tasks without due date go to bottom
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })
    }

    setLocalSortedTasks(prev => ({
      ...prev,
      [stageId]: stageTasks,
    }))

    // Also persist if handler is provided
    if (onSortColumn) {
      onSortColumn(stageId, sortBy)
    }

    // Persist the new order via reorder handler
    if (onReorder) {
      onReorder(stageId, stageTasks.map(t => t.id))
    }
  }, [tasks, onSortColumn, onReorder])

  // Get tasks for a stage (use local sorted if available, otherwise props)
  // When filterPendingApproval is true, only show tasks in Done with pending approval
  const getTasksForStage = useCallback((stageId: string): Task[] => {
    let stageTasks = localSortedTasks[stageId] || tasks[stageId] || []

    // If filtering for pending approval, only show pending tasks in Done column
    if (filterPendingApproval) {
      if (stageId === doneStageId) {
        stageTasks = stageTasks.filter(t => t.approval_status === 'pending')
      } else {
        // Hide tasks in other columns when filtering
        stageTasks = []
      }
    }

    return stageTasks
  }, [localSortedTasks, tasks, filterPendingApproval, doneStageId])

  // Clear local sort when tasks change
  useEffect(() => {
    setLocalSortedTasks({})
  }, [tasks])

  // Quick comment panel state
  const [commentPanel, setCommentPanel] = useState<CommentPanelState>({
    isOpen: false,
    task: null,
    anchorRect: null,
  })

  // Handle comment icon click - opens quick comment panel
  const handleCommentClick = useCallback((task: Task, anchorRect: DOMRect) => {
    setCommentPanel({
      isOpen: true,
      task,
      anchorRect,
    })
  }, [])

  // Close comment panel
  const handleCloseCommentPanel = useCallback(() => {
    setCommentPanel({
      isOpen: false,
      task: null,
      anchorRect: null,
    })
  }, [])

  // Handle expand icon click - opens full task detail
  const handleExpandClick = useCallback((task: Task) => {
    // Use the main onTaskClick handler for full task view
    onTaskClick(task)
  }, [onTaskClick])

  // Handle task selection with Ctrl+Click
  const handleTaskSelect = useCallback((taskId: string, ctrlKey: boolean) => {
    setSelectedTaskIds(prev => {
      const newSelected = new Set(prev)
      if (ctrlKey) {
        // Toggle selection when Ctrl is held
        if (newSelected.has(taskId)) {
          newSelected.delete(taskId)
        } else {
          newSelected.add(taskId)
        }
      } else {
        // Clear selection when clicking without Ctrl
        newSelected.clear()
      }
      return newSelected
    })
  }, [])

  // Clear selection when clicking outside or pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTaskIds(new Set())
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedTaskIds(new Set())
  }, [])

  // Get selected tasks
  const selectedTasks = Object.values(tasks)
    .flat()
    .filter(task => selectedTaskIds.has(task.id))

  // Handle bulk move to stage
  const handleBulkMove = useCallback((stageId: string) => {
    if (onBulkStatusChange && selectedTaskIds.size > 0) {
      onBulkStatusChange(Array.from(selectedTaskIds), stageId)
      clearSelection()
    }
  }, [onBulkStatusChange, selectedTaskIds, clearSelection])

  // Handle bulk delete
  const handleBulkDelete = useCallback(() => {
    if (onBulkDelete && selectedTaskIds.size > 0) {
      onBulkDelete(Array.from(selectedTaskIds))
      clearSelection()
    }
  }, [onBulkDelete, selectedTaskIds, clearSelection])

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // DND sensors - balanced for both mobile scrolling and drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Use distance instead of delay for better mobile UX
        // Allows scrolling but activates drag with small movement
        distance: 10, // 10px movement to activate drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const task = Object.values(tasks)
      .flat()
      .find((t) => t.id === active.id)

    setActiveTask(task || null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeTask = Object.values(tasks)
      .flat()
      .find((t) => t.id === activeId)

    if (!activeTask) return

    // Find which stage the active task is being dragged over
    const overStage = workflowStages.find((stage) =>
      overId === stage.id || overId.startsWith(`${stage.id}-`)
    )

    if (overStage && activeTask.stage_id !== overStage.id) {
      // This is where we could show visual feedback for the drag over
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    setActiveTask(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const draggedTask = Object.values(tasks)
      .flat()
      .find((t) => t.id === activeId)

    if (!draggedTask) return

    // Determine which tasks to move - if dragged task is selected, move all selected tasks
    const tasksToMove = selectedTaskIds.has(activeId) && selectedTaskIds.size > 1
      ? Array.from(selectedTaskIds)
      : [activeId]

    // Check if dropped on a stage column
    const targetStage = workflowStages.find((stage) => overId === stage.id)

    if (targetStage) {
      // Moving to a different stage
      if (draggedTask.stage_id !== targetStage.id) {
        if (tasksToMove.length > 1 && onBulkStatusChange) {
          // Move all selected tasks
          onBulkStatusChange(tasksToMove, targetStage.id)
          clearSelection()
        } else if (onTaskMove) {
          // Move single task
          const stageTasks = tasks[targetStage.id] || []
          const newPosition = stageTasks.length
          onTaskMove(activeId, targetStage.id, newPosition)
        }
      }
      return
    }

    // Check if dropped on another task
    const targetTask = Object.values(tasks)
      .flat()
      .find((t) => t.id === overId)

    if (targetTask) {
      // Moving within the same stage
      if (draggedTask.stage_id === targetTask.stage_id) {
        if (onReorder) {
          const stageTasks = tasks[draggedTask.stage_id] || []
          const currentIndex = stageTasks.findIndex(t => t.id === activeId)
          const targetIndex = stageTasks.findIndex(t => t.id === overId)

          if (currentIndex !== targetIndex) {
            // Create new order
            const newTaskIds = [...stageTasks.map(t => t.id)]
            newTaskIds.splice(currentIndex, 1)
            newTaskIds.splice(targetIndex, 0, activeId)

            onReorder(draggedTask.stage_id, newTaskIds)
          }
        }
      } else {
        // Moving to a different stage
        if (tasksToMove.length > 1 && onBulkStatusChange) {
          // Move all selected tasks
          onBulkStatusChange(tasksToMove, targetTask.stage_id)
          clearSelection()
        } else if (onTaskMove) {
          // Move single task
          const stageTasks = tasks[targetTask.stage_id] || []
          const targetIndex = stageTasks.findIndex(t => t.id === overId)
          const newPosition = targetIndex
          onTaskMove(activeId, targetTask.stage_id, newPosition)
        }
      }
    }
  }

  const handleDragCancel = () => {
    setActiveTask(null)
  }

  return (
    <div className="h-full relative">
      {/* Multi-select action bar */}
      {selectedTaskIds.size > 0 && (
        <div className="sticky top-0 z-20 mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {selectedTaskIds.size} task{selectedTaskIds.size > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Move to stage dropdown */}
            <div className="relative group">
              <button className="btn btn-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                Move to
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-30">
                {workflowStages.map((stage) => (
                  <button
                    key={stage.id}
                    onClick={() => handleBulkMove(stage.id)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </button>
                ))}
              </div>
            </div>
            {/* Delete button */}
            {onBulkDelete && (
              <button
                onClick={handleBulkDelete}
                className="btn btn-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={scrollContainerRef}
          className="flex space-x-4 sm:space-x-6 h-full overflow-x-auto pb-4 px-1 -mx-1 snap-x snap-proximity sm:snap-none scroll-smooth touch-scroll tap-highlight-none"
        >
          {workflowStages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              tasks={getTasksForStage(stage.id)}
              onTaskClick={onTaskClick}
              onCommentClick={handleCommentClick}
              onExpandClick={handleExpandClick}
              onTaskDelete={onTaskDelete}
              onTaskDuplicate={onTaskDuplicate}
              onTaskColorChange={onTaskColorChange}
              onTaskApprove={onTaskApprove}
              onTaskReject={onTaskReject}
              canApprove={canApprove}
              doneStageId={doneStageId}
              selectedTaskIds={selectedTaskIds}
              onTaskSelect={handleTaskSelect}
              onAddTask={onAddTask}
              onSortByPriority={() => handleLocalSort(stage.id, 'priority')}
              onSortByDueDate={() => handleLocalSort(stage.id, 'due_date')}
              onCollapse={() => handleCollapseColumn(stage.id)}
              isCollapsed={collapsedColumns.has(stage.id)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="transform rotate-3 opacity-90">
              <TaskCard
                task={activeTask}
                onClick={() => {}}
                isDragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Helper text */}
      {selectedTaskIds.size === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
          Tip: Hold Ctrl and click to select multiple tasks
        </p>
      )}

      {/* Quick Comment Panel - renders outside the DndContext to avoid interference */}
      {commentPanel.task && (
        <QuickCommentPanel
          taskId={commentPanel.task.id}
          projectId={commentPanel.task.project_id}
          isOpen={commentPanel.isOpen}
          onClose={handleCloseCommentPanel}
          anchorRect={commentPanel.anchorRect}
        />
      )}
    </div>
  )
}