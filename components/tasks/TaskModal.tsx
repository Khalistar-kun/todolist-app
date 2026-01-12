"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { Project, Task, Comment } from '@/lib/supabase'
import { TaskService, type TaskWithDetails } from '@/lib/services/TaskService'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete'
import { MentionAutocomplete, MentionText } from '@/components/mentions/MentionAutocomplete'

interface CommentWithUser extends Comment {
  user?: {
    id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
  }
}

interface TaskModalProps {
  project: Project
  task?: Task | TaskWithDetails | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: (task: Task) => void
  onCreate?: () => void
  readOnly?: boolean
  defaultStageId?: string | null
}

interface TaskLink {
  url: string
  label: string
}

interface TaskFormData {
  title: string
  description: string
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  due_date: string
  tags: string[]
  stage_id: string
  links: TaskLink[]
  color: string | null
  assignees: string[]
}

interface ProjectMember {
  user_id: string
  role: string
  user: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

// Preset colors for task color picker - must match database constraint
const TASK_COLORS = [
  { value: null, label: 'Default', color: 'transparent' },
  { value: '#EF4444', label: 'Red', color: '#EF4444' },
  { value: '#F97316', label: 'Orange', color: '#F97316' },
  { value: '#EAB308', label: 'Yellow', color: '#EAB308' },
  { value: '#22C55E', label: 'Green', color: '#22C55E' },
  { value: '#3B82F6', label: 'Blue', color: '#3B82F6' },
  { value: '#8B5CF6', label: 'Purple', color: '#8B5CF6' },
  { value: '#EC4899', label: 'Pink', color: '#EC4899' },
]

export function TaskModal({
  project,
  task,
  isOpen,
  onClose,
  onUpdate,
  onCreate,
  readOnly = false,
  defaultStageId,
}: TaskModalProps) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'comments' | 'activity'>('details')
  const [taskDetails, setTaskDetails] = useState<TaskWithDetails | null>(null)
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    priority: 'none',
    due_date: '',
    tags: [],
    stage_id: defaultStageId || project.workflow_stages?.[0]?.id || 'todo',
    links: [],
    color: null,
    assignees: [],
  })
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  const [newComment, setNewComment] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [newTag, setNewTag] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [comments, setComments] = useState<CommentWithUser[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [addingComment, setAddingComment] = useState(false)

  // Refs for mention autocomplete positioning
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const subtaskInputRef = useRef<HTMLInputElement>(null)
  const commentMentionDropdownRef = useRef<HTMLDivElement>(null)
  const subtaskMentionDropdownRef = useRef<HTMLDivElement>(null)

  // Mention autocomplete for comments
  const commentMention = useMentionAutocomplete(newComment, {
    projectId: project.id,
  })

  // Mention autocomplete for subtasks
  const subtaskMention = useMentionAutocomplete(newSubtask, {
    projectId: project.id,
  })

  const isEditing = !!task

  // Fetch project members when modal opens
  useEffect(() => {
    if (isOpen && !readOnly) {
      const fetchMembers = async () => {
        setMembersLoading(true)
        try {
          const response = await fetch(`/api/projects/${project.id}/members`)
          const data = await response.json()
          if (response.ok) {
            setProjectMembers(data.members || [])
          }
        } catch (error) {
          console.error('Error fetching project members:', error)
        } finally {
          setMembersLoading(false)
        }
      }
      fetchMembers()
    }
  }, [isOpen, project.id, readOnly])

  // Load comments when switching to comments tab
  const loadComments = useCallback(async (taskId: string) => {
    setCommentsLoading(true)
    try {
      const taskComments = await TaskService.getTaskComments(taskId)
      setComments(taskComments as CommentWithUser[])
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  // Load comments when tab changes to comments
  useEffect(() => {
    if (activeTab === 'comments' && taskDetails?.id) {
      loadComments(taskDetails.id)
    }
  }, [activeTab, taskDetails?.id, loadComments])

  useEffect(() => {
    if (task && isEditing) {
      // Load full task details
      loadTaskDetails(task.id)
      // Extract links from custom_fields
      const existingLinks = (task.custom_fields?.links as TaskLink[]) || []
      // Get existing assignees if available
      const existingAssignees = (task as TaskWithDetails).assignees?.map(a => a.id) || []
      setFormData({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        due_date: task.due_date || '',
        tags: task.tags || [],
        stage_id: task.stage_id,
        links: existingLinks,
        color: task.color || null,
        assignees: existingAssignees,
      })
    } else {
      // Reset form for new task
      setFormData({
        title: '',
        description: '',
        priority: 'none',
        due_date: '',
        tags: [],
        stage_id: defaultStageId || project.workflow_stages?.[0]?.id || 'todo',
        links: [],
        color: null,
        assignees: [],
      })
      setTaskDetails(null)
    }
  }, [task, isEditing, project.workflow_stages, defaultStageId])

  const loadTaskDetails = async (taskId: string) => {
    try {
      const details = await TaskService.getTask(taskId)
      setTaskDetails(details)
    } catch (error) {
      console.error('Error loading task details:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Prepare data with links stored in custom_fields
      const { links, color, assignees, ...restFormData } = formData
      const taskData = {
        ...restFormData,
        color: color, // Include color in task data
        custom_fields: {
          ...(task?.custom_fields || {}),
          links: links.length > 0 ? links : undefined,
        },
      }

      if (isEditing && task) {
        // Update existing task
        const updatedTask = await TaskService.updateTask(task.id, taskData)
        // Update assignees separately if changed
        if (assignees.length > 0 || (task as TaskWithDetails).assignees?.length > 0) {
          await TaskService.assignTask(task.id, assignees)
        }
        onUpdate?.(updatedTask)
        toast.success('Task updated successfully')
      } else {
        // Create new task with assignees
        await TaskService.createTask({
          ...taskData,
          project_id: project.id,
          assignees: assignees.length > 0 ? assignees : undefined,
        })
        onCreate?.()
        toast.success('Task created successfully')
      }
      onClose()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save task')
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !taskDetails) return

    setAddingComment(true)
    try {
      // Use API endpoint for comments (includes notifications)
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskDetails.id,
          project_id: project.id,
          content: newComment.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to add comment')

      setNewComment('')
      // Refresh comments and task details
      await Promise.all([
        loadComments(taskDetails.id),
        loadTaskDetails(taskDetails.id),
      ])
      toast.success('Comment added')
    } catch (error: any) {
      toast.error(error.message || 'Failed to add comment')
    } finally {
      setAddingComment(false)
    }
  }

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !taskDetails) return

    try {
      await TaskService.createSubtask(taskDetails.id, newSubtask.trim())
      setNewSubtask('')
      await loadTaskDetails(taskDetails.id)
      toast.success('Subtask added')
    } catch (error: any) {
      toast.error(error.message || 'Failed to add subtask')
    }
  }

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault()
      if (!formData.tags.includes(newTag.trim())) {
        setFormData({
          ...formData,
          tags: [...formData.tags, newTag.trim()],
        })
      }
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove),
    })
  }

  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return

    // Validate URL format
    let url = newLinkUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    const newLink: TaskLink = {
      url,
      label: newLinkLabel.trim() || url,
    }

    setFormData({
      ...formData,
      links: [...formData.links, newLink],
    })
    setNewLinkUrl('')
    setNewLinkLabel('')
  }

  const removeLink = (index: number) => {
    setFormData({
      ...formData,
      links: formData.links.filter((_, i) => i !== index),
    })
  }

  const toggleSubtask = async (subtaskId: string, completed: boolean) => {
    if (!taskDetails) return

    try {
      await TaskService.updateSubtask(subtaskId, { completed })
      await loadTaskDetails(taskDetails.id)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update subtask')
    }
  }

  const completedSubtasks = taskDetails?.subtasks.filter(st => st.completed).length || 0
  const totalSubtasks = taskDetails?.subtasks.length || 0
  const subtaskProgress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0

  if (!isOpen) return null

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in" />
        <Dialog.Content className="fixed inset-0 sm:inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl md:max-h-[90vh] sm:max-h-[85vh] bg-white dark:bg-gray-900 sm:rounded-xl shadow-2xl z-50 flex flex-col border-0 sm:border border-gray-200 dark:border-gray-700 animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
              {readOnly ? 'View Task' : isEditing ? 'Edit Task' : 'Create Task'}
            </Dialog.Title>
            <Dialog.Close className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Left Side - Form */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto min-h-0">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Task Title {!readOnly && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                    placeholder="Enter task title"
                    required
                    disabled={readOnly}
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                    placeholder="Add task description..."
                    disabled={readOnly}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Priority */}
                  <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Priority
                    </label>
                    <select
                      id="priority"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors appearance-none cursor-pointer disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                      disabled={readOnly}
                    >
                      <option value="none">None</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  {/* Due Date */}
                  <div>
                    <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Due Date
                    </label>
                    <input
                      type="datetime-local"
                      id="due_date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                      disabled={readOnly}
                    />
                  </div>
                </div>

                {/* Stage */}
                <div>
                  <label htmlFor="stage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Stage
                  </label>
                  <select
                    id="stage"
                    value={formData.stage_id}
                    onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors appearance-none cursor-pointer disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                    disabled={readOnly}
                  >
                    {project.workflow_stages?.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assignees */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Assignees
                  </label>
                  {membersLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                      Loading members...
                    </div>
                  ) : !readOnly ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {projectMembers.map((member) => {
                          const isSelected = formData.assignees.includes(member.user_id)
                          return (
                            <button
                              key={member.user_id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setFormData({
                                    ...formData,
                                    assignees: formData.assignees.filter(id => id !== member.user_id)
                                  })
                                } else {
                                  setFormData({
                                    ...formData,
                                    assignees: [...formData.assignees, member.user_id]
                                  })
                                }
                              }}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                                isSelected
                                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              {member.user.avatar_url ? (
                                <img
                                  src={member.user.avatar_url}
                                  alt={member.user.full_name || member.user.email}
                                  className="w-5 h-5 rounded-full"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                  <span className="text-xs text-white font-medium">
                                    {(member.user.full_name || member.user.email)[0].toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span className="truncate max-w-[120px]">
                                {member.user.full_name || member.user.email}
                              </span>
                              {isSelected && (
                                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {projectMembers.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No team members found</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {formData.assignees.length > 0 ? (
                        formData.assignees.map(userId => {
                          const member = projectMembers.find(m => m.user_id === userId)
                          return member ? (
                            <span key={userId} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {member.user.avatar_url ? (
                                <img src={member.user.avatar_url} alt={member.user.full_name || ''} className="w-5 h-5 rounded-full" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                  <span className="text-xs text-white">{(member.user.full_name || member.user.email)[0].toUpperCase()}</span>
                                </div>
                              )}
                              {member.user.full_name || member.user.email}
                            </span>
                          ) : null
                        })
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No assignees</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Color Label */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Color Label
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TASK_COLORS.map((colorOption) => (
                      <button
                        key={colorOption.label}
                        type="button"
                        onClick={() => !readOnly && setFormData({ ...formData, color: colorOption.value })}
                        disabled={readOnly}
                        className={`relative w-8 h-8 rounded-full border-2 transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed ${
                          formData.color === colorOption.value
                            ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        } ${colorOption.value === null ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                        style={colorOption.value ? { backgroundColor: colorOption.value } : undefined}
                        title={colorOption.label}
                      >
                        {/* Default/None indicator */}
                        {colorOption.value === null && (
                          <svg className="w-full h-full text-gray-400 dark:text-gray-500 p-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        )}
                        {/* Selected checkmark */}
                        {formData.color === colorOption.value && colorOption.value !== null && (
                          <svg className="w-full h-full text-white p-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                  {/* Color preview bar */}
                  {formData.color && (
                    <div className="mt-2 flex items-center gap-2">
                      <div
                        className="w-full h-1.5 rounded-full"
                        style={{ backgroundColor: formData.color }}
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {TASK_COLORS.find(c => c.value === formData.color)?.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Tags
                  </label>
                  <div className="space-y-2">
                    {!readOnly && (
                      <input
                        type="text"
                        id="tags"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={handleAddTag}
                        placeholder="Add tag and press Enter"
                        className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      />
                    )}
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                          >
                            {tag}
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="ml-1.5 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    {formData.tags.length === 0 && readOnly && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No tags</p>
                    )}
                  </div>
                </div>

                {/* Links */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Links
                  </label>
                  <div className="space-y-2">
                    {!readOnly && (
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-2">
                          <input
                            type="url"
                            value={newLinkUrl}
                            onChange={(e) => setNewLinkUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
                          />
                          <input
                            type="text"
                            value={newLinkLabel}
                            onChange={(e) => setNewLinkLabel(e.target.value)}
                            placeholder="Label (optional)"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddLink}
                          disabled={!newLinkUrl.trim()}
                          className="px-3 py-2 h-fit bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors self-start"
                        >
                          Add
                        </button>
                      </div>
                    )}
                    {formData.links.length > 0 && (
                      <div className="space-y-2">
                        {formData.links.map((link, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg group"
                          >
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                            </svg>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                              title={link.url}
                            >
                              {link.label}
                            </a>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => removeLink(index)}
                                className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {formData.links.length === 0 && readOnly && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No links</p>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* Right Side - Details (only for editing) */}
            {isEditing && taskDetails && (
              <div className="w-full md:w-80 md:min-w-[320px] border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800/50 max-h-[50vh] md:max-h-none overflow-hidden">
                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="flex px-4" aria-label="Tabs">
                    {['details', 'subtasks', 'comments'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`py-3 px-3 border-b-2 font-medium text-sm capitalize transition-colors ${
                          activeTab === tab
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        {tab}
                        {tab === 'subtasks' && totalSubtasks > 0 && (
                          <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                            {completedSubtasks}/{totalSubtasks}
                          </span>
                        )}
                        {tab === 'comments' && taskDetails.comments_count > 0 && (
                          <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                            {taskDetails.comments_count}
                          </span>
                        )}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {activeTab === 'details' && (
                    <div className="space-y-4">
                      {/* Subtask Progress - Prominent Display */}
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-gray-800 dark:text-white">Task Progress</span>
                          <span className={`text-2xl font-bold ${
                            subtaskProgress >= 100 ? 'text-green-600 dark:text-green-400' :
                            subtaskProgress >= 50 ? 'text-blue-600 dark:text-blue-400' :
                            'text-gray-600 dark:text-gray-400'
                          }`}>
                            {Math.round(subtaskProgress)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              subtaskProgress >= 100 ? 'bg-green-500' :
                              subtaskProgress >= 50 ? 'bg-blue-500' :
                              'bg-blue-400'
                            }`}
                            style={{ width: `${subtaskProgress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{completedSubtasks} of {totalSubtasks} subtasks completed</span>
                          {subtaskProgress >= 100 && (
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              Complete
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Assignees Summary */}
                      {taskDetails.assignees && taskDetails.assignees.length > 0 && (
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Assigned To</h4>
                          <div className="flex flex-wrap gap-2">
                            {taskDetails.assignees.map((assignee) => (
                              <div key={assignee.id} className="flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                                {assignee.avatar_url ? (
                                  <img src={assignee.avatar_url} alt={assignee.full_name || ''} className="w-5 h-5 rounded-full" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                    <span className="text-xs text-white font-medium">
                                      {(assignee.full_name || assignee.email)[0].toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <span className="text-xs text-gray-700 dark:text-gray-300">
                                  {assignee.full_name || assignee.email}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Time Tracking */}
                      {taskDetails.time_spent > 0 && (
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">Time Tracked</h4>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {Math.floor(taskDetails.time_spent / 60)}h {taskDetails.time_spent % 60}m
                          </p>
                        </div>
                      )}

                      {totalSubtasks === 0 && taskDetails.time_spent === 0 && !taskDetails.assignees?.length && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                          No additional details yet. Add subtasks to track progress.
                        </p>
                      )}
                    </div>
                  )}

                  {activeTab === 'subtasks' && (
                    <div className="space-y-3">
                      {/* Add Subtask */}
                      <div className="relative">
                        <div className="flex gap-2">
                          <input
                            ref={subtaskInputRef}
                            type="text"
                            value={newSubtask}
                            onChange={(e) => {
                              setNewSubtask(e.target.value)
                              subtaskMention.handleTextChange(e.target.value, e.target.selectionStart || 0)
                            }}
                            onKeyDown={(e) => {
                              if (subtaskMention.handleKeyDown(e)) {
                                return
                              }
                              if (e.key === 'Enter') {
                                handleAddSubtask()
                              }
                            }}
                            placeholder="Add subtask... (@ to mention)"
                            className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            onClick={handleAddSubtask}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        {/* Mention Autocomplete */}
                        {subtaskMention.isOpen && (
                          <MentionAutocomplete
                            users={subtaskMention.users}
                            isLoading={subtaskMention.isLoading}
                            isOpen={subtaskMention.isOpen}
                            selectedIndex={subtaskMention.selectedIndex}
                            onSelect={(user) => {
                              const result = subtaskMention.selectUser(user)
                              if (result) {
                                setNewSubtask(result.text)
                                requestAnimationFrame(() => {
                                  subtaskInputRef.current?.focus()
                                  subtaskInputRef.current?.setSelectionRange(result.newCursorPosition, result.newCursorPosition)
                                })
                              }
                            }}
                            anchorRef={subtaskInputRef}
                            dropdownRef={subtaskMentionDropdownRef}
                          />
                        )}
                      </div>

                      {/* Subtasks Progress Mini */}
                      {taskDetails.subtasks.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className={`h-full rounded-full transition-all ${
                                subtaskProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${subtaskProgress}%` }}
                            />
                          </div>
                          <span className="font-medium">{Math.round(subtaskProgress)}%</span>
                        </div>
                      )}

                      {/* Subtasks List */}
                      <div className="space-y-2">
                        {taskDetails.subtasks.map((subtask) => {
                          const assignee = subtask.assignee

                          return (
                            <div key={subtask.id} className="group flex items-start gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                              <input
                                type="checkbox"
                                checked={subtask.completed}
                                onChange={(e) => toggleSubtask(subtask.id, e.target.checked)}
                                className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                              />
                              <div className="flex-1 min-w-0">
                                <span
                                  className={`text-sm block ${
                                    subtask.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <MentionText text={subtask.title} />
                                </span>
                                {/* Assignee display and selector */}
                                <div className="flex items-center gap-2 mt-1.5">
                                  {assignee ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                                      {assignee.avatar_url ? (
                                        <img src={assignee.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                                      ) : (
                                        <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                                          <span className="text-[10px] text-white font-medium">
                                            {(assignee.full_name || assignee.email)[0].toUpperCase()}
                                          </span>
                                        </div>
                                      )}
                                      <span className="text-xs text-blue-700 dark:text-blue-300">
                                        {assignee.full_name || assignee.email}
                                      </span>
                                      {!readOnly && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            await TaskService.updateSubtask(subtask.id, { assigned_to: null })
                                            loadTaskDetails(taskDetails.id)
                                          }}
                                          className="text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300"
                                        >
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      )}
                                    </span>
                                  ) : !readOnly && projectMembers.length > 0 && (
                                    <select
                                      className="text-xs px-2 py-0.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-gray-600 dark:text-gray-400 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                      value=""
                                      onChange={async (e) => {
                                        if (e.target.value) {
                                          await TaskService.updateSubtask(subtask.id, { assigned_to: e.target.value })
                                          loadTaskDetails(taskDetails.id)
                                        }
                                      }}
                                    >
                                      <option value="">Assign to...</option>
                                      {projectMembers.map((member) => (
                                        <option key={member.user_id} value={member.user_id}>
                                          {member.user.full_name || member.user.email}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {taskDetails.subtasks.length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                            No subtasks yet
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'comments' && (
                    <div className="space-y-4">
                      {/* Add Comment */}
                      <div className="relative">
                        <textarea
                          id="task-comment-input"
                          name="comment"
                          ref={commentTextareaRef}
                          value={newComment}
                          onChange={(e) => {
                            setNewComment(e.target.value)
                            commentMention.handleTextChange(e.target.value, e.target.selectionStart || 0)
                          }}
                          onKeyDown={(e) => {
                            if (commentMention.handleKeyDown(e)) {
                              // Mention autocomplete handled the key
                              return
                            }
                          }}
                          placeholder="Add a comment... (type @ to mention)"
                          rows={3}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                        {/* Mention Autocomplete */}
                        {commentMention.isOpen && (
                          <MentionAutocomplete
                            users={commentMention.users}
                            isLoading={commentMention.isLoading}
                            isOpen={commentMention.isOpen}
                            selectedIndex={commentMention.selectedIndex}
                            onSelect={(user) => {
                              const result = commentMention.selectUser(user)
                              if (result) {
                                setNewComment(result.text)
                                // Focus back and set cursor position
                                requestAnimationFrame(() => {
                                  commentTextareaRef.current?.focus()
                                  commentTextareaRef.current?.setSelectionRange(result.newCursorPosition, result.newCursorPosition)
                                })
                              }
                            }}
                            anchorRef={commentTextareaRef}
                            dropdownRef={commentMentionDropdownRef}
                          />
                        )}
                        <button
                          onClick={handleAddComment}
                          disabled={!newComment.trim() || addingComment}
                          className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 dark:disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          {addingComment ? (
                            <>
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                              Adding...
                            </>
                          ) : (
                            'Comment'
                          )}
                        </button>
                      </div>

                      {/* Comments List */}
                      <div className="space-y-3">
                        {commentsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                          </div>
                        ) : comments.length === 0 ? (
                          <div className="text-center py-6">
                            <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p className="text-sm text-gray-500 dark:text-gray-400">No comments yet</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Be the first to comment</p>
                          </div>
                        ) : (
                          comments.map((comment) => (
                            <div key={comment.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                              {/* Avatar */}
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                {comment.user?.avatar_url ? (
                                  <img
                                    src={comment.user.avatar_url}
                                    alt={comment.user.full_name || 'User'}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                    {(comment.user?.full_name || comment.user?.email || 'U')[0].toUpperCase()}
                                  </span>
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {comment.user?.full_name || comment.user?.email || 'Unknown'}
                                  </span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap break-words">
                                  <MentionText text={comment.content} />
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={loading || !formData.title.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
                onClick={handleSubmit}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </span>
                ) : isEditing ? 'Update Task' : 'Create Task'}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
