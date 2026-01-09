"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Comment } from '@/lib/supabase'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface CommentWithAuthor extends Comment {
  author?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

interface QuickCommentPanelProps {
  taskId: string
  projectId: string
  isOpen: boolean
  onClose: () => void
  anchorRect?: DOMRect | null
}

export function QuickCommentPanel({
  taskId,
  projectId,
  isOpen,
  onClose,
  anchorRect,
}: QuickCommentPanelProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Fetch comments on open
  const fetchComments = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          author:profiles!comments_created_by_fkey(id, full_name, avatar_url)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })
        .limit(20)

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('[QuickCommentPanel] Error fetching comments:', error)
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    if (isOpen) {
      fetchComments()
      // Focus input when panel opens
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, fetchComments])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          task_id: taskId,
          project_id: projectId,
          content: newComment.trim(),
          created_by: user.id,
        })
        .select(`
          *,
          author:profiles!comments_created_by_fkey(id, full_name, avatar_url)
        `)
        .single()

      if (error) throw error

      setComments(prev => [...prev, data])
      setNewComment('')
      toast.success('Comment added')
    } catch (error: any) {
      console.error('[QuickCommentPanel] Error adding comment:', error)
      toast.error(error.message || 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Ctrl+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  if (!isOpen) return null

  // Calculate position
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  }

  if (anchorRect) {
    // Position below the anchor, aligned to the right
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const panelWidth = 320
    const panelHeight = 400

    let left = anchorRect.right - panelWidth
    let top = anchorRect.bottom + 8

    // Keep within viewport
    if (left < 16) left = 16
    if (left + panelWidth > viewportWidth - 16) left = viewportWidth - panelWidth - 16
    if (top + panelHeight > viewportHeight - 16) {
      // Position above if not enough space below
      top = anchorRect.top - panelHeight - 8
    }

    style.left = `${left}px`
    style.top = `${top}px`
  } else {
    // Center fallback
    style.left = '50%'
    style.top = '50%'
    style.transform = 'translate(-50%, -50%)'
  }

  return (
    <>
      {/* Backdrop for focus trap */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      <div
        ref={panelRef}
        style={style}
        className="w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[400px] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Comments
            {comments.length > 0 && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                ({comments.length})
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px]">
          {loading ? (
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
              <div key={comment.id} className="group">
                <div className="flex items-start gap-2">
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex-shrink-0 flex items-center justify-center">
                    {comment.author?.avatar_url ? (
                      <img
                        src={comment.author.avatar_url}
                        alt={comment.author.full_name || 'User'}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {(comment.author?.full_name || 'U')[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {comment.author?.full_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <textarea
            ref={inputRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
            rows={2}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Ctrl+Enter to send
            </span>
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white disabled:text-gray-500 dark:disabled:text-gray-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
              Send
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
