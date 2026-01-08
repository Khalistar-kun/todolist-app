import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock, Tag } from 'lucide-react'
import type { BlogPost } from '@/lib/blog/types'
import { formatDate } from '@/lib/blog/seo'

interface PostCardProps {
  post: BlogPost
}

export function PostCard({ post }: PostCardProps) {
  const readingTime = post.reading_time || 5

  return (
    <article className="group bg-white rounded-card overflow-hidden border border-gray-100 hover:border-brand-300 transition-all duration-200 hover:shadow-soft-md">
      <Link href={`/blog/${post.slug}`} className="block">
        {/* Featured Image */}
        <div className="relative aspect-[16/9] bg-gray-100 overflow-hidden">
          {post.featured_image_url ? (
            <Image
              src={post.featured_image_url}
              alt={post.featured_image_alt || post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
              <svg
                className="w-16 h-16 text-brand-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                />
              </svg>
            </div>
          )}

          {/* Category Badge */}
          {post.category && (
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-500 text-white shadow-sm">
                {post.category.name}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Meta Info */}
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <time dateTime={post.published_at || post.created_at}>
                {formatDate(post.published_at || post.created_at)}
              </time>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{readingTime} min read</span>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-brand-600 transition-colors">
            {post.title}
          </h2>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-gray-600 text-sm line-clamp-3 mb-4">
              {post.excerpt}
            </p>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-gray-400" />
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="text-xs text-gray-500 hover:text-brand-600 transition-colors"
                >
                  {tag.name}
                </span>
              ))}
              {post.tags.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{post.tags.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Author */}
          {post.author && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-brand-100">
                {post.author.avatar_url ? (
                  <Image
                    src={post.author.avatar_url}
                    alt={post.author.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-medium text-brand-700">
                    {post.author.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="text-sm">
                <p className="font-medium text-gray-900">{post.author.name}</p>
              </div>
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}
