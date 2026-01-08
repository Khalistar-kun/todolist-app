# Blog CMS Component Architecture Map

## Visual Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BLOG CMS SYSTEM                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                   │
        ┌───────▼────────┐                  ┌──────▼──────┐
        │  ADMIN PANEL   │                  │   PUBLIC    │
        │   (/admin/)    │                  │   (/blog/)  │
        └───────┬────────┘                  └──────┬──────┘
                │                                   │
        ┌───────┴────────┐                  ┌──────┴──────┐
        │                │                  │             │
    ┌───▼───┐      ┌────▼─────┐      ┌────▼────┐  ┌─────▼─────┐
    │Layout │      │Management│      │Listing  │  │Individual │
    │       │      │  Pages   │      │Page     │  │Post Page  │
    └───┬───┘      └────┬─────┘      └────┬────┘  └─────┬─────┘
        │               │                  │             │
        │               │                  │             │
┌───────▼───────────────▼──────────────────▼─────────────▼───────────┐
│                    SHARED COMPONENTS                                │
│  PostCard | TipTapEditor | ShareButtons | TOC | FAQSection         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                        ┌─────────▼─────────┐
                        │  BACKEND SERVICES │
                        │  BlogService      │
                        │  MediaService     │
                        │  Supabase Client  │
                        └─────────┬─────────┘
                                  │
                        ┌─────────▼─────────┐
                        │     DATABASE      │
                        │   PostgreSQL      │
                        │  (Supabase)       │
                        └───────────────────┘
```

---

## Admin Panel Structure

```
/admin/
│
├── layout.tsx (Sidebar + Authentication)
│   ├── Logo
│   ├── Navigation Links
│   │   ├── Dashboard
│   │   ├── Posts
│   │   ├── Categories
│   │   ├── Tags
│   │   ├── Media
│   │   └── Settings
│   ├── User Profile
│   └── Sign Out Button
│
├── page.tsx (Dashboard)
│   ├── Stats Cards
│   │   ├── Total Posts
│   │   ├── Published
│   │   ├── Drafts
│   │   └── Total Views
│   ├── Quick Actions
│   └── Recent Posts List
│
├── posts/
│   ├── page.tsx (Posts List)
│   │   ├── Filter Buttons (All/Published/Draft/Archived)
│   │   ├── Search Box
│   │   ├── Posts Table
│   │   └── Pagination
│   │
│   ├── new/page.tsx (New Post Editor)
│   │   ├── Left Column (2/3 width)
│   │   │   ├── Title Input
│   │   │   ├── Slug Input
│   │   │   ├── TipTapEditor
│   │   │   ├── SEO Section
│   │   │   │   ├── Meta Title
│   │   │   │   ├── Meta Description
│   │   │   │   └── OG Image URL
│   │   │   └── FAQ Section
│   │   │       ├── Add FAQ Button
│   │   │       └── FAQ Items (Q&A pairs)
│   │   │
│   │   └── Right Column (1/3 width)
│   │       ├── Publish Panel
│   │       │   ├── Status Dropdown
│   │       │   └── Save/Publish Button
│   │       ├── Featured Image
│   │       │   ├── Upload Area
│   │       │   ├── Preview
│   │       │   └── Alt Text
│   │       ├── Excerpt
│   │       ├── Category Dropdown
│   │       └── Tags Input
│   │
│   └── [id]/page.tsx (Edit Post)
│       └── (Same as New Post + Delete Button)
│
├── categories/page.tsx
│   ├── Add Category Button
│   ├── Categories Tree Table
│   │   ├── Name (with hierarchy indentation)
│   │   ├── Slug
│   │   ├── Post Count
│   │   └── Actions (Edit/Delete)
│   ├── Modal Form
│   │   ├── Name
│   │   ├── Slug (auto-generated)
│   │   ├── Description
│   │   ├── Parent Category
│   │   ├── Sort Order
│   │   ├── Meta Title
│   │   ├── Meta Description
│   │   └── Active Toggle
│   └── Stats Cards
│
├── tags/page.tsx
│   ├── View Mode Toggle (Grid/List)
│   ├── Add Tag Button
│   ├── Tag Cloud View (Grid Mode)
│   │   └── Tag Badges (sized by usage)
│   ├── List View
│   │   ├── Name
│   │   ├── Slug
│   │   ├── Post Count
│   │   ├── Color
│   │   └── Actions
│   ├── Modal Form
│   │   ├── Name
│   │   ├── Slug (auto-generated)
│   │   ├── Description
│   │   └── Color Picker
│   └── Stats Cards
│
└── media/page.tsx
    ├── Upload Button
    ├── Type Filter (All/Image/Video/Document)
    ├── Search Box
    ├── Media Grid (4 columns)
    │   ├── Image Preview
    │   ├── File Info
    │   ├── Usage Badge
    │   └── Actions (View/Delete)
    ├── Details Modal
    │   ├── Full Preview
    │   ├── Metadata
    │   ├── Copy URL Button
    │   ├── Download Button
    │   └── Delete Button
    └── Stats Cards
```

---

## Public Blog Structure

```
/blog/
│
├── page.tsx (Blog Listing)
│   ├── Header
│   │   ├── Title: "TodoApp Blog"
│   │   └── Description
│   │
│   ├── Sidebar (Desktop)
│   │   ├── Search Input
│   │   └── Category Links
│   │       ├── All Posts
│   │       ├── Productivity
│   │       ├── Tips & Tricks
│   │       ├── Workflows
│   │       └── Features
│   │
│   ├── Main Content Area
│   │   ├── Mobile Search (Mobile only)
│   │   ├── Posts Grid (3 columns)
│   │   │   └── PostCard components
│   │   └── Pagination
│   │       ├── Previous Button
│   │       ├── Page Numbers
│   │       └── Next Button
│   │
│   └── Loading State
│       └── Skeleton Cards (6 items)
│
└── [slug]/page.tsx (Individual Post)
    ├── Breadcrumbs
    │   └── Home > Blog > Category > Post
    │
    ├── Back to Blog Link
    │
    ├── Header Section
    │   ├── Category Badge
    │   ├── Title (H1)
    │   ├── Excerpt
    │   ├── Meta Info
    │   │   ├── Author (with avatar)
    │   │   ├── Published Date
    │   │   └── Reading Time
    │   └── Share Buttons
    │
    ├── Featured Image (21:9 aspect)
    │
    ├── Main Content
    │   ├── Sidebar (Desktop)
    │   │   └── Table of Contents (sticky)
    │   │
    │   └── Article Content
    │       ├── Post Content (prose styled)
    │       ├── Tags Section
    │       ├── FAQ Section (if exists)
    │       ├── Share Buttons (bottom)
    │       └── Author Bio Card
    │
    └── Related Posts Section
        └── 3 Post Cards
```

---

## Shared Component Breakdown

### PostCard Component
```
PostCard
├── Link Wrapper (to /blog/[slug])
├── Featured Image Area
│   ├── Image (with hover scale)
│   └── Category Badge (overlay)
├── Content Area
│   ├── Meta Info (date, reading time)
│   ├── Title (line-clamp-2)
│   ├── Excerpt (line-clamp-3)
│   ├── Tags (max 3)
│   └── Author Info
│       ├── Avatar
│       └── Name
└── Hover Effects
```

### TipTapEditor Component
```
TipTapEditor
├── EditorToolbar
│   ├── Formatting Buttons
│   │   ├── Bold, Italic, Underline, Strike
│   │   ├── Headings (H1-H6)
│   │   ├── Lists (Bullet, Numbered)
│   │   └── Alignment
│   ├── Insert Buttons
│   │   ├── Link
│   │   ├── Image (ImageUploadButton)
│   │   ├── Table
│   │   ├── Blockquote
│   │   ├── Code Block
│   │   └── Horizontal Rule
│   └── Utility Buttons
│       ├── Undo
│       ├── Redo
│       └── Clear Formatting
│
└── EditorContent
    ├── TipTap Extensions
    │   ├── StarterKit
    │   ├── Image
    │   ├── Link
    │   ├── Table (with rows, cells, headers)
    │   ├── TextAlign
    │   ├── Placeholder
    │   ├── Highlight
    │   └── Callout (custom)
    │
    └── Prose Styling
        ├── Headings
        ├── Paragraphs
        ├── Lists
        ├── Code Blocks
        ├── Blockquotes
        ├── Tables
        └── Images
```

### ShareButtons Component
```
ShareButtons
├── Twitter Share
├── Facebook Share
├── LinkedIn Share
└── Copy Link
    └── Confirmation (on copy)
```

### TableOfContents Component
```
TableOfContents (sticky)
├── "On this page" heading
├── TOC Items (from H2, H3)
│   ├── Link to section
│   ├── Active highlight
│   └── Nested structure
└── Smooth Scroll Behavior
```

### FAQSection Component
```
FAQSection
├── "Frequently Asked Questions" heading
├── FAQ Items (accordion)
│   ├── Question (button to expand)
│   ├── Answer (collapsible)
│   └── Expand/Collapse Icon
└── JSON-LD Schema (for SEO)
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER ACTIONS                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND COMPONENTS                       │
│  (Admin Pages | Public Pages | Shared Components)           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API ROUTES (RSC)                        │
│  /api/blog/posts | categories | tags | media                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                             │
│  BlogService.ts | MediaService.ts                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE CLIENT                            │
│  (Server-side | Client-side)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               POSTGRESQL DATABASE                            │
│  Tables: posts | categories | tags | media | faqs           │
│  Functions: slugify | calculate_reading_time | etc.         │
│  Triggers: auto_generate_slug | set_published_at            │
│  RLS: Security policies for public/private access           │
└─────────────────────────────────────────────────────────────┘
```

---

## State Management Flow

### Admin Pages (Client Components)
```
User Input
    │
    ▼
React State (useState)
    │
    ▼
Form Submission
    │
    ▼
API Route (fetch)
    │
    ▼
BlogService Method
    │
    ▼
Supabase Query
    │
    ▼
Database Update
    │
    ▼
Response
    │
    ▼
State Update
    │
    ▼
UI Re-render
```

### Public Pages (Server Components)
```
Page Request
    │
    ▼
Server Component
    │
    ▼
BlogService Method (direct)
    │
    ▼
Supabase Query
    │
    ▼
Database Fetch
    │
    ▼
Data Return
    │
    ▼
Component Render (SSR)
    │
    ▼
HTML Sent to Browser
```

---

## File Upload Flow

```
User Selects File
    │
    ▼
File Validation (client-side)
    │
    ▼
FormData Creation
    │
    ▼
POST /api/blog/media
    │
    ▼
File Upload to Supabase Storage
    │
    ▼
Get Public URL
    │
    ▼
Insert Record to blog_media Table
    │
    ▼
Return Media Object
    │
    ▼
Update Component State
    │
    ▼
Display Image Preview
```

---

## SEO & Schema Flow

```
Post Page Load
    │
    ▼
Fetch Post Data (Server Component)
    │
    ▼
Generate Metadata (generateMetadata)
    │   ├── Title
    │   ├── Description
    │   ├── OG Tags
    │   └── Twitter Card
    │
    ▼
Generate JSON-LD Schema
    │   ├── Article Schema
    │   ├── Breadcrumb Schema
    │   └── FAQ Schema (if exists)
    │
    ▼
Inject into <head>
    │
    ▼
Render Page Content
    │
    ▼
Search Engines Crawl
```

---

## Component Reusability Map

```
┌─────────────────────────────────────────────────────────┐
│              HIGHLY REUSABLE COMPONENTS                  │
├─────────────────────────────────────────────────────────┤
│ PostCard         → Used in: Blog Listing, Related Posts │
│ ShareButtons     → Used in: Post Page (top & bottom)    │
│ TipTapEditor     → Used in: New Post, Edit Post         │
│ TableOfContents  → Used in: Individual Post Page        │
│ FAQSection       → Used in: Individual Post Page        │
│ EditorToolbar    → Used in: TipTapEditor                │
│ ImageUploadBtn   → Used in: EditorToolbar               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│            PAGE-SPECIFIC COMPONENTS                      │
├─────────────────────────────────────────────────────────┤
│ Admin Layout     → Sidebar for all admin pages          │
│ Categories Page  → CRUD modal for categories            │
│ Tags Page        → Tag cloud + list views               │
│ Media Page       → Grid view + details modal            │
│ Posts List       → Table with filters & pagination      │
│ Post Editor      → Full editor layout (new & edit)      │
│ Blog Listing     → Posts grid with sidebar              │
│ Post Page        → Full article layout                  │
└─────────────────────────────────────────────────────────┘
```

---

## Responsive Breakpoint Strategy

```
┌────────────────────────────────────────────────────────┐
│                    MOBILE (<640px)                     │
├────────────────────────────────────────────────────────┤
│ • Single column layouts                                │
│ • Hamburger menu (if applicable)                       │
│ • Stacked sidebar content                              │
│ • Smaller font sizes                                   │
│ • Touch-friendly button sizes (min 44x44px)            │
│ • Reduced padding/margins                              │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                   TABLET (640-1024px)                  │
├────────────────────────────────────────────────────────┤
│ • 2-column grids for posts                             │
│ • Sidebar appears inline                               │
│ • Medium font sizes                                    │
│ • Comfortable spacing                                  │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                   DESKTOP (>1024px)                    │
├────────────────────────────────────────────────────────┤
│ • 3-column grids for posts                             │
│ • Fixed sidebar with sticky TOC                        │
│ • Large font sizes                                     │
│ • Generous spacing                                     │
│ • Hover effects enabled                                │
└────────────────────────────────────────────────────────┘
```

---

## Authentication & Authorization Flow

```
┌─────────────────────────────────────────────────────────┐
│                   ADMIN ACCESS                          │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
            Admin Layout (Server Component)
                        │
                        ▼
            Check Supabase Auth Session
                        │
            ┌───────────┴───────────┐
            │                       │
         User?                   No User?
            │                       │
            ▼                       ▼
      Allow Access            Redirect to /app
            │
            ▼
    Show Admin Dashboard
```

---

## Performance Optimization Points

```
┌─────────────────────────────────────────────────────────┐
│                SERVER OPTIMIZATIONS                      │
├─────────────────────────────────────────────────────────┤
│ ✓ Server-side rendering (SSR) for SEO                  │
│ ✓ Database indexes on common queries                   │
│ ✓ Selective field fetching (not SELECT *)              │
│ ✓ Denormalized data (post counts, author names)        │
│ ✓ RLS for security without extra code                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                CLIENT OPTIMIZATIONS                      │
├─────────────────────────────────────────────────────────┤
│ ✓ Next.js Image component (lazy load, optimize)        │
│ ✓ Code splitting (per page)                            │
│ ✓ Pagination (limit data fetched)                      │
│ ✓ Debounced search                                     │
│ ✓ Skeleton loading states                              │
│ ✓ Suspense boundaries                                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                FUTURE OPTIMIZATIONS                      │
├─────────────────────────────────────────────────────────┤
│ □ Redis caching for hot content                        │
│ □ CDN for static assets                                │
│ □ Incremental Static Regeneration (ISR)                │
│ □ Service Worker for offline support                   │
│ □ WebP image conversion                                │
│ □ Image resizing pipeline                              │
└─────────────────────────────────────────────────────────┘
```

---

## Error Handling Strategy

```
┌─────────────────────────────────────────────────────────┐
│                   ERROR BOUNDARIES                       │
└─────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
    ▼                               ▼
API Routes                    Components
    │                               │
    ▼                               ▼
Try-Catch Blocks         React Error Boundaries
    │                               │
    ▼                               ▼
Return Error Response      Show Error UI
    │                               │
    ▼                               ▼
Display to User            Log to Console
```

### Error Display Patterns:
- **Form Errors:** Red border + error message below field
- **API Errors:** Alert/toast notification
- **Not Found:** Custom 404 page
- **Server Errors:** Generic error message (don't expose details)
- **Loading Errors:** Skeleton → Error state

---

This component map provides a visual guide to understanding how all pieces fit together in the Blog CMS system.
