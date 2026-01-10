"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ProjectService, type ProjectWithMembers } from '@/lib/services/ProjectService'
import { TaskService } from '@/lib/services/TaskService'
import type { Task } from '@/lib/supabase'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { TaskModal } from '@/components/tasks/TaskModal'
import MemberManagement from '@/components/projects/MemberManagement'
import { SlackIntegration } from '@/components/projects/SlackIntegration'
import { useProjectPermissions, roleConfig } from '@/hooks/useProjectPermissions'
import { SkeletonProjectHeader, SkeletonKanbanBoard } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'

type TabType = 'board' | 'members' | 'settings'

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
  const [defaultStageId, setDefaultStageId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('board')
  const [showPendingOnly, setShowPendingOnly] = useState(false)

  const { permissions, loading: permissionsLoading } = useProjectPermissions(projectId)
  const isInitialLoadRef = useRef(true)

  // Silent refetch for real-time updates
  const refetchProjectDataSilently = useCallback(async () => {
    try {
      const [projectData, projectTasks] = await Promise.all([
        ProjectService.getProject(projectId),
        TaskService.getProjectTasks(projectId),
      ])

      if (projectData) {
        setProject(projectData)
        setTasks(projectTasks)
      }
    } catch (error) {
      console.error('Error refetching project data:', error)
    }
  }, [projectId])

  // Subscribe to real-time updates for this project
  useRealtimeSubscription({
    subscriptions: [
      { table: 'projects', filter: `id=eq.${projectId}` },
      { table: 'tasks', filter: `project_id=eq.${projectId}` },
      { table: 'project_members', filter: `project_id=eq.${projectId}` },
    ],
    onChange: () => {
      if (!isInitialLoadRef.current) {
        refetchProjectDataSilently()
      }
    },
    enabled: !!projectId && !!user,
  })

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
      fetchProjectData().then(() => {
        isInitialLoadRef.current = false
      })
    }
  }, [user, projectId, fetchProjectData])

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }

  const handleCreateTask = () => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to create tasks')
      return
    }
    setDefaultStageId(null)
    setIsCreatingTask(true)
    setShowTaskModal(true)
  }

  // Handler for adding task from column menu (pre-selects the stage)
  const handleAddTaskFromColumn = (stageId: string) => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to create tasks')
      return
    }
    setDefaultStageId(stageId)
    setIsCreatingTask(true)
    setShowTaskModal(true)
  }

  const handleTaskUpdate = async (updatedTask: Task) => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to edit tasks')
      return
    }

    // Optimistic update - update UI immediately
    const previousTasks = { ...tasks }
    setTasks(prev => {
      const newTasks = { ...prev }
      for (const stageId of Object.keys(newTasks)) {
        newTasks[stageId] = newTasks[stageId].map(t =>
          t.id === updatedTask.id ? updatedTask : t
        )
      }
      // Handle stage change
      if (updatedTask.stage_id !== selectedTask?.stage_id) {
        // Remove from old stage
        if (selectedTask?.stage_id) {
          newTasks[selectedTask.stage_id] = newTasks[selectedTask.stage_id]?.filter(t => t.id !== updatedTask.id) || []
        }
        // Add to new stage
        if (!newTasks[updatedTask.stage_id]) {
          newTasks[updatedTask.stage_id] = []
        }
        newTasks[updatedTask.stage_id] = [...newTasks[updatedTask.stage_id], updatedTask]
      }
      return newTasks
    })

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
    } catch (error: any) {
      // Rollback on error
      setTasks(previousTasks)
      toast.error(error.message || 'Failed to update task')
    }
  }

  const handleTaskMove = async (taskId: string, newStageId: string, newPosition: number) => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to move tasks')
      return
    }

    // Optimistic update - move task in UI immediately
    const previousTasks = { ...tasks }
    setTasks(prev => {
      const newTasks: Record<string, Task[]> = {}
      let movedTask: Task | null = null

      // Find and remove the task from its current stage
      for (const stageId of Object.keys(prev)) {
        const stageTasks = [...(prev[stageId] || [])]
        const taskIndex = stageTasks.findIndex(t => t.id === taskId)
        if (taskIndex !== -1) {
          movedTask = { ...stageTasks[taskIndex], stage_id: newStageId }
          stageTasks.splice(taskIndex, 1)
        }
        newTasks[stageId] = stageTasks
      }

      // Add the task to its new stage at the correct position
      if (movedTask) {
        if (!newTasks[newStageId]) {
          newTasks[newStageId] = []
        }
        newTasks[newStageId].splice(newPosition, 0, movedTask)
      }

      return newTasks
    })

    try {
      await TaskService.moveTask(taskId, newStageId, newPosition)
    } catch (error: any) {
      // Rollback on error
      setTasks(previousTasks)
      toast.error(error.message || 'Failed to move task')
    }
  }

  const handleReorder = async (stageId: string, taskIds: string[]) => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to reorder tasks')
      return
    }

    // Optimistic update - reorder tasks in UI immediately
    const previousTasks = { ...tasks }
    setTasks(prev => {
      const stageTasks = prev[stageId] || []
      const taskMap = new Map(stageTasks.map(t => [t.id, t]))
      const reorderedTasks = taskIds
        .map(id => taskMap.get(id))
        .filter((t): t is Task => t !== undefined)
      return { ...prev, [stageId]: reorderedTasks }
    })

    try {
      await TaskService.reorderTasks(projectId, stageId, taskIds)
    } catch (error: any) {
      // Rollback on error
      setTasks(previousTasks)
      toast.error(error.message || 'Failed to reorder tasks')
    }
  }

  const handleBulkStatusChange = async (taskIds: string[], newStageId: string) => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to move tasks')
      return
    }

    // Optimistic update - move all tasks in UI immediately
    const previousTasks = { ...tasks }
    const taskIdSet = new Set(taskIds)
    setTasks(prev => {
      const newTasks: Record<string, Task[]> = {}
      const movedTasks: Task[] = []

      // Remove tasks from their current stages and collect them
      for (const stageId of Object.keys(prev)) {
        const remaining: Task[] = []
        for (const task of prev[stageId] || []) {
          if (taskIdSet.has(task.id)) {
            movedTasks.push({ ...task, stage_id: newStageId })
          } else {
            remaining.push(task)
          }
        }
        newTasks[stageId] = remaining
      }

      // Add all moved tasks to the new stage
      if (!newTasks[newStageId]) {
        newTasks[newStageId] = []
      }
      newTasks[newStageId] = [...newTasks[newStageId], ...movedTasks]

      return newTasks
    })

    try {
      // Move all tasks to the new stage
      await Promise.all(
        taskIds.map((taskId, index) =>
          TaskService.moveTask(taskId, newStageId, index)
        )
      )
      toast.success(`Moved ${taskIds.length} task${taskIds.length > 1 ? 's' : ''} successfully`)
    } catch (error: any) {
      // Rollback on error
      setTasks(previousTasks)
      toast.error(error.message || 'Failed to move tasks')
    }
  }

  const handleModalClose = () => {
    setShowTaskModal(false)
    setSelectedTask(null)
    setIsCreatingTask(false)
    setDefaultStageId(null)
  }

  const handleTaskCreated = () => {
    fetchProjectData() // Refresh tasks
    handleModalClose()
  }

  // Handler for deleting a task from the card menu
  const handleTaskDelete = async (task: Task) => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to delete tasks')
      return
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) {
      return
    }

    // Optimistic update - remove task from UI immediately
    const previousTasks = { ...tasks }
    setTasks(prev => {
      const newTasks = { ...prev }
      for (const stageId of Object.keys(newTasks)) {
        newTasks[stageId] = newTasks[stageId].filter(t => t.id !== task.id)
      }
      return newTasks
    })

    try {
      await TaskService.deleteTask(task.id)
      toast.success('Task deleted successfully')
    } catch (error: any) {
      // Rollback on error
      setTasks(previousTasks)
      toast.error(error.message || 'Failed to delete task')
    }
  }

  // Handler for duplicating a task
  const handleTaskDuplicate = async (task: Task) => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to create tasks')
      return
    }

    try {
      const newTask = await TaskService.createTask({
        project_id: task.project_id,
        title: `${task.title} (copy)`,
        description: task.description ?? undefined,
        priority: task.priority,
        stage_id: task.stage_id,
        due_date: task.due_date ?? undefined,
        tags: task.tags,
        custom_fields: task.custom_fields,
        color: task.color ?? undefined,
      })

      // Add to tasks list
      setTasks(prev => ({
        ...prev,
        [task.stage_id]: [...(prev[task.stage_id] || []), newTask],
      }))

      toast.success('Task duplicated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to duplicate task')
    }
  }

  // Handler for changing task color
  const handleTaskColorChange = async (task: Task, color: string | null) => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to edit tasks')
      return
    }

    // Optimistic update
    const previousTasks = { ...tasks }
    setTasks(prev => {
      const newTasks = { ...prev }
      for (const stageId of Object.keys(newTasks)) {
        newTasks[stageId] = newTasks[stageId].map(t =>
          t.id === task.id ? { ...t, color } : t
        )
      }
      return newTasks
    })

    try {
      await TaskService.updateTask(task.id, { color })
      toast.success('Task color updated')
    } catch (error: any) {
      // Rollback on error
      setTasks(previousTasks)
      toast.error(error.message || 'Failed to update task color')
    }
  }

  // Handler for approving a task
  const handleTaskApprove = async (task: Task) => {
    if (!permissions.canManageMembers) {
      toast.error('Only owners or admins can approve tasks')
      return
    }

    // Optimistic update
    const previousTasks = { ...tasks }
    setTasks(prev => {
      const newTasks = { ...prev }
      for (const stageId of Object.keys(newTasks)) {
        newTasks[stageId] = newTasks[stageId].map(t =>
          t.id === task.id ? { ...t, approval_status: 'approved' as const, approved_at: new Date().toISOString() } : t
        )
      }
      return newTasks
    })

    try {
      const response = await fetch(`/api/tasks/${task.id}/approve`, {
        method: 'POST',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve task')
      }
      toast.success('Task approved!')
      // Refresh to update counts
      fetchProjectData()
    } catch (error: any) {
      // Rollback on error
      setTasks(previousTasks)
      toast.error(error.message || 'Failed to approve task')
    }
  }

  // Handler for rejecting a task
  const handleTaskReject = async (task: Task) => {
    if (!permissions.canManageMembers) {
      toast.error('Only owners or admins can reject tasks')
      return
    }

    // Optimistic update - move back to To Do
    const previousTasks = { ...tasks }
    setTasks(prev => {
      const newTasks: Record<string, Task[]> = {}
      let rejectedTask: Task | null = null

      // Remove from done stage
      for (const stageId of Object.keys(prev)) {
        if (stageId === 'done') {
          newTasks[stageId] = prev[stageId].filter(t => {
            if (t.id === task.id) {
              rejectedTask = { ...t, stage_id: 'todo', approval_status: 'rejected' as const, rejection_reason: null }
              return false
            }
            return true
          })
        } else {
          newTasks[stageId] = [...prev[stageId]]
        }
      }

      // Add to To Do stage
      if (rejectedTask) {
        if (!newTasks['todo']) newTasks['todo'] = []
        newTasks['todo'] = [...newTasks['todo'], rejectedTask]
      }

      return newTasks
    })

    try {
      const response = await fetch(`/api/tasks/${task.id}/approve`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnStageId: 'todo' }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reject task')
      }
      toast.success('Task rejected and moved to To Do')
    } catch (error: any) {
      // Rollback on error
      setTasks(previousTasks)
      toast.error(error.message || 'Failed to reject task')
    }
  }

  if (loading || permissionsLoading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="max-w-7xl mx-auto">
          <SkeletonProjectHeader />
          <div className="mt-6">
            <SkeletonKanbanBoard />
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Project not found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">The project you're looking for doesn't exist or you don't have access to it.</p>
        <button
          onClick={() => router.push('/app/projects')}
          className="btn btn-md btn-primary"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  const getRoleBadgeClasses = () => {
    if (!permissions.role) return 'bg-gray-100 text-gray-600'
    const colorMap: Record<string, string> = {
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    }
    return colorMap[roleConfig[permissions.role].color] || colorMap.gray
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
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
                  {permissions.role && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getRoleBadgeClasses()}`}>
                      {roleConfig[permissions.role].label}
                    </span>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400">{project.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {permissions.canEdit && (
                <button
                  onClick={handleCreateTask}
                  className="btn btn-md btn-primary"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Task
                </button>
              )}
            </div>
          </div>

          {/* Project Stats */}
          <div className="flex items-center flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {project.tasks_count} tasks
            </div>
            <div className="flex items-center text-green-600 dark:text-green-400">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {project.completed_tasks_count} completed
            </div>
            {(project.pending_approval_count || 0) > 0 && (
              <button
                onClick={() => {
                  setShowPendingOnly(!showPendingOnly)
                  setActiveTab('board')
                }}
                className={`flex items-center transition-colors ${
                  showPendingOnly
                    ? 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/40 px-2 py-0.5 rounded-full'
                    : 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300'
                }`}
                title={showPendingOnly ? 'Click to show all tasks' : 'Click to filter pending approval tasks'}
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {project.pending_approval_count} pending approval
                {showPendingOnly && (
                  <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            )}
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {project.members.length} members
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('board')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'board'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Board
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Members
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'board' && (
          <>
            {/* Pending Approval Filter Banner */}
            {showPendingOnly && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center justify-between">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                  </svg>
                  Showing only tasks pending approval
                </p>
                <button
                  onClick={() => setShowPendingOnly(false)}
                  className="text-sm text-yellow-700 dark:text-yellow-300 hover:text-yellow-800 dark:hover:text-yellow-200 font-medium"
                >
                  Clear filter
                </button>
              </div>
            )}

            {/* Kanban Board */}
            <KanbanBoard
              project={project}
              tasks={tasks}
              onTaskClick={handleTaskClick}
              onTaskMove={permissions.canEdit ? handleTaskMove : undefined}
              onReorder={permissions.canEdit ? handleReorder : undefined}
              onBulkStatusChange={permissions.canEdit ? handleBulkStatusChange : undefined}
              onAddTask={permissions.canEdit ? handleAddTaskFromColumn : undefined}
              onTaskDelete={permissions.canEdit ? handleTaskDelete : undefined}
              onTaskDuplicate={permissions.canEdit ? handleTaskDuplicate : undefined}
              onTaskColorChange={permissions.canEdit ? handleTaskColorChange : undefined}
              onTaskApprove={permissions.canManageMembers ? handleTaskApprove : undefined}
              onTaskReject={permissions.canManageMembers ? handleTaskReject : undefined}
              canApprove={permissions.canManageMembers}
              filterPendingApproval={showPendingOnly}
            />

            {/* Read-only notice for viewers */}
            {!permissions.canEdit && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  You have view-only access to this project. Contact an admin or owner to request edit permissions.
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'members' && (
          <MemberManagement
            projectId={projectId}
            currentUserId={user?.id || ''}
          />
        )}

        {activeTab === 'settings' && (
          <SlackIntegration
            projectId={projectId}
            canManage={permissions.canManageMembers}
          />
        )}

        {/* Task Modal */}
        {showTaskModal && (
          <TaskModal
            project={project}
            task={selectedTask}
            isOpen={showTaskModal}
            onClose={handleModalClose}
            onUpdate={permissions.canEdit ? handleTaskUpdate : undefined}
            onCreate={isCreatingTask && permissions.canEdit ? handleTaskCreated : undefined}
            readOnly={!permissions.canEdit}
            defaultStageId={defaultStageId}
          />
        )}
      </div>
    </div>
  )
}
