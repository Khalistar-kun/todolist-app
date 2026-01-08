"use client"

import { useState } from 'react'
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

interface KanbanBoardProps {
  project: Project
  tasks: Record<string, Task[]>
  onTaskClick: (task: Task) => void
  onTaskMove: (taskId: string, newStageId: string, newPosition: number) => void
  onReorder: (stageId: string, taskIds: string[]) => void
}

export function KanbanBoard({
  project,
  tasks,
  onTaskClick,
  onTaskMove,
  onReorder,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const workflowStages = project.workflow_stages || [
    { id: 'todo', name: 'To Do', color: '#6B7280' },
    { id: 'in_progress', name: 'In Progress', color: '#3B82F6' },
    { id: 'review', name: 'Review', color: '#F59E0B' },
    { id: 'done', name: 'Done', color: '#10B981' },
  ]

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

    const activeTask = Object.values(tasks)
      .flat()
      .find((t) => t.id === activeId)

    if (!activeTask) return

    // Check if dropped on a stage column
    const targetStage = workflowStages.find((stage) => overId === stage.id)

    if (targetStage) {
      // Moving to a different stage
      if (activeTask.stage_id !== targetStage.id) {
        // Get all tasks in the target stage to determine position
        const stageTasks = tasks[targetStage.id] || []
        const newPosition = stageTasks.length

        onTaskMove(activeId, targetStage.id, newPosition)
      }
      return
    }

    // Check if dropped on another task
    const targetTask = Object.values(tasks)
      .flat()
      .find((t) => t.id === overId)

    if (targetTask) {
      // Moving within the same stage
      if (activeTask.stage_id === targetTask.stage_id) {
        const stageTasks = tasks[activeTask.stage_id] || []
        const currentIndex = stageTasks.findIndex(t => t.id === activeId)
        const targetIndex = stageTasks.findIndex(t => t.id === overId)

        if (currentIndex !== targetIndex) {
          // Create new order
          const newTaskIds = [...stageTasks.map(t => t.id)]
          newTaskIds.splice(currentIndex, 1)
          newTaskIds.splice(targetIndex, 0, activeId)

          onReorder(activeTask.stage_id, newTaskIds)
        }
      } else {
        // Moving to a different stage
        const stageTasks = tasks[targetTask.stage_id] || []
        const targetIndex = stageTasks.findIndex(t => t.id === overId)
        const newPosition = targetIndex

        onTaskMove(activeId, targetTask.stage_id, newPosition)
      }
    }
  }

  const handleDragCancel = () => {
    setActiveTask(null)
  }

  return (
    <div className="h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex space-x-6 h-full overflow-x-auto pb-4">
          {workflowStages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              tasks={tasks[stage.id] || []}
              onTaskClick={onTaskClick}
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
    </div>
  )
}