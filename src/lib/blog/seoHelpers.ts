/**
 * SEO Helper Utilities
 * Helper functions for implementing SEO features in blog posts
 */

import { generateTOCServer, type TOCItem } from './generateTOC'
import { generateFAQSchemaFromBlogFAQs, type FAQSchemaItem } from './generateFAQSchema'
import type { BlogPost, BlogFAQ } from './types'

/**
 * Process blog post content and generate all SEO enhancements
 * Returns enhanced content with TOC IDs and all schema data
 */
export interface ProcessedBlogPost {
  originalContent: string
  enhancedContent: string
  toc: TOCItem[]
  faqSchema: Record<string, any> | null
  readingTime: number
}

export function processBlogPostForSEO(
  post: BlogPost,
  options?: {
    baseUrl?: string
  }
): ProcessedBlogPost {
  // Generate TOC
  const { toc, updatedHtml } = generateTOCServer(post.content)

  // Generate FAQ schema if FAQs exist
  let faqSchema = null
  if (post.faqs && post.faqs.length > 0) {
    const pageUrl = options?.baseUrl ? `${options.baseUrl}/blog/${post.slug}` : undefined
    faqSchema = generateFAQSchemaFromBlogFAQs(post.faqs as BlogFAQ[], pageUrl)
  }

  // Calculate reading time (average 200 words per minute)
  const wordCount = post.content.replace(/<[^>]*>/g, '').split(/\s+/).length
  const readingTime = Math.ceil(wordCount / 200)

  return {
    originalContent: post.content,
    enhancedContent: updatedHtml,
    toc,
    faqSchema,
    readingTime,
  }
}

/**
 * Generate Article schema.org markup
 */
export function generateArticleSchema(
  post: BlogPost,
  options?: {
    baseUrl?: string
    organizationName?: string
    organizationLogo?: string
  }
): Record<string, any> {
  const pageUrl = options?.baseUrl ? `${options.baseUrl}/blog/${post.slug}` : undefined

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || '',
    image: post.featured_image_url || '',
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at,
  }

  if (pageUrl) {
    schema.url = pageUrl
    schema['@id'] = pageUrl
  }

  if (post.author) {
    schema.author = {
      '@type': 'Person',
      name: post.author.name,
      ...(post.author.avatar_url && { image: post.author.avatar_url }),
      ...(post.author.website && { url: post.author.website }),
    }
  }

  if (options?.organizationName) {
    schema.publisher = {
      '@type': 'Organization',
      name: options.organizationName,
      ...(options.organizationLogo && {
        logo: {
          '@type': 'ImageObject',
          url: options.organizationLogo,
        },
      }),
    }
  }

  return schema
}

/**
 * Generate BreadcrumbList schema.org markup
 */
export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>,
  baseUrl?: string
): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: baseUrl ? `${baseUrl}${item.url}` : item.url,
    })),
  }
}

/**
 * Generate complete SEO metadata for a blog post
 */
export interface BlogPostSEO {
  title: string
  description: string
  canonical: string | null
  ogTitle: string
  ogDescription: string
  ogImage: string | null
  ogUrl: string | null
  twitterTitle: string
  twitterDescription: string
  twitterImage: string | null
  articleSchema: Record<string, any>
  breadcrumbSchema: Record<string, any>
  faqSchema: Record<string, any> | null
}

export function generateBlogPostSEO(
  post: BlogPost,
  options: {
    baseUrl: string
    organizationName: string
    organizationLogo: string
    categoryName?: string
  }
): BlogPostSEO {
  const postUrl = `${options.baseUrl}/blog/${post.slug}`

  // Generate breadcrumb
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
  ]

  if (options.categoryName && post.category) {
    breadcrumbItems.push({
      name: post.category.name,
      url: `/blog/category/${post.category.slug}`,
    })
  }

  breadcrumbItems.push({
    name: post.title,
    url: `/blog/${post.slug}`,
  })

  // Generate schemas
  const articleSchema = generateArticleSchema(post, {
    baseUrl: options.baseUrl,
    organizationName: options.organizationName,
    organizationLogo: options.organizationLogo,
  })

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems, options.baseUrl)

  let faqSchema = null
  if (post.faqs && post.faqs.length > 0) {
    faqSchema = generateFAQSchemaFromBlogFAQs(post.faqs as BlogFAQ[], postUrl)
  }

  return {
    title: post.meta_title || `${post.title} | Blog`,
    description:
      post.meta_description || post.excerpt || post.content.substring(0, 160),
    canonical: post.canonical_url || postUrl,
    ogTitle: post.meta_title || post.title,
    ogDescription: post.meta_description || post.excerpt || '',
    ogImage: post.og_image_url || post.featured_image_url || null,
    ogUrl: postUrl,
    twitterTitle: post.meta_title || post.title,
    twitterDescription: post.meta_description || post.excerpt || '',
    twitterImage: post.og_image_url || post.featured_image_url || null,
    articleSchema,
    breadcrumbSchema,
    faqSchema,
  }
}

/**
 * Inject all schema.org markup into page
 */
export function generateSchemaScriptTags(schemas: Record<string, any>[]): string {
  return schemas
    .filter((schema) => schema && Object.keys(schema).length > 0)
    .map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`)
    .join('\n')
}

/**
 * Extract all internal links from blog content
 * Useful for link analysis and broken link detection
 */
export function extractInternalLinks(htmlContent: string): string[] {
  const regex = /href=["']\/blog\/([^"']+)["']/g
  const links: string[] = []
  let match

  while ((match = regex.exec(htmlContent)) !== null) {
    links.push(match[1])
  }

  return [...new Set(links)] // Remove duplicates
}

/**
 * Calculate content metrics for SEO
 */
export interface ContentMetrics {
  wordCount: number
  readingTime: number // minutes
  headingCount: {
    h1: number
    h2: number
    h3: number
    h4: number
    h5: number
    h6: number
  }
  paragraphCount: number
  imageCount: number
  internalLinkCount: number
  externalLinkCount: number
}

export function calculateContentMetrics(htmlContent: string): ContentMetrics {
  // Word count (strip HTML)
  const textContent = htmlContent.replace(/<[^>]*>/g, '')
  const wordCount = textContent.split(/\s+/).filter(Boolean).length

  // Heading counts
  const headingCount = {
    h1: (htmlContent.match(/<h1/gi) || []).length,
    h2: (htmlContent.match(/<h2/gi) || []).length,
    h3: (htmlContent.match(/<h3/gi) || []).length,
    h4: (htmlContent.match(/<h4/gi) || []).length,
    h5: (htmlContent.match(/<h5/gi) || []).length,
    h6: (htmlContent.match(/<h6/gi) || []).length,
  }

  // Other counts
  const paragraphCount = (htmlContent.match(/<p/gi) || []).length
  const imageCount = (htmlContent.match(/<img/gi) || []).length
  const internalLinkCount = (htmlContent.match(/href=["']\/blog\//gi) || []).length
  const externalLinkCount = (htmlContent.match(/href=["']https?:\/\//gi) || []).length

  return {
    wordCount,
    readingTime: Math.ceil(wordCount / 200),
    headingCount,
    paragraphCount,
    imageCount,
    internalLinkCount,
    externalLinkCount,
  }
}

/**
 * Validate content for SEO best practices
 */
export interface ContentValidation {
  valid: boolean
  warnings: string[]
  errors: string[]
  score: number // 0-100
}

export function validateContentForSEO(
  post: BlogPost,
  htmlContent: string
): ContentValidation {
  const warnings: string[] = []
  const errors: string[] = []
  let score = 100

  const metrics = calculateContentMetrics(htmlContent)

  // Title checks
  if (!post.title || post.title.length < 10) {
    errors.push('Title is too short (minimum 10 characters)')
    score -= 20
  }
  if (post.title && post.title.length > 60) {
    warnings.push('Title may be truncated in search results (over 60 characters)')
    score -= 5
  }

  // Description checks
  if (!post.excerpt && !post.meta_description) {
    errors.push('Missing meta description')
    score -= 15
  }
  if (post.meta_description && post.meta_description.length > 160) {
    warnings.push('Meta description too long (over 160 characters)')
    score -= 5
  }

  // Content checks
  if (metrics.wordCount < 300) {
    warnings.push(`Content is short (${metrics.wordCount} words, recommend 300+ for SEO)`)
    score -= 10
  }
  if (metrics.wordCount > 3000 && metrics.headingCount.h2 < 3) {
    warnings.push('Long content should have more h2 headings for readability')
    score -= 5
  }

  // Heading structure
  if (metrics.headingCount.h1 > 1) {
    errors.push('Multiple h1 tags found (should be only one)')
    score -= 10
  }
  if (metrics.headingCount.h2 === 0 && metrics.wordCount > 500) {
    warnings.push('No h2 headings found - add subheadings for better structure')
    score -= 10
  }

  // Image checks
  if (metrics.imageCount === 0 && metrics.wordCount > 500) {
    warnings.push('Consider adding images to break up text')
    score -= 5
  }
  if (!post.featured_image_url) {
    warnings.push('No featured image set (important for social sharing)')
    score -= 10
  }

  // Link checks
  if (metrics.internalLinkCount === 0 && metrics.wordCount > 500) {
    warnings.push('No internal links found - add links to related content')
    score -= 10
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    score: Math.max(0, Math.min(100, score)),
  }
}
