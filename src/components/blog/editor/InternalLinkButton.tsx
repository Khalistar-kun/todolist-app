'use client'

import { useState, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { Link2, Search, X, ExternalLink } from 'lucide-react'
import type { BlogPost } from '@/lib/blog/types'

interface InternalLinkButtonProps {
  editor: Editor | null
}

export function InternalLinkButton({ editor }: InternalLinkButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Fetch posts when modal opens - moved before early return
  useEffect(() => {
    if (isOpen && posts.length === 0) {
      fetchPosts()
    }
  }, [isOpen, posts.length])

  // Filter posts based on search query - moved before early return
  useEffect(() => {
    if (searchQuery) {
      const filtered = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredPosts(filtered)
    } else {
      setFilteredPosts(posts)
    }
    setSelectedIndex(0)
  }, [searchQuery, posts])

  if (!editor) {
    return null
  }

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/blog/posts?status=published&limit=100')
      if (response.ok) {
        const data = await response.json()
        setPosts(data.posts || [])
        setFilteredPosts(data.posts || [])
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const insertLink = (post: BlogPost) => {
    if (!editor) return

    const url = `/blog/${post.slug}`
    const selectedText = editor.state.selection.empty
      ? post.title
      : editor.state.doc.textBetween(
          editor.state.selection.from,
          editor.state.selection.to
        )

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .insertContent(selectedText)
      .run()

    setIsOpen(false)
    setSearchQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev < filteredPosts.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === 'Enter' && filteredPosts[selectedIndex]) {
      e.preventDefault()
      insertLink(filteredPosts[selectedIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setSearchQuery('')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 rounded transition-colors hover:bg-gray-100 text-gray-700"
        title="Insert Internal Link"
      >
        <Link2 size={18} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Insert Internal Link
              </h3>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setSearchQuery('')
                }}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search posts by title or slug..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Posts List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading posts...
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery ? 'No posts found' : 'No published posts available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPosts.map((post, index) => (
                    <button
                      key={post.id}
                      onClick={() => insertLink(post)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        index === selectedIndex
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {post.title}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <ExternalLink size={14} />
                            <span className="truncate">/blog/{post.slug}</span>
                          </p>
                          {post.excerpt && (
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {post.excerpt}
                            </p>
                          )}
                        </div>
                        {post.category && (
                          <span className="flex-shrink-0 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {post.category.name}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div>
                  {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}{' '}
                  {searchQuery && 'found'}
                </div>
                <div className="flex items-center gap-4">
                  <span>
                    <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">
                      ↑↓
                    </kbd>{' '}
                    Navigate
                  </span>
                  <span>
                    <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">
                      Enter
                    </kbd>{' '}
                    Select
                  </span>
                  <span>
                    <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">
                      Esc
                    </kbd>{' '}
                    Close
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
