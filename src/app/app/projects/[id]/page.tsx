"use client"

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ProjectService, type ProjectWithMembers } from '@/lib/services/ProjectService'
import { TaskService } from '@/lib/services/TaskService'
import type { Task } from '@/lib/supabase'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { TaskModal } from '@/components/tasks/TaskModal'
import toast from 'react-hot-toast'

export default function ProjectPage() {
  const { user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectWithMembers | null>(null)
  const [tasks, setTasks] = useState<Record<string, Task[]>>({})
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)

  const fetchProjectData = useCallback(async () => {
    try {
      setLoading(true)
      const [projectData, projectTasks] = await Promise.all([
        ProjectService.getProject(projectId),
        TaskService.getProjectTasks(projectId),
      ])

      if (!projectData) {
        toast.error('Project not found')
        router.push('/app/projects')
        return
      }

      setProject(projectData)
      setTasks(projectTasks)
    } catch (error: any) {
      console.error('Error fetching project data:', error)
      toast.error(error.message || 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [projectId, router])

  useEffect(() => {
    if (user && projectId) {
      fetchProjectData()
    }
  }, [user, projectId, fetchProjectData])

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }

  const handleCreateTask = () => {
    setIsCreatingTask(true)
    setShowTaskModal(true)
  }

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      await TaskService.updateTask(updatedTask.id, {
        title: updatedTask.title,
        description: updatedTask.description ?? undefined,
        status: updatedTask.status,
        priority: updatedTask.priority,
        stage_id: updatedTask.stage_id,
        due_date: updatedTask.due_date ?? undefined,
        tags: updatedTask.tags,
        custom_fields: updatedTask.custom_fields,
        completed_at: updatedTask.completed_at ?? undefined,
      })
      toast.success('Task updated successfully')
      fetchProjectData() // Refresh tasks
    } catch (error: any) {
      toast.error(error.message || 'Failed to update task')
    }
  }

  const handleTaskMove = async (taskId: string, newStageId: string, newPosition: number) => {
    try {
      await TaskService.moveTask(taskId, newStageId, newPosition)
      fetchProjectData() // Refresh tasks
    } catch (error: any) {
      toast.error(error.message || 'Failed to move task')
    }
  }

  const handleReorder = async (stageId: string, taskIds: string[]) => {
    try {
      await TaskService.reorderTasks(projectId, stageId, taskIds)
      fetchProjectData() // Refresh tasks
    } catch (error: any) {
      toast.error(error.message || 'Failed to reorder tasks')
    }
  }

  const handleModalClose = () => {
    setShowTaskModal(false)
    setSelectedTask(null)
    setIsCreatingTask(false)
  }

  const handleTaskCreated = () => {
    fetchProjectData() // Refresh tasks
    handleModalClose()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Project not found</h2>
        <p className="text-gray-600 mb-8">The project you're looking for doesn't exist or you don't have access to it.</p>
        <button
          onClick={() => router.push('/app/projects')}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-7xl mx-auto">
        {/* Project Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-gray-600">{project.description}</p>
              </div>
            </div>
            <button
              onClick={handleCreateTask}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Task
            </button>
          </div>

          {/* Project Stats */}
          <div className="flex items-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {project.tasks_count} tasks
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {project.completed_tasks_count} completed
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {project.members.length} members
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <KanbanBoard
          project={project}
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onTaskMove={handleTaskMove}
          onReorder={handleReorder}
        />

        {/* Task Modal */}
        {showTaskModal && (
          <TaskModal
            project={project}
            task={selectedTask}
            isOpen={showTaskModal}
            onClose={handleModalClose}
            onUpdate={handleTaskUpdate}
            onCreate={isCreatingTask ? handleTaskCreated : undefined}
          />
        )}
      </div>
    </div>
  )
}