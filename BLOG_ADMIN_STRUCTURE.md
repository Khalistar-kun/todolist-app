# Blog Admin Panel - Complete Structure

## Overview
Complete blog admin infrastructure for TodoApp built with Next.js 14, Supabase, and TipTap-ready architecture.

## File Structure

```
/Users/adityaaman/Desktop/test_Todolist/todolist/
├── src/
│   ├── lib/
│   │   ├── blog/
│   │   │   ├── types.ts                    ✅ Blog TypeScript interfaces
│   │   │   └── BlogService.ts              ✅ Complete CRUD service layer
│   │   └── supabase/
│   │       ├── client.ts                   ✅ Browser client (existing)
│   │       └── server.ts                   ✅ Server client (NEW)
│   │
│   └── app/
│       ├── admin/
│       │   ├── layout.tsx                  ✅ Admin sidebar + auth
│       │   ├── page.tsx                    ✅ Dashboard with stats
│       │   └── posts/
│       │       ├── page.tsx                ✅ Posts list with filters
│       │       └── new/
│       │           └── page.tsx            ✅ Editor placeholder
│       │
│       └── api/
│           └── blog/
│               └── posts/
│                   ├── route.ts            ✅ GET list, POST create
│                   └── [id]/
│                       └── route.ts        ✅ GET, PATCH, DELETE
```

## Features Implemented

### 1. Type System (`/src/lib/blog/types.ts`)
- `BlogPost` - Complete post interface with relations
- `BlogCategory` - Hierarchical categories
- `BlogTag` - Tagging system
- `BlogFAQ` - Post-specific FAQs
- `BlogAuthor` - Author profiles
- `BlogPostFilters` - Advanced filtering
- `CreateBlogPost` / `UpdateBlogPost` - CRUD types
- `BlogStats` - Dashboard statistics

### 2. Service Layer (`/src/lib/blog/BlogService.ts`)
Complete CRUD operations:
- `listPosts()` - Paginated list with filters (status, category, tags, search)
- `getPostById()` - Fetch single post with relations
- `getPostBySlug()` - Public-facing slug lookup
- `createPost()` - Create with tags & FAQs
- `updatePost()` - Update with conflict checking
- `deletePost()` - Cascade delete
- `publishPost()` / `unpublishPost()` - Status management
- `incrementViews()` - View tracking
- `getStats()` - Dashboard analytics

### 3. Admin Layout (`/src/app/admin/layout.tsx`)
Professional WordPress-style admin panel:
- **Authentication Check** - Redirects to /app if not logged in
- **Sidebar Navigation** with icons:
  - Dashboard (LayoutDashboard)
  - Posts (FileText)
  - Categories (FolderOpen)
  - Tags (Tags)
  - Media (Image)
  - Settings (Settings)
- **User Section** - Avatar, email, sign out
- **TodoApp Branding** - Orange (#FF9F66) theme
- **Fixed Layout** - Sidebar + scrollable content

### 4. Admin Dashboard (`/src/app/admin/page.tsx`)
Key metrics and quick actions:
- **Stats Cards** (4-column grid):
  - Total Posts
  - Published Count (green)
  - Draft Count (blue)
  - Total Views (purple)
- **Quick Actions** - New Post, View All, Manage Categories/Tags
- **Recent Posts** - Last 5 posts with status badges
- **Empty State** - Encourages first post creation

### 5. Posts List (`/src/app/admin/posts/page.tsx`)
Full-featured post management:
- **Filters** - All / Published / Draft / Archived
- **Search** - Title and excerpt search
- **Table View** - Title, Status, Category, Views, Published Date
- **Actions** - Edit, Delete buttons per post
- **Pagination** - Previous/Next with page count
- **Featured Images** - Thumbnail preview in list
- **Empty State** - Context-aware (search vs. no posts)

### 6. New Post Placeholder (`/src/app/admin/posts/new/page.tsx`)
Development signpost:
- Explains editor coming in next phase
- Lists TipTap features planned
- Clean, professional placeholder design
- Links back to dashboard and posts

### 7. API Routes

#### `POST /api/blog/posts`
- Authentication required
- Auto-creates author if needed
- Validates title & content
- Handles tags and FAQs
- Returns created post with relations

#### `GET /api/blog/posts`
Query params:
- `status` - Filter by status
- `category_id` - Filter by category
- `tag_id` - Filter by tag
- `author_id` - Filter by author
- `search` - Search title/excerpt
- `page` / `limit` - Pagination
- `sortBy` / `sortOrder` - Sorting

#### `GET /api/blog/posts/[id]`
- Fetch single post
- Includes all relations (category, author, tags, FAQs)

#### `PATCH /api/blog/posts/[id]`
- Authentication required
- Validates post exists
- Auto-sets published_at when publishing
- Updates tags and FAQs
- Slug conflict checking

#### `DELETE /api/blog/posts/[id]`
- Authentication required
- Validates post exists
- Cascade deletes relations

## Database Schema Expected

The service layer expects these Supabase tables:

```sql
-- Already created in your schema
blog_posts (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  excerpt text,
  content text NOT NULL,
  featured_image_url text,
  featured_image_alt text,
  status text CHECK (status IN ('draft', 'published', 'archived')),
  author_id uuid REFERENCES blog_authors(id),
  category_id uuid REFERENCES blog_categories(id),
  published_at timestamptz,
  views integer DEFAULT 0,
  reading_time integer,
  meta_title text,
  meta_description text,
  og_image_url text,
  canonical_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

blog_categories (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  parent_id uuid REFERENCES blog_categories(id),
  display_order integer DEFAULT 0,
  meta_title text,
  meta_description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

blog_tags (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

blog_post_tags (
  post_id uuid REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES blog_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, tag_id)
)

blog_faqs (
  id uuid PRIMARY KEY,
  post_id uuid REFERENCES blog_posts(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

blog_authors (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  bio text,
  avatar_url text,
  twitter text,
  linkedin text,
  website text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

## Design System

### Colors
- **Primary**: `#FF9F66` (TodoApp Orange)
- **Primary Hover**: `#ff8c4d`
- **Success**: Green-600
- **Info**: Blue-600
- **Warning**: Purple-600

### Status Badges
- **Published**: Green (bg-green-100, text-green-800)
- **Draft**: Blue (bg-blue-100, text-blue-800)
- **Archived**: Gray (bg-gray-100, text-gray-800)

### Typography
- **Headings**: Font-bold, text-gray-900
- **Body**: Text-gray-600/700
- **Links**: Text-[#FF9F66] hover:text-[#ff8c4d]

## Next Steps

### Phase 2: Rich Text Editor (ui-developer agent)
1. **TipTap Editor Component** (`/src/components/blog/RichTextEditor.tsx`)
   - StarterKit extensions
   - Image upload with Supabase Storage
   - Code blocks with Prism syntax highlighting
   - Tables, text alignment, highlights
   - Link editing with preview
   
2. **Post Editor Page** (replace `/src/app/admin/posts/new/page.tsx`)
   - Full form with TipTap
   - Featured image uploader
   - Category/tag selection
   - SEO metadata fields
   - Auto-save drafts
   - Live preview toggle
   - Publish/Save Draft buttons

3. **Edit Post Page** (`/src/app/admin/posts/[id]/page.tsx`)
   - Pre-populate form
   - Same editor as new post
   - Update vs Create logic

4. **Category & Tag Management**
   - `/src/app/admin/categories/page.tsx`
   - `/src/app/admin/tags/page.tsx`
   - CRUD interfaces

5. **Media Library**
   - `/src/app/admin/media/page.tsx`
   - Supabase Storage integration
   - Image browser & uploader

### Phase 3: Public Blog Frontend
1. **Blog Homepage** (`/src/app/blog/page.tsx`)
2. **Blog Post Page** (`/src/app/blog/[slug]/page.tsx`)
3. **Category Pages** (`/src/app/blog/category/[slug]/page.tsx`)
4. **Tag Pages** (`/src/app/blog/tag/[slug]/page.tsx`)

## Access URLs

- **Admin Panel**: `http://localhost:3000/admin`
- **Dashboard**: `http://localhost:3000/admin` (default)
- **Posts List**: `http://localhost:3000/admin/posts`
- **New Post**: `http://localhost:3000/admin/posts/new`
- **API Endpoint**: `http://localhost:3000/api/blog/posts`

## Testing Commands

```bash
# Start dev server
npm run dev

# Test API endpoints
curl http://localhost:3000/api/blog/posts
curl http://localhost:3000/api/blog/posts?status=published&limit=5
```

## Notes

- All routes require authentication (checked at layout level)
- User must be signed in via Supabase Auth
- Author profile auto-created on first post
- Slugs are auto-generated from titles using `slugify` package
- All timestamps use ISO 8601 format
- Mobile-first responsive design throughout
- Professional WordPress-inspired UX

---

**Status**: ✅ Phase 1 Complete - Ready for TipTap Editor Integration
**Built by**: Claude Code (architecture agent)
**Next Agent**: ui-developer (editor implementation)
