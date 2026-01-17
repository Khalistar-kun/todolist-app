"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/AuthProvider'
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
import { TimelineView } from '@/components/timeline'
import { ReportingDashboard } from '@/components/reporting'
import { WorkloadView } from '@/components/workload'
import { ActivityFeed } from '@/components/activity'
import { AISuggestions } from '@/components/ai'
import type { TaskSuggestion } from '@/lib/services/AITaskService'
import toast from 'react-hot-toast'

type TabType = 'board' | 'timeline' | 'reports' | 'workload' | 'activity' | 'members' | 'settings'

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
  const [forceReadOnly, setForceReadOnly] = useState(false)
  const [showPendingOnly, setShowPendingOnly] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Edit project modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null)
  const [savingProject, setSavingProject] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

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
    setForceReadOnly(false)
    setShowTaskModal(true)
  }

  // Handler for timeline task clicks - opens in read-only view mode
  const handleTimelineTaskClick = (task: Task) => {
    setSelectedTask(task)
    setForceReadOnly(true)
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
        const stageTasks = newTasks[stageId] || []
        newTasks[stageId] = stageTasks.map(t =>
          t.id === updatedTask.id ? updatedTask : t
        )
      }
      // Handle stage change
      if (updatedTask.stage_id !== selectedTask?.stage_id) {
        // Remove from old stage
        if (selectedTask?.stage_id) {
          newTasks[selectedTask.stage_id] = (newTasks[selectedTask.stage_id] || []).filter(t => t.id !== updatedTask.id)
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
    setForceReadOnly(false)
  }

  const handleTaskCreated = () => {
    fetchProjectData() // Refresh tasks
    handleModalClose()
  }

  // Handler for voice command task creation (supports extended data from wizard)
  const handleVoiceCreateTask = useCallback(async (taskData: {
    title: string
    description?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    due_date?: string
    assignee_ids?: string[]
  }) => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to create tasks')
      return
    }

    if (!project) return

    try {
      // Get the first stage (usually "To Do" or similar)
      const firstStage = project.workflow_stages?.[0]?.id || 'todo'

      await TaskService.createTask({
        project_id: projectId,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority || 'none',
        stage_id: firstStage,
        due_date: taskData.due_date,
        assignees: taskData.assignee_ids,
      })

      // Refresh tasks list
      fetchProjectData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create task')
    }
  }, [permissions.canEdit, project, projectId, fetchProjectData])

  // Handler for deleting a task from the card menu
  const handleTaskDelete = async (task: Task) => {
    if (!permissions.canDelete) {
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

  // Handler for deleting the project (owner only)
  const handleDeleteProject = async () => {
    if (!project || deleteConfirmation !== project.name) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast.success('Project deleted successfully')
      router.push('/app/projects')
    } catch (error: any) {
      console.error('Error deleting project:', error)
      toast.error(error.message || 'Failed to delete project')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
      setDeleteConfirmation('')
    }
  }

  // Open edit modal with current values
  const handleOpenEditModal = () => {
    if (!project) return
    setEditName(project.name)
    setEditDescription(project.description || '')
    setEditImageUrl((project as any).image_url || null)
    setShowEditModal(true)
  }

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }

    // Convert to base64 data URL
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setEditImageUrl(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  // Save project changes
  const handleSaveProject = async () => {
    if (!editName.trim()) {
      toast.error('Project name cannot be empty')
      return
    }

    setSavingProject(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          image_url: editImageUrl,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast.success('Project updated successfully')
      setShowEditModal(false)
      // Refresh project data
      refetchProjectDataSilently()
    } catch (error: any) {
      console.error('Error updating project:', error)
      toast.error(error.message || 'Failed to update project')
    } finally {
      setSavingProject(false)
    }
  }

  // Handler for AI Insight action clicks
  const handleAIActionClick = async (action: TaskSuggestion['action']) => {
    if (!action) return

    switch (action.type) {
      case 'navigate':
        // Navigate to task or view
        if (action.payload.task_id) {
          // Find the task and open the modal
          const allTasks = Object.values(tasks).flat()
          const task = allTasks.find(t => t.id === action.payload.task_id)
          if (task) {
            setSelectedTask(task)
            setForceReadOnly(false)
            setShowTaskModal(true)
          } else {
            toast.error('Task not found')
          }
        } else if (action.payload.view === 'workload') {
          setActiveTab('workload')
        } else if (action.payload.filter === 'no_due_date') {
          // Could implement filter in the future, for now switch to board
          setActiveTab('board')
          toast('Showing all tasks - filter for no due date not yet implemented')
        }
        break

      case 'update_priority':
        // Update task priority
        if (action.payload.task_id && action.payload.new_priority) {
          try {
            await TaskService.updateTask(action.payload.task_id, {
              priority: action.payload.new_priority
            })
            toast.success('Task priority updated')
            fetchProjectData() // Refresh tasks
          } catch (error: any) {
            toast.error(error.message || 'Failed to update priority')
          }
        }
        break

      case 'reassign':
        // Open task for reassignment
        if (action.payload.task_id) {
          const allTasks = Object.values(tasks).flat()
          const task = allTasks.find(t => t.id === action.payload.task_id)
          if (task) {
            setSelectedTask(task)
            setForceReadOnly(false)
            setShowTaskModal(true)
          }
        }
        break

      case 'set_due_date':
        // Open task for setting due date
        if (action.payload.task_id) {
          const allTasks = Object.values(tasks).flat()
          const task = allTasks.find(t => t.id === action.payload.task_id)
          if (task) {
            setSelectedTask(task)
            setForceReadOnly(false)
            setShowTaskModal(true)
          }
        }
        break

      default:
        console.warn('Unknown action type:', action.type)
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
          <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
              {/* Project Image/Avatar */}
              <button
                onClick={permissions.canEdit ? handleOpenEditModal : undefined}
                className={`relative flex-shrink-0 ${permissions.canEdit ? 'cursor-pointer group' : ''}`}
                disabled={!permissions.canEdit}
              >
                {(project as any).image_url ? (
                  <img
                    src={(project as any).image_url}
                    alt={project.name}
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl"
                    style={{ backgroundColor: project.color }}
                  >
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {permissions.canEdit && (
                  <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </div>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white truncate">{project.name}</h1>
                  {permissions.canEdit && (
                    <button
                      onClick={handleOpenEditModal}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title="Edit project"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                  )}
                  {permissions.role && (
                    <span className={`text-xs font-medium px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap ${getRoleBadgeClasses()}`}>
                      {roleConfig[permissions.role].label}
                    </span>
                  )}
                </div>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 line-clamp-2 sm:line-clamp-none">{project.description}</p>
              </div>
            </div>
            {/* Desktop: Full button */}
            {permissions.canEdit && (
              <button
                onClick={handleCreateTask}
                className="hidden sm:inline-flex btn btn-md btn-primary flex-shrink-0"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Task
              </button>
            )}
            {/* Mobile: Icon-only button */}
            {permissions.canEdit && (
              <button
                onClick={handleCreateTask}
                className="sm:hidden w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-all tap-highlight-none flex-shrink-0"
                aria-label="Add Task"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
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
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('board')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
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
              onClick={() => setActiveTab('timeline')}
              className={`hidden sm:block py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'timeline'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              Timeline
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Reports
            </button>
            <button
              onClick={() => setActiveTab('workload')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'workload'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              Workload
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'activity'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Activity
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
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
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
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
          <div className="overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
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
              onTaskDelete={permissions.canDelete ? handleTaskDelete : undefined}
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

            {/* AI Insights moved to floating FAB container */}
          </div>
        )}

        {activeTab === 'members' && (
          <MemberManagement
            projectId={projectId}
            currentUserId={user?.id || ''}
          />
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <SlackIntegration
              projectId={projectId}
              canManage={permissions.canManageMembers}
            />

            {/* Danger Zone - Only visible to owner */}
            {permissions.role === 'owner' && (
              <div className="card border-red-200 dark:border-red-900/50">
                <div className="px-5 py-4 border-b border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 rounded-t-xl">
                  <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Delete this project</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Once deleted, all tasks, comments, and data will be permanently removed.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="btn btn-md bg-red-600 hover:bg-red-700 text-white flex-shrink-0"
                    >
                      Delete Project
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <TimelineView
            tasks={Object.values(tasks).flat()}
            workflowStages={project.workflow_stages || []}
            onTaskClick={handleTimelineTaskClick}
          />
        )}

        {activeTab === 'reports' && (
          <ReportingDashboard projectId={projectId} />
        )}

        {activeTab === 'workload' && (
          <WorkloadView projectId={projectId} />
        )}

        {activeTab === 'activity' && (
          <ActivityFeed projectId={projectId} />
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
            readOnly={forceReadOnly || !permissions.canEdit}
            defaultStageId={defaultStageId}
          />
        )}

        {/* Delete Project Modal */}
        {showDeleteModal && project && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full animate-slide-up">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Project</h2>
                </div>
              </div>
              <div className="px-6 py-4 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This action <strong className="text-red-600 dark:text-red-400">cannot be undone</strong>. This will permanently delete the project <strong>{project.name}</strong> and all its tasks, comments, and data.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type <strong>{project.name}</strong> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    className="input w-full"
                    placeholder={project.name}
                    autoFocus
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmation('') }}
                  className="btn btn-md btn-secondary"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={deleting || deleteConfirmation !== project.name}
                  className="btn btn-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Project Modal */}
        {showEditModal && project && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full animate-slide-up">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Project</h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                {/* Project Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project Image
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="relative group"
                    >
                      {editImageUrl ? (
                        <img
                          src={editImageUrl}
                          alt="Project"
                          className="w-20 h-20 rounded-xl object-cover border-2 border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div
                          className="w-20 h-20 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
                          style={{ backgroundColor: project.color }}
                        >
                          {editName.charAt(0).toUpperCase() || project.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                        </svg>
                      </div>
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Click to upload an image
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        PNG, JPG up to 2MB
                      </p>
                      {editImageUrl && (
                        <button
                          type="button"
                          onClick={() => setEditImageUrl(null)}
                          className="text-xs text-red-600 hover:text-red-700 mt-1"
                        >
                          Remove image
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Project Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input w-full"
                    placeholder="Enter project name"
                    required
                  />
                </div>

                {/* Project Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="input w-full resize-none"
                    rows={3}
                    placeholder="Enter project description"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-md btn-secondary"
                  disabled={savingProject}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProject}
                  disabled={savingProject || !editName.trim()}
                  className="btn btn-md btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingProject ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating AI Quests Button - Bottom Right */}
        {project && (
          <div className="fixed bottom-4 right-4 z-40">
            <AISuggestions
              projectId={projectId}
              projectName={project.name}
              onActionClick={handleAIActionClick}
              onCreateTask={permissions.canEdit ? handleVoiceCreateTask : undefined}
              useEnhancedAI={true}
              members={project.members}
              inline={true}
            />
          </div>
        )}
      </div>
    </div>
  )
}
