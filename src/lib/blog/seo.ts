import type { Metadata } from 'next'
import type { BlogPost, BlogCategory } from './types'
import type { Article, BreadcrumbList, FAQPage, WithContext } from 'schema-dts'

// Table of Contents Interface
export interface TOCItem {
  id: string
  text: string
  level: number
  children?: TOCItem[]
}

/**
 * Extract table of contents from HTML content
 * Parses H2 and H3 tags and creates a nested structure
 */
export function generateTableOfContents(htmlContent: string): TOCItem[] {
  const headingRegex = /<h([23])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi
  const headings: TOCItem[] = []
  const stack: TOCItem[] = []

  let match
  while ((match = headingRegex.exec(htmlContent)) !== null) {
    const level = parseInt(match[1])
    const id = match[2]
    const text = match[3].replace(/<[^>]*>/g, '') // Strip HTML tags

    const item: TOCItem = { id, text, level }

    if (level === 2) {
      headings.push(item)
      stack.length = 0
      stack.push(item)
    } else if (level === 3 && stack.length > 0) {
      const parent = stack[stack.length - 1]
      if (!parent.children) {
        parent.children = []
      }
      parent.children.push(item)
    }
  }

  return headings
}

/**
 * Add IDs to headings in HTML content for anchor linking
 */
export function addHeadingIds(htmlContent: string): string {
  return htmlContent.replace(
    /<h([23])>([^<]+)<\/h\1>/gi,
    (match, level, text) => {
      const id = slugify(text)
      return `<h${level} id="${id}">${text}</h${level}>`
    }
  )
}

/**
 * Simple slugify function for heading IDs
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Calculate estimated reading time from HTML content
 */
export function calculateReadingTime(htmlContent: string): number {
  const text = htmlContent.replace(/<[^>]*>/g, '')
  const wordCount = text.split(/\s+/).length
  const wordsPerMinute = 200
  return Math.ceil(wordCount / wordsPerMinute)
}

/**
 * Generate Next.js metadata for blog post
 */
export function generateBlogPostMetadata(
  post: BlogPost,
  baseUrl: string = 'https://todoapp.com'
): Metadata {
  const url = `${baseUrl}/blog/${post.slug}`
  const title = post.meta_title || post.title
  const description = post.meta_description || post.excerpt || ''
  const imageUrl = post.og_image_url || post.featured_image_url || `${baseUrl}/og-default.jpg`
  const canonicalUrl = post.canonical_url || url

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at,
      authors: post.author ? [post.author.name] : undefined,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: post.featured_image_alt || post.title,
        },
      ],
      tags: post.tags?.map((tag) => tag.name) || undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      creator: post.author?.twitter ? `@${post.author.twitter}` : undefined,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    authors: post.author
      ? [
          {
            name: post.author.name,
            url: post.author.website || undefined,
          },
        ]
      : undefined,
    keywords: post.tags?.map((tag) => tag.name).join(', '),
  }
}

/**
 * Generate Next.js metadata for blog listing page
 */
export function generateBlogListingMetadata(
  category?: BlogCategory | null,
  baseUrl: string = 'https://todoapp.com'
): Metadata {
  const title = category
    ? `${category.name} - TodoApp Blog`
    : 'Blog - TodoApp | Task Management Tips & Productivity Insights'

  const description = category
    ? category.meta_description || category.description || `Read articles about ${category.name}`
    : 'Discover task management tips, productivity insights, and workflow optimization strategies on the TodoApp blog.'

  const url = category ? `${baseUrl}/blog?category=${category.slug}` : `${baseUrl}/blog`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: [
        {
          url: `${baseUrl}/og-blog.jpg`,
          width: 1200,
          height: 630,
          alt: 'TodoApp Blog',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${baseUrl}/og-blog.jpg`],
    },
    alternates: {
      canonical: url,
    },
  }
}

/**
 * Generate JSON-LD Article structured data
 */
export function generateArticleSchema(
  post: BlogPost,
  baseUrl: string = 'https://todoapp.com'
): WithContext<Article> {
  const url = `${baseUrl}/blog/${post.slug}`
  const imageUrl = post.featured_image_url || `${baseUrl}/og-default.jpg`

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || undefined,
    image: imageUrl,
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at,
    author: post.author
      ? {
          '@type': 'Person',
          name: post.author.name,
          url: post.author.website || undefined,
        }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'TodoApp',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
      },
    },
    url,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    keywords: post.tags?.map((tag) => tag.name).join(', ') || undefined,
    articleSection: post.category?.name || undefined,
    wordCount: post.content ? post.content.split(/\s+/).length : undefined,
    timeRequired: post.reading_time ? `PT${post.reading_time}M` : undefined,
  }
}

/**
 * Generate JSON-LD FAQ structured data
 */
export function generateFAQSchema(
  faqs: Array<{ question: string; answer: string }>
): WithContext<FAQPage> | null {
  if (!faqs || faqs.length === 0) {
    return null
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

/**
 * Generate JSON-LD BreadcrumbList structured data
 */
export function generateBreadcrumbSchema(
  post: BlogPost,
  baseUrl: string = 'https://todoapp.com'
): WithContext<BreadcrumbList> {
  const items = [
    {
      '@type': 'ListItem' as const,
      position: 1,
      name: 'Home',
      item: baseUrl,
    },
    {
      '@type': 'ListItem' as const,
      position: 2,
      name: 'Blog',
      item: `${baseUrl}/blog`,
    },
  ]

  if (post.category) {
    items.push({
      '@type': 'ListItem' as const,
      position: 3,
      name: post.category.name,
      item: `${baseUrl}/blog?category=${post.category.slug}`,
    })
    items.push({
      '@type': 'ListItem' as const,
      position: 4,
      name: post.title,
      item: `${baseUrl}/blog/${post.slug}`,
    })
  } else {
    items.push({
      '@type': 'ListItem' as const,
      position: 3,
      name: post.title,
      item: `${baseUrl}/blog/${post.slug}`,
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

/**
 * Sanitize HTML content for safe rendering
 * This is a basic implementation - consider using DOMPurify for production
 */
export function sanitizeHTML(html: string): string {
  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

/**
 * Generate social share URLs
 */
export function generateShareUrls(url: string, title: string) {
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  return {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    copy: url,
  }
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ]

  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds)
    if (count >= 1) {
      return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`
    }
  }

  return 'just now'
}
