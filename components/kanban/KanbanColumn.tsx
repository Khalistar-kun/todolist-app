"use client"

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
  selectedTaskIds?: Set<string>
  onTaskSelect?: (taskId: string, ctrlKey: boolean) => void
}

export function KanbanColumn({ stage, tasks, onTaskClick, selectedTaskIds, onTaskSelect }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  })

  return (
    <div className="flex-shrink-0 w-80">
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
            <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Task List */}
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
                  isSelected={selectedTaskIds?.has(task.id) || false}
                  onSelect={onTaskSelect}
                />
              ))}
            </SortableContext>
          )}
        </div>

        {/* Add Task Button */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              // This would open a quick add task modal or navigate to create task
              console.log('Add task to stage:', stage.id)
            }}
            className="w-full flex items-center justify-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>
      </div>
    </div>
  )
}
