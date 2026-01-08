# Blog Architecture Diagram

Visual representation of the TodoApp blog frontend architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TodoApp Blog Frontend                            │
│                        (Next.js 14 App Router)                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          Public Routes                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  /blog                                    /blog/[slug]                   │
│  ┌──────────────────────────┐            ┌───────────────────────────┐  │
│  │  Blog Listing Page       │            │  Individual Post Page     │  │
│  │  ────────────────────    │            │  ──────────────────────   │  │
│  │  • Search bar            │            │  • Hero section           │  │
│  │  • Category filters      │            │  • Featured image         │  │
│  │  • Post grid (3 cols)    │            │  • Table of contents      │  │
│  │  • Pagination            │            │  • Article content        │  │
│  │  • SEO metadata          │            │  • FAQ section            │  │
│  │                          │            │  • Share buttons          │  │
│  │  Server Component        │            │  • Author bio             │  │
│  └──────────────────────────┘            │  • Related posts          │  │
│                                           │                           │  │
│                                           │  Server Component         │  │
│                                           └───────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         Reusable Components                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PostCard                TableOfContents       ShareButtons             │
│  ┌──────────┐            ┌──────────────┐      ┌────────────┐          │
│  │ Image    │            │ • H2 Section │      │ Twitter    │          │
│  │ Title    │            │   - H3 Item  │      │ Facebook   │          │
│  │ Excerpt  │            │   - H3 Item  │      │ LinkedIn   │          │
│  │ Meta     │            │ • H2 Section │      │ Copy Link  │          │
│  │ Tags     │            │ • H2 Section │      └────────────┘          │
│  │ Author   │            │              │                               │
│  └──────────┘            │ Sticky (lg)  │      Client Component         │
│                          │ Collapse (sm)│                               │
│  Server Component        └──────────────┘      FAQSection              │
│                                                 ┌────────────┐          │
│                          Client Component       │ Question 1 │          │
│                                                 │ Question 2 │          │
│                                                 │ Question 3 │          │
│                                                 └────────────┘          │
│                                                                          │
│                                                 Client Component         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           Data Layer                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  BlogService (Server-Side)                                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  listPosts(filters)              getPostBySlug(slug)             │  │
│  │  ├─ status: 'published'          ├─ Fetch post with relations    │  │
│  │  ├─ category_id                  ├─ category                     │  │
│  │  ├─ search                        ├─ author                       │  │
│  │  ├─ page & limit                 ├─ tags                         │  │
│  │  └─ Returns: posts[], total      └─ faqs                         │  │
│  │                                                                   │  │
│  │  incrementViews(id)              getRelatedPosts(category_id)    │  │
│  │  └─ Track page views             └─ Fetch 3 similar posts        │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                   │                                      │
│                                   ▼                                      │
│                          ┌─────────────────┐                             │
│                          │  Supabase DB    │                             │
│                          │  ──────────────  │                             │
│                          │  blog_posts     │                             │
│                          │  blog_categories│                             │
│                          │  blog_tags      │                             │
│                          │  blog_post_tags │                             │
│                          │  blog_faqs      │                             │
│                          │  blog_authors   │                             │
│                          └─────────────────┘                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         SEO & Utilities                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  /lib/blog/seo.ts                                                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  Metadata Generation          Structured Data                    │  │
│  │  ├─ generateBlogPostMetadata   ├─ generateArticleSchema          │  │
│  │  ├─ generateBlogListingMetadata├─ generateBreadcrumbSchema       │  │
│  │  └─ OG tags, Twitter cards    └─ generateFAQSchema               │  │
│  │                                                                   │  │
│  │  Content Processing           Helper Functions                   │  │
│  │  ├─ addHeadingIds             ├─ formatDate                      │  │
│  │  ├─ generateTableOfContents   ├─ formatRelativeTime              │  │
│  │  ├─ calculateReadingTime      ├─ generateShareUrls               │  │
│  │  └─ sanitizeHTML              └─ slugify                         │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Blog Listing Page Flow

```
User Request: /blog?category=productivity&page=2
              │
              ▼
┌─────────────────────────────────────┐
│  Next.js App Router                 │
│  /src/app/blog/page.tsx             │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Parse Search Params                │
│  • category = productivity          │
│  • page = 2                         │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  BlogService.listPosts()            │
│  • Filter: category_id              │
│  • Filter: status = published       │
│  • Pagination: page 2, limit 12     │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Supabase Query                     │
│  SELECT * FROM blog_posts           │
│  JOIN blog_categories               │
│  JOIN blog_authors                  │
│  WHERE category_id = ...            │
│  AND status = 'published'           │
│  ORDER BY published_at DESC         │
│  LIMIT 12 OFFSET 12                 │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Return Data                        │
│  • posts: BlogPost[]                │
│  • total: 47                        │
│  • totalPages: 4                    │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Render Components                  │
│  • Map posts to PostCard            │
│  • Render pagination                │
│  • Generate metadata                │
└─────────────────────────────────────┘
              │
              ▼
         HTML Response
```

### Individual Blog Post Flow

```
User Request: /blog/10-productivity-tips
              │
              ▼
┌─────────────────────────────────────┐
│  Next.js App Router                 │
│  /src/app/blog/[slug]/page.tsx      │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  BlogService.getPostBySlug()        │
│  • slug = 10-productivity-tips      │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Supabase Query                     │
│  SELECT * FROM blog_posts           │
│  JOIN blog_categories               │
│  JOIN blog_authors                  │
│  JOIN blog_tags                     │
│  JOIN blog_faqs                     │
│  WHERE slug = ...                   │
│  AND status = 'published'           │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Post Processing                    │
│  • addHeadingIds(content)           │
│  • generateTableOfContents()        │
│  • Fetch related posts              │
│  • incrementViews()                 │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  SEO Generation                     │
│  • generateBlogPostMetadata()       │
│  • generateArticleSchema()          │
│  • generateBreadcrumbSchema()       │
│  • generateFAQSchema() (if FAQs)    │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Render Components                  │
│  • Hero section                     │
│  • TableOfContents                  │
│  • Article content (prose)          │
│  • FAQSection (if FAQs)             │
│  • ShareButtons                     │
│  • Author bio                       │
│  • Related PostCards                │
└─────────────────────────────────────┘
              │
              ▼
    HTML + JSON-LD Response
```

## SEO Metadata Flow

```
Blog Post Page
      │
      ▼
generateMetadata() (Next.js API)
      │
      ├─────────────────┐
      ▼                 ▼
generateBlogPost    Fetch Post Data
Metadata()          from Supabase
      │                 │
      │                 ▼
      │            BlogPost Object
      │                 │
      └────────┬────────┘
               ▼
      ┌─────────────────┐
      │  Metadata Object │
      │  ──────────────  │
      │  title           │
      │  description     │
      │  openGraph       │
      │  twitter         │
      │  alternates      │
      │  authors         │
      │  keywords        │
      └─────────────────┘
               │
               ▼
      Next.js renders in <head>
               │
               ▼
      ┌─────────────────────┐
      │ <title>...</title>  │
      │ <meta name="...">   │
      │ <meta property="og" │
      │ <meta name="twitter"│
      │ <link rel="canonical│
      └─────────────────────┘
```

## Component Hierarchy

```
/blog/[slug]/page.tsx
├── <header> (Breadcrumbs)
│   └── Home → Blog → Category → Post
│
├── <header> (Hero)
│   ├── Category Badge (Link)
│   ├── Title (H1)
│   ├── Excerpt
│   ├── Author Info
│   │   ├── Avatar (Image)
│   │   └── Name, Bio
│   ├── Meta (Date, Reading Time)
│   └── ShareButtons (Client)
│       ├── Twitter
│       ├── Facebook
│       ├── LinkedIn
│       └── Copy Link
│
├── Featured Image (Next Image)
│
├── <main> (2-column layout on desktop)
│   ├── <aside> (Sticky TOC)
│   │   └── TableOfContents (Client)
│   │       ├── H2 Section 1
│   │       │   ├── H3 Item
│   │       │   └── H3 Item
│   │       ├── H2 Section 2
│   │       └── H2 Section 3
│   │
│   └── <article>
│       ├── Content (Prose)
│       │   ├── Paragraphs
│       │   ├── Headings (with IDs)
│       │   ├── Images
│       │   ├── Code blocks
│       │   └── Lists
│       │
│       ├── Tags Section
│       │   └── Tag badges (Links)
│       │
│       ├── FAQSection (Client)
│       │   ├── FAQ 1 (Accordion)
│       │   ├── FAQ 2 (Accordion)
│       │   └── FAQ 3 (Accordion)
│       │
│       ├── Share Section
│       │   └── ShareButtons (Client)
│       │
│       └── Author Bio
│           ├── Avatar (Image)
│           ├── Name, Bio
│           └── Social Links
│
└── <section> (Related Posts)
    ├── PostCard 1
    ├── PostCard 2
    └── PostCard 3
```

## Responsive Breakpoints

```
Mobile (default - 0px+)
┌─────────────────────────┐
│ [TOC Collapsed]         │
│ ┌─────────────────────┐ │
│ │                     │ │
│ │   Article Content   │ │
│ │    (Full Width)     │ │
│ │                     │ │
│ └─────────────────────┘ │
└─────────────────────────┘

Tablet (md: 768px+)
┌─────────────────────────┐
│ ┌─────────┐ ┌─────────┐ │
│ │  Post   │ │  Post   │ │
│ │  Card   │ │  Card   │ │
│ └─────────┘ └─────────┘ │
└─────────────────────────┘

Desktop (lg: 1024px+)
┌─────────────────────────────────────┐
│ ┌─────┐ ┌───────────────────────┐   │
│ │ TOC │ │   Article Content     │   │
│ │     │ │                       │   │
│ │Stick│ │  • Hero               │   │
│ │ y   │ │  • Content            │   │
│ │     │ │  • FAQs               │   │
│ │     │ │  • Share              │   │
│ └─────┘ └───────────────────────┘   │
└─────────────────────────────────────┘

Blog Grid (3 columns)
┌───────────────────────────────────────┐
│ ┌─────┐ ┌─────┐ ┌─────┐              │
│ │Post │ │Post │ │Post │              │
│ │Card │ │Card │ │Card │              │
│ └─────┘ └─────┘ └─────┘              │
│ ┌─────┐ ┌─────┐ ┌─────┐              │
│ │Post │ │Post │ │Post │              │
│ │Card │ │Card │ │Card │              │
│ └─────┘ └─────┘ └─────┘              │
└───────────────────────────────────────┘
```

## Performance Strategy

```
┌─────────────────────────────────────────────┐
│         Optimization Layers                  │
├─────────────────────────────────────────────┤
│                                              │
│  1. Server Components (Default)              │
│     • Zero JavaScript to client              │
│     • Rendered on server                     │
│     • Fast initial page load                 │
│                                              │
│  2. Static Generation                        │
│     • Published posts are static             │
│     • ISR for content updates                │
│     • CDN cacheable                          │
│                                              │
│  3. Image Optimization                       │
│     • Next.js Image component                │
│     • Automatic WebP/AVIF                    │
│     • Responsive srcset                      │
│     • Lazy loading                           │
│                                              │
│  4. Code Splitting                           │
│     • Client components lazy loaded          │
│     • Route-based splitting                  │
│     • Dynamic imports                        │
│                                              │
│  5. Caching Headers                          │
│     • Immutable assets                       │
│     • Stale-while-revalidate                 │
│     • Cache-Control headers                  │
│                                              │
└─────────────────────────────────────────────┘

Target Metrics:
├─ Lighthouse Score: 90+
├─ LCP: <2.5s
├─ FID: <100ms
├─ CLS: <0.1
└─ TTI: <3.5s
```

## Security Considerations

```
┌─────────────────────────────────────────────┐
│         Security Layers                      │
├─────────────────────────────────────────────┤
│                                              │
│  1. Content Sanitization                     │
│     • DOMPurify for HTML                     │
│     • Strip script tags                      │
│     • Remove event handlers                  │
│                                              │
│  2. XSS Protection                           │
│     • React escapes by default               │
│     • dangerouslySetInnerHTML only trusted   │
│     • CSP headers configured                 │
│                                              │
│  3. SQL Injection Prevention                 │
│     • Supabase parameterized queries         │
│     • No raw SQL from user input             │
│     • RLS policies enabled                   │
│                                              │
│  4. HTTPS Only                               │
│     • SSL/TLS certificates                   │
│     • Strict-Transport-Security              │
│     • Secure cookies                         │
│                                              │
└─────────────────────────────────────────────┘
```

---

**Created:** November 18, 2025
**Version:** 1.0
**Purpose:** Visual documentation of blog architecture
