# Blog Frontend Quick Reference

One-page reference for common blog frontend tasks.

## File Locations

```bash
# Pages
/src/app/blog/page.tsx              # Blog listing
/src/app/blog/[slug]/page.tsx       # Individual post

# Components
/src/components/blog/PostCard.tsx
/src/components/blog/TableOfContents.tsx
/src/components/blog/ShareButtons.tsx
/src/components/blog/FAQSection.tsx

# Utils
/src/lib/blog/seo.ts                # SEO utilities
/src/lib/blog/BlogService.ts        # Data layer
/src/lib/blog/types.ts              # TypeScript types
```

## Common Tasks

### 1. Fetch Published Posts

```tsx
import { BlogService } from '@/lib/blog/BlogService'

// List all published posts with pagination
const { posts, total, totalPages } = await BlogService.listPosts({
  status: 'published',
  page: 1,
  limit: 12,
  sortBy: 'published_at',
  sortOrder: 'desc',
})

// Filter by category
const { posts } = await BlogService.listPosts({
  status: 'published',
  category_id: 'uuid',
})

// Search posts
const { posts } = await BlogService.listPosts({
  status: 'published',
  search: 'productivity',
})
```

### 2. Get Single Post

```tsx
// By slug (for public pages)
const post = await BlogService.getPostBySlug('post-slug')

// By ID (for admin)
const post = await BlogService.getPostById('uuid')

// Check if post exists and is published
if (!post || post.status !== 'published') {
  notFound()
}
```

### 3. Generate SEO Metadata

```tsx
import { generateBlogPostMetadata } from '@/lib/blog/seo'

export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await BlogService.getPostBySlug(params.slug)
  if (!post) return { title: 'Not Found' }

  return generateBlogPostMetadata(post, 'https://todoapp.com')
}
```

### 4. Generate Table of Contents

```tsx
import { addHeadingIds, generateTableOfContents } from '@/lib/blog/seo'

// 1. Add IDs to headings
const contentWithIds = addHeadingIds(post.content)

// 2. Extract TOC structure
const tocItems = generateTableOfContents(contentWithIds)

// 3. Render component
<TableOfContents items={tocItems} />
```

### 5. Add Structured Data

```tsx
import {
  generateArticleSchema,
  generateBreadcrumbSchema,
  generateFAQSchema,
} from '@/lib/blog/seo'

// Article schema
const articleSchema = generateArticleSchema(post, baseUrl)

// Breadcrumb schema
const breadcrumbSchema = generateBreadcrumbSchema(post, baseUrl)

// FAQ schema (if FAQs exist)
const faqSchema = post.faqs?.length > 0
  ? generateFAQSchema(post.faqs.map(f => ({
      question: f.question,
      answer: f.answer,
    })))
  : null

// Render in page
return (
  <>
    <script type="application/ld+json">
      {JSON.stringify(articleSchema)}
    </script>
    <script type="application/ld+json">
      {JSON.stringify(breadcrumbSchema)}
    </script>
    {faqSchema && (
      <script type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </script>
    )}
    {/* Page content */}
  </>
)
```

### 6. Share Buttons

```tsx
import { ShareButtons } from '@/components/blog'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://todoapp.com'
const currentUrl = `${baseUrl}/blog/${post.slug}`

<ShareButtons url={currentUrl} title={post.title} />
```

### 7. Display Post Card

```tsx
import { PostCard } from '@/components/blog'

{posts.map((post) => (
  <PostCard key={post.id} post={post} />
))}
```

### 8. FAQ Section

```tsx
import { FAQSection } from '@/components/blog'

{post.faqs && post.faqs.length > 0 && (
  <FAQSection faqs={post.faqs} />
)}
```

## URL Patterns

```bash
# Blog listing
/blog                                    # All posts
/blog?page=2                            # Pagination
/blog?category=productivity             # Filter by category
/blog?search=task%20management          # Search posts
/blog?category=productivity&page=2      # Combined

# Individual post
/blog/post-slug                         # Single post
/blog/10-productivity-tips              # Example
```

## TypeScript Types

```tsx
import type {
  BlogPost,
  BlogCategory,
  BlogTag,
  BlogFAQ,
  BlogAuthor,
  BlogPostFilters,
  BlogPostListResponse,
} from '@/lib/blog/types'

// Blog post object
const post: BlogPost = {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  content: string
  featured_image_url?: string | null
  featured_image_alt?: string | null
  status: 'draft' | 'published' | 'archived'
  author_id: string
  category_id?: string | null
  published_at?: string | null
  views: number
  reading_time?: number | null
  meta_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
  canonical_url?: string | null
  created_at: string
  updated_at: string

  // Relations (from joins)
  category?: BlogCategory | null
  tags?: BlogTag[]
  author?: BlogAuthor | null
  faqs?: BlogFAQ[]
}

// Filters for listPosts()
const filters: BlogPostFilters = {
  status?: 'draft' | 'published' | 'archived'
  category_id?: string
  tag_id?: string
  author_id?: string
  search?: string
  page?: number
  limit?: number
  sortBy?: 'created_at' | 'published_at' | 'views' | 'title'
  sortOrder?: 'asc' | 'desc'
}
```

## Common Queries

```sql
-- Get all published posts with relations
SELECT
  p.*,
  c.name as category_name,
  a.name as author_name,
  array_agg(t.name) as tags
FROM blog_posts p
LEFT JOIN blog_categories c ON p.category_id = c.id
LEFT JOIN blog_authors a ON p.author_id = a.id
LEFT JOIN blog_post_tags pt ON p.id = pt.post_id
LEFT JOIN blog_tags t ON pt.tag_id = t.id
WHERE p.status = 'published'
GROUP BY p.id, c.name, a.name
ORDER BY p.published_at DESC;

-- Get post with FAQs
SELECT
  p.*,
  array_agg(
    json_build_object(
      'question', f.question,
      'answer', f.answer
    )
  ) as faqs
FROM blog_posts p
LEFT JOIN blog_faqs f ON p.id = f.post_id
WHERE p.slug = 'post-slug'
GROUP BY p.id;

-- Get related posts (same category)
SELECT *
FROM blog_posts
WHERE category_id = 'category-uuid'
  AND status = 'published'
  AND id != 'current-post-uuid'
ORDER BY published_at DESC
LIMIT 3;
```

## SEO Checklist

Before publishing a post, ensure:

- [ ] Title: 50-60 characters, keyword-rich
- [ ] Meta description: 150-160 characters
- [ ] Featured image: 1200x630px minimum
- [ ] Alt text for all images
- [ ] 3-5 H2 headings with keywords
- [ ] 1,500+ words for pillar content
- [ ] 3-5 internal links
- [ ] 2-3 external authoritative links
- [ ] Category assigned
- [ ] 3-5 tags added
- [ ] Author bio complete
- [ ] FAQs added (optional)
- [ ] Canonical URL set
- [ ] Published date set
- [ ] Reading time calculated
- [ ] Preview in admin
- [ ] Test on mobile
- [ ] Validate structured data

## Performance Targets

```
Lighthouse Scores:
├─ Performance: 90+
├─ Accessibility: 95+
├─ Best Practices: 95+
└─ SEO: 100

Core Web Vitals:
├─ LCP (Largest Contentful Paint): <2.5s
├─ FID (First Input Delay): <100ms
└─ CLS (Cumulative Layout Shift): <0.1

Page Load:
├─ First Contentful Paint: <1.8s
├─ Time to Interactive: <3.5s
└─ Total Blocking Time: <300ms
```

## Troubleshooting

### Images not loading
```bash
# 1. Check URL is publicly accessible
curl -I https://cdn.example.com/image.jpg

# 2. Verify Next.js image domains in next.config.js
images: {
  domains: ['cdn.todoapp.com', 'res.cloudinary.com'],
}
```

### TOC not generating
```tsx
// Ensure content has H2/H3 tags with text
const content = `
  <h2>Section One</h2>
  <p>Content...</p>
  <h3>Subsection</h3>
  <p>More content...</p>
`

// Add IDs first, then generate TOC
const withIds = addHeadingIds(content)
const toc = generateTableOfContents(withIds)
```

### Metadata not showing
```tsx
// Ensure generateMetadata is exported from page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  // Must return Metadata object
  return {
    title: '...',
    description: '...',
    openGraph: { ... },
  }
}

// Test with:
// - View page source
// - Facebook Sharing Debugger
// - Twitter Card Validator
```

### Post returns 404
```bash
# 1. Check slug exactly matches database
# 2. Verify status is 'published'
# 3. Check file path: src/app/blog/[slug]/page.tsx (not [id])
```

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_BASE_URL=https://todoapp.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

## Testing Commands

```bash
# Build for production
npm run build

# Run production server
npm run start

# Lighthouse audit
npx lighthouse https://localhost:3000/blog --view

# Check bundle size
npm run build && npx @next/bundle-analyzer

# Test accessibility
npx pa11y https://localhost:3000/blog
```

## Quick Deploy

```bash
# 1. Build and test locally
npm run build && npm run start

# 2. Run Lighthouse
npm run lighthouse

# 3. Validate structured data
# Visit: https://search.google.com/test/rich-results

# 4. Test social previews
# Facebook: https://developers.facebook.com/tools/debug/
# Twitter: https://cards-dev.twitter.com/validator

# 5. Deploy to Vercel
vercel --prod

# 6. Submit to Search Console
# https://search.google.com/search-console
```

## Useful Links

- [Next.js Metadata API](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Schema.org Article](https://schema.org/Article)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards](https://developer.twitter.com/en/docs/twitter-for-websites/cards)

---

**Last Updated:** November 18, 2025
**Version:** 1.0
