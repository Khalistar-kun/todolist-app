"use client"

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { Project, Task } from '@/lib/supabase'
import { TaskService, type TaskWithDetails } from '@/lib/services/TaskService'
import { Avatar } from '@/components/Avatar'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface TaskModalProps {
  project: Project
  task?: Task | TaskWithDetails | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: (task: Task) => void
  onCreate?: () => void
}

interface TaskFormData {
  title: string
  description: string
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  due_date: string
  tags: string[]
  stage_id: string
}

export function TaskModal({
  project,
  task,
  isOpen,
  onClose,
  onUpdate,
  onCreate,
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
    stage_id: project.workflow_stages?.[0]?.id || 'todo',
  })

  const [newComment, setNewComment] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [newTag, setNewTag] = useState('')

  const isEditing = !!task

  useEffect(() => {
    if (task && isEditing) {
      // Load full task details
      loadTaskDetails(task.id)
      setFormData({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        due_date: task.due_date || '',
        tags: task.tags || [],
        stage_id: task.stage_id,
      })
    } else {
      // Reset form for new task
      setFormData({
        title: '',
        description: '',
        priority: 'none',
        due_date: '',
        tags: [],
        stage_id: project.workflow_stages?.[0]?.id || 'todo',
      })
      setTaskDetails(null)
    }
  }, [task, isEditing, project.workflow_stages])

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
      if (isEditing && task) {
        // Update existing task
        const updatedTask = await TaskService.updateTask(task.id, formData)
        onUpdate?.(updatedTask)
        toast.success('Task updated successfully')
      } else {
        // Create new task
        await TaskService.createTask({
          ...formData,
          project_id: project.id,
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

    try {
      await TaskService.addComment({
        task_id: taskDetails.id,
        project_id: project.id,
        content: newComment.trim(),
      })
      setNewComment('')
      await loadTaskDetails(taskDetails.id)
      toast.success('Comment added')
    } catch (error: any) {
      toast.error(error.message || 'Failed to add comment')
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
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl md:h-[80vh] bg-white rounded-lg shadow-xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <Dialog.Title className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Task' : 'Create Task'}
            </Dialog.Title>
            <Dialog.Close className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Form Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Side - Form */}
              <div className="flex-1 p-6 overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Title */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                      Task Title *
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter task title"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Add task description..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Priority */}
                    <div>
                      <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <select
                        id="priority"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                      <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
                        Due Date
                      </label>
                      <input
                        type="datetime-local"
                        id="due_date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Stage */}
                  <div>
                    <label htmlFor="stage" className="block text-sm font-medium text-gray-700 mb-1">
                      Stage
                    </label>
                    <select
                      id="stage"
                      value={formData.stage_id}
                      onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      {project.workflow_stages?.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tags */}
                  <div>
                    <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
                      Tags
                    </label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        id="tags"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={handleAddTag}
                        placeholder="Add tag and press Enter"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                      {formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {formData.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="ml-1 text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </div>

              {/* Right Side - Details (only for editing) */}
              {isEditing && taskDetails && (
                <div className="w-80 border-l border-gray-200 flex flex-col">
                  {/* Tabs */}
                  <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                      {['details', 'subtasks', 'comments'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab as any)}
                          className={`py-3 px-1 border-b-2 font-medium text-sm capitalize ${
                            activeTab === tab
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {tab}
                          {tab === 'subtasks' && totalSubtasks > 0 && (
                            <span className="ml-2 text-xs">
                              {completedSubtasks}/{totalSubtasks}
                            </span>
                          )}
                          {tab === 'comments' && taskDetails.comments_count > 0 && (
                            <span className="ml-2 text-xs">
                              {taskDetails.comments_count}
                            </span>
                          )}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'details' && (
                      <div className="space-y-4">
                        {/* Subtask Progress */}
                        {totalSubtasks > 0 && (
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="font-medium">Progress</span>
                              <span className="text-gray-500">{Math.round(subtaskProgress)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                                style={{ width: `${subtaskProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Time Tracking */}
                        {taskDetails.time_spent > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Time Tracked</h4>
                            <p className="text-gray-600 text-sm">
                              {Math.floor(taskDetails.time_spent / 60)}h {taskDetails.time_spent % 60}m
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'subtasks' && (
                      <div className="space-y-3">
                        {/* Add Subtask */}
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={newSubtask}
                            onChange={(e) => setNewSubtask(e.target.value)}
                            placeholder="Add subtask..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                            onKeyPress={(e) => e.key === 'Enter' && handleAddSubtask()}
                          />
                          <button
                            onClick={handleAddSubtask}
                            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                          >
                            Add
                          </button>
                        </div>

                        {/* Subtasks List */}
                        <div className="space-y-2">
                          {taskDetails.subtasks.map((subtask) => (
                            <div key={subtask.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={subtask.completed}
                                onChange={(e) => toggleSubtask(subtask.id, e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span
                                className={`flex-1 text-sm ${
                                  subtask.completed ? 'line-through text-gray-500' : 'text-gray-900'
                                }`}
                              >
                                {subtask.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTab === 'comments' && (
                      <div className="space-y-4">
                        {/* Add Comment */}
                        <div>
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                          />
                          <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim()}
                            className="mt-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
                          >
                            Comment
                          </button>
                        </div>

                        {/* Comments List */}
                        <div className="space-y-3">
                          {taskDetails.comments_count > 0 ? (
                            <p className="text-sm text-gray-500">Loading comments...</p>
                          ) : (
                            <p className="text-sm text-gray-500">No comments yet</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="task-form"
              disabled={loading || !formData.title.trim()}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              onClick={handleSubmit}
            >
              {loading ? 'Saving...' : isEditing ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}