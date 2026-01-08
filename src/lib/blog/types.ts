// SEO and Content Types
export interface TOCItem {
  id: string
  text: string
  level: number
}

export interface NestedTOCItem extends TOCItem {
  children?: NestedTOCItem[]
}

export interface FAQSchemaItem {
  question: string
  answer: string
}

// Blog Post Types
export type BlogPostStatus = 'draft' | 'published' | 'archived'

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  content: string
  featured_image_url?: string | null
  featured_image_alt?: string | null
  status: BlogPostStatus
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

  // Relations (populated by joins)
  category?: BlogCategory | null
  tags?: BlogTag[]
  author?: BlogAuthor | null
  faqs?: BlogFAQ[]
}

// Blog Category Types
export interface BlogCategory {
  id: string
  name: string
  slug: string
  description?: string | null
  parent_id?: string | null
  display_order: number
  meta_title?: string | null
  meta_description?: string | null
  created_at: string
  updated_at: string

  // Relations
  parent?: BlogCategory | null
  children?: BlogCategory[]
}

// Blog Tag Types
export interface BlogTag {
  id: string
  name: string
  slug: string
  description?: string | null
  created_at: string
  updated_at: string
}

// Blog Post Tag Junction
export interface BlogPostTag {
  post_id: string
  tag_id: string
  created_at: string
}

// Blog FAQ Types
export interface BlogFAQ {
  id: string
  post_id: string
  question: string
  answer: string
  display_order: number
  created_at: string
  updated_at: string
}

// Blog Author Types
export interface BlogAuthor {
  id: string
  user_id: string
  name: string
  bio?: string | null
  avatar_url?: string | null
  twitter?: string | null
  linkedin?: string | null
  website?: string | null
  created_at: string
  updated_at: string
}

// API Response Types
export interface BlogPostListResponse {
  posts: BlogPost[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface BlogPostFilters {
  status?: BlogPostStatus
  category_id?: string
  tag_id?: string
  author_id?: string
  search?: string
  page?: number
  limit?: number
  sortBy?: 'created_at' | 'published_at' | 'views' | 'title'
  sortOrder?: 'asc' | 'desc'
}

// Create/Update Types
export interface CreateBlogPost {
  title: string
  slug: string
  excerpt?: string
  content: string
  featured_image_url?: string
  featured_image_alt?: string
  status?: BlogPostStatus
  category_id?: string
  published_at?: string
  meta_title?: string
  meta_description?: string
  og_image_url?: string
  canonical_url?: string
  tag_ids?: string[]
  faqs?: Omit<BlogFAQ, 'id' | 'post_id' | 'created_at' | 'updated_at'>[]
}

export interface UpdateBlogPost extends Partial<CreateBlogPost> {
  id: string
}

// Admin Stats Types
export interface BlogStats {
  totalPosts: number
  publishedPosts: number
  draftPosts: number
  totalViews: number
  recentPosts: BlogPost[]
}
