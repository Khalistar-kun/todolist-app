# TodoApp Blog Frontend

This directory contains the public-facing blog frontend for TodoApp. The blog is built with Next.js 14 App Router, featuring comprehensive SEO optimization, mobile-first responsive design, and a clean, minimal aesthetic inspired by Todoist.

## Directory Structure

```
/src/app/blog/
├── page.tsx                    # Blog listing page with filters & pagination
└── [slug]/
    └── page.tsx                # Individual blog post page

/src/components/blog/
├── PostCard.tsx                # Reusable blog post card component
├── TableOfContents.tsx         # Auto-generated sticky TOC with active section tracking
├── ShareButtons.tsx            # Social sharing buttons (Twitter, Facebook, LinkedIn, Copy)
├── FAQSection.tsx              # Accordion FAQ section with schema markup
└── index.ts                    # Component exports

/src/lib/blog/
├── types.ts                    # TypeScript interfaces for blog entities
├── BlogService.ts              # Server-side blog data access layer
└── seo.ts                      # SEO utilities and schema generation
```

## Features

### Blog Listing Page (`/blog`)

**Features:**
- 3-column grid on desktop, 1-column on mobile
- Pagination (12 posts per page)
- Category filter sidebar (sticky on desktop)
- Search functionality
- Loading skeletons for better UX
- SEO metadata with Open Graph tags

**URL Parameters:**
- `?page=2` - Pagination
- `?category=productivity` - Filter by category
- `?search=task%20management` - Search posts

**Example:**
```
/blog
/blog?page=2
/blog?category=productivity
/blog?search=productivity&page=1
```

### Individual Blog Post (`/blog/[slug]`)

**Features:**
- Hero section with featured image, title, author, date
- Sticky table of contents (auto-generated from H2/H3 headings)
  - Desktop: Sticky sidebar
  - Mobile: Collapsible accordion
- Full HTML content rendering (sanitized)
- FAQ accordion section with structured data
- Social share buttons (Twitter, Facebook, LinkedIn, Copy Link)
- Related posts section (3 posts from same category)
- Author bio section with social links
- Breadcrumb navigation
- View count tracking

**SEO Features:**
- Dynamic metadata (title, description, OG tags)
- JSON-LD structured data:
  - Article schema
  - BreadcrumbList schema
  - FAQPage schema (if FAQs exist)
- Canonical URLs
- Twitter Card support
- Automatic reading time calculation

**Example:**
```
/blog/10-productivity-tips-for-remote-teams
```

## Components

### PostCard

Displays a blog post preview card with featured image, title, excerpt, metadata, and tags.

```tsx
import { PostCard } from '@/components/blog'

<PostCard post={post} />
```

**Props:**
- `post: BlogPost` - Blog post object

### TableOfContents

Auto-generated table of contents with smooth scrolling and active section highlighting.

```tsx
import { TableOfContents } from '@/components/blog'

const tocItems = generateTableOfContents(htmlContent)

<TableOfContents items={tocItems} />
```

**Props:**
- `items: TOCItem[]` - Array of TOC items
- `className?: string` - Optional CSS classes

**Features:**
- Auto-extracts H2 and H3 headings
- Smooth scroll to sections
- Highlights active section using Intersection Observer
- Sticky on desktop (top: 96px)
- Collapsible accordion on mobile

### ShareButtons

Social sharing buttons with native Web Share API support on mobile.

```tsx
import { ShareButtons } from '@/components/blog'

<ShareButtons
  url="https://todoapp.com/blog/post-slug"
  title="Post Title"
/>
```

**Props:**
- `url: string` - Full URL to share
- `title: string` - Post title
- `className?: string` - Optional CSS classes

**Platforms:**
- Twitter
- Facebook
- LinkedIn
- Copy Link (with success feedback)
- Native Share (mobile only, via Web Share API)

### FAQSection

Accordion-style FAQ section with JSON-LD structured data.

```tsx
import { FAQSection } from '@/components/blog'

<FAQSection faqs={post.faqs} />
```

**Props:**
- `faqs: BlogFAQ[]` - Array of FAQ objects
- `className?: string` - Optional CSS classes

**Features:**
- Accordion with open/close animation
- Auto-generates FAQPage schema markup
- Mobile-optimized touch targets
- Prose styling for HTML answers

## SEO Utilities

### Metadata Generation

```tsx
import { generateBlogPostMetadata, generateBlogListingMetadata } from '@/lib/blog/seo'

// Blog post metadata
const metadata = generateBlogPostMetadata(post, baseUrl)

// Blog listing metadata
const metadata = generateBlogListingMetadata(category, baseUrl)
```

### Structured Data

```tsx
import {
  generateArticleSchema,
  generateBreadcrumbSchema,
  generateFAQSchema
} from '@/lib/blog/seo'

const articleSchema = generateArticleSchema(post, baseUrl)
const breadcrumbSchema = generateBreadcrumbSchema(post, baseUrl)
const faqSchema = generateFAQSchema(faqs)
```

### Table of Contents

```tsx
import { generateTableOfContents, addHeadingIds } from '@/lib/blog/seo'

// Add IDs to H2 and H3 tags
const contentWithIds = addHeadingIds(htmlContent)

// Extract TOC structure
const tocItems = generateTableOfContents(contentWithIds)
```

### Helper Functions

```tsx
import {
  formatDate,
  formatRelativeTime,
  calculateReadingTime,
  generateShareUrls
} from '@/lib/blog/seo'

// Format: "November 18, 2025"
const date = formatDate(dateString)

// Format: "2 days ago"
const relativeTime = formatRelativeTime(dateString)

// Calculate reading time in minutes
const readingTime = calculateReadingTime(htmlContent)

// Generate social share URLs
const urls = generateShareUrls(url, title)
```

## Design System

### Colors

- **Primary Brand:** `#FF9F66` (Orange accent)
- **Background:** `#f6faeb` (Cream)
- **Text:** Gray scale (900, 700, 600, 500)

### Typography

- **Font:** Inter (system fallback)
- **Headings:** Bold, tight line-height
- **Body:** Regular, relaxed line-height (1.75)
- **Code:** Monospace, brand-colored background

### Spacing

- **Card padding:** 1.25rem (mobile), 2.5rem (desktop)
- **Section gaps:** 2rem (mobile), 3rem (desktop)
- **Border radius:** 12px (card)

### Shadows

- **soft:** Minimal elevation
- **soft-md:** Medium elevation
- **soft-lg:** Large elevation

## Mobile-First Responsive Design

All components are built mobile-first with Tailwind CSS breakpoints:

- **Mobile:** Single column, collapsible elements
- **Tablet (md:768px):** 2-column grid
- **Desktop (lg:1024px):** 3-column grid, sticky sidebar

### Mobile Optimizations

1. **Table of Contents:** Collapsible accordion instead of sidebar
2. **Search:** Full-width input with dedicated button
3. **Pagination:** Simplified with prev/next only
4. **Images:** Responsive with proper aspect ratios
5. **Touch Targets:** Minimum 44px for better accessibility

## Performance

### Image Optimization

- Next.js Image component with automatic optimization
- Responsive images with `srcset` and `sizes`
- Lazy loading for below-fold images
- Priority loading for hero images

### Code Splitting

- Dynamic imports for client components
- Suspense boundaries for async data
- Loading skeletons for better perceived performance

### Caching

- Static generation for published posts
- Incremental Static Regeneration (ISR) ready
- Server-side data fetching with Supabase

## Accessibility

- Semantic HTML5 structure (`<article>`, `<nav>`, `<aside>`)
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus visible states
- Alt text for all images
- Heading hierarchy (H1 → H2 → H3)

## Content Requirements

### Blog Post

- **Title:** 60 characters max (SEO)
- **Excerpt:** 160 characters max (meta description)
- **Content:** HTML with H2/H3 headings for TOC
- **Featured Image:** 1200x630px (OG image ratio)
- **Reading Time:** Auto-calculated from word count

### Images

- **Featured Image:** 16:9 aspect ratio (recommended)
- **OG Image:** 1200x630px (required for social)
- **Alt Text:** Descriptive text for all images

### Metadata

- **Meta Title:** 50-60 characters
- **Meta Description:** 150-160 characters
- **Canonical URL:** Full URL to avoid duplicates
- **OG Image:** Fallback to featured image

## Usage Examples

### Create a Blog Post

```sql
-- Insert into Supabase via Admin CMS
INSERT INTO blog_posts (
  title,
  slug,
  excerpt,
  content,
  featured_image_url,
  featured_image_alt,
  status,
  author_id,
  category_id,
  meta_title,
  meta_description,
  published_at
) VALUES (
  '10 Productivity Tips for Remote Teams',
  '10-productivity-tips-remote-teams',
  'Boost your remote team productivity with these proven strategies...',
  '<h2>Start with Clear Goals</h2><p>...</p>',
  'https://cdn.todoapp.com/blog/remote-tips.jpg',
  'Remote team collaborating on video call',
  'published',
  'author-uuid',
  'category-uuid',
  '10 Productivity Tips for Remote Teams | TodoApp Blog',
  'Boost your remote team productivity with these proven strategies and tools. Learn from experts.',
  NOW()
);
```

### Add FAQs to Post

```sql
INSERT INTO blog_faqs (post_id, question, answer, display_order)
VALUES
  ('post-uuid', 'How do I get started?', '<p>First, create an account...</p>', 1),
  ('post-uuid', 'What are the pricing plans?', '<p>We offer three tiers...</p>', 2);
```

### Fetch Published Posts

```tsx
import { BlogService } from '@/lib/blog/BlogService'

const { posts, totalPages, total } = await BlogService.listPosts({
  status: 'published',
  category_id: 'category-uuid',
  search: 'productivity',
  page: 1,
  limit: 12,
  sortBy: 'published_at',
  sortOrder: 'desc',
})
```

## Environment Variables

```env
NEXT_PUBLIC_BASE_URL=https://todoapp.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Future Enhancements

- [ ] RSS feed generation
- [ ] JSON feed support
- [ ] Blog post search with Algolia/Meilisearch
- [ ] Comment system integration
- [ ] Email newsletter signup
- [ ] Reading progress indicator
- [ ] Dark mode support
- [ ] Print stylesheet
- [ ] AMP support
- [ ] Related posts with ML recommendations

## Troubleshooting

### Images not loading

1. Check featured_image_url is publicly accessible
2. Verify Next.js `images.domains` in next.config.js
3. Check CORS headers on image CDN

### TOC not generating

1. Ensure HTML content has H2/H3 tags
2. Verify headings have text content
3. Check `addHeadingIds()` is called before rendering

### SEO metadata missing

1. Verify metadata fields are populated in database
2. Check `generateMetadata()` is exported from page
3. Validate with Google Rich Results Test

### 404 on blog posts

1. Check slug matches database exactly
2. Verify post status is 'published'
3. Check dynamic route file naming: `[slug]/page.tsx`

## Support

For questions or issues:
- Technical documentation: `/docs/blog`
- Admin CMS guide: `/admin/help`
- SEO checklist: `SEO_DEPLOYMENT_CHECKLIST.md`
