import { createSupabaseServer } from '@/lib/supabase/server'
import type {
  BlogPost,
  BlogPostFilters,
  BlogPostListResponse,
  CreateBlogPost,
  UpdateBlogPost,
  BlogStats,
} from './types'
import slugify from 'slugify'

export class BlogService {
  /**
   * List all blog posts with optional filters
   */
  static async listPosts(
    filters: BlogPostFilters = {}
  ): Promise<BlogPostListResponse> {
    const supabase = await createSupabaseServer()

    const {
      status,
      category_id,
      tag_id,
      author_id,
      search,
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = filters

    let query = supabase
      .from('blog_posts')
      .select(
        `
        *,
        category:blog_categories(*),
        author:blog_authors(*),
        tags:blog_post_tags(
          tag:blog_tags(*)
        )
      `,
        { count: 'exact' }
      )

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (category_id) {
      query = query.eq('category_id', category_id)
    }

    if (author_id) {
      query = query.eq('author_id', author_id)
    }

    if (tag_id) {
      query = query.contains('tag_ids', [tag_id])
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`)
    }

    // Sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching posts:', error)
      throw new Error('Failed to fetch blog posts')
    }

    // Transform tags structure
    const posts = (data || []).map((post: any) => ({
      ...post,
      tags: post.tags?.map((pt: any) => pt.tag).filter(Boolean) || [],
    }))

    return {
      posts: posts as BlogPost[],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    }
  }

  /**
   * Get a single post by ID
   */
  static async getPostById(id: string): Promise<BlogPost | null> {
    const supabase = await createSupabaseServer()

    const { data, error } = await supabase
      .from('blog_posts')
      .select(
        `
        *,
        category:blog_categories(*),
        author:blog_authors(*),
        tags:blog_post_tags(
          tag:blog_tags(*)
        ),
        faqs:blog_faqs(*)
      `
      )
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching post:', error)
      return null
    }

    // Transform tags structure
    return {
      ...data,
      tags: data.tags?.map((pt: any) => pt.tag).filter(Boolean) || [],
    } as BlogPost
  }

  /**
   * Get a single post by slug
   */
  static async getPostBySlug(slug: string): Promise<BlogPost | null> {
    const supabase = await createSupabaseServer()

    const { data, error } = await supabase
      .from('blog_posts')
      .select(
        `
        *,
        category:blog_categories(*),
        author:blog_authors(*),
        tags:blog_post_tags(
          tag:blog_tags(*)
        ),
        faqs:blog_faqs(*)
      `
      )
      .eq('slug', slug)
      .single()

    if (error) {
      console.error('Error fetching post by slug:', error)
      return null
    }

    // Transform tags structure
    return {
      ...data,
      tags: data.tags?.map((pt: any) => pt.tag).filter(Boolean) || [],
    } as BlogPost
  }

  /**
   * Create a new blog post
   */
  static async createPost(
    postData: CreateBlogPost,
    authorId: string
  ): Promise<BlogPost> {
    const supabase = await createSupabaseServer()

    // Generate slug if not provided
    const slug = postData.slug || slugify(postData.title, { lower: true, strict: true })

    // Check if slug already exists
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      throw new Error('A post with this slug already exists')
    }

    const { tag_ids, faqs, ...postFields } = postData

    // Create the post
    const { data: post, error: postError } = await supabase
      .from('blog_posts')
      .insert({
        ...postFields,
        slug,
        author_id: authorId,
        status: postData.status || 'draft',
        views: 0,
      })
      .select()
      .single()

    if (postError) {
      console.error('Error creating post:', postError)
      throw new Error('Failed to create blog post')
    }

    // Add tags if provided
    if (tag_ids && tag_ids.length > 0) {
      const tagInserts = tag_ids.map((tag_id) => ({
        post_id: post.id,
        tag_id,
      }))

      const { error: tagError } = await supabase
        .from('blog_post_tags')
        .insert(tagInserts)

      if (tagError) {
        console.error('Error adding tags:', tagError)
      }
    }

    // Add FAQs if provided
    if (faqs && faqs.length > 0) {
      const faqInserts = faqs.map((faq) => ({
        post_id: post.id,
        ...faq,
      }))

      const { error: faqError } = await supabase
        .from('blog_faqs')
        .insert(faqInserts)

      if (faqError) {
        console.error('Error adding FAQs:', faqError)
      }
    }

    // Fetch the complete post with relations
    const createdPost = await this.getPostById(post.id)
    if (!createdPost) {
      throw new Error('Failed to fetch created post')
    }

    return createdPost
  }

  /**
   * Update an existing blog post
   */
  static async updatePost(
    id: string,
    updates: UpdateBlogPost
  ): Promise<BlogPost> {
    const supabase = await createSupabaseServer()

    const { tag_ids, faqs, ...postFields } = updates

    // If slug is being updated, check for conflicts
    if (updates.slug) {
      const { data: existing } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('slug', updates.slug)
        .neq('id', id)
        .single()

      if (existing) {
        throw new Error('A post with this slug already exists')
      }
    }

    // Update the post
    const { error: postError } = await supabase
      .from('blog_posts')
      .update({
        ...postFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (postError) {
      console.error('Error updating post:', postError)
      throw new Error('Failed to update blog post')
    }

    // Update tags if provided
    if (tag_ids !== undefined) {
      // Delete existing tags
      await supabase.from('blog_post_tags').delete().eq('post_id', id)

      // Add new tags
      if (tag_ids.length > 0) {
        const tagInserts = tag_ids.map((tag_id) => ({
          post_id: id,
          tag_id,
        }))

        const { error: tagError } = await supabase
          .from('blog_post_tags')
          .insert(tagInserts)

        if (tagError) {
          console.error('Error updating tags:', tagError)
        }
      }
    }

    // Update FAQs if provided
    if (faqs !== undefined) {
      // Delete existing FAQs
      await supabase.from('blog_faqs').delete().eq('post_id', id)

      // Add new FAQs
      if (faqs.length > 0) {
        const faqInserts = faqs.map((faq) => ({
          post_id: id,
          ...faq,
        }))

        const { error: faqError } = await supabase
          .from('blog_faqs')
          .insert(faqInserts)

        if (faqError) {
          console.error('Error updating FAQs:', faqError)
        }
      }
    }

    // Fetch the updated post with relations
    const updatedPost = await this.getPostById(id)
    if (!updatedPost) {
      throw new Error('Failed to fetch updated post')
    }

    return updatedPost
  }

  /**
   * Delete a blog post
   */
  static async deletePost(id: string): Promise<void> {
    const supabase = await createSupabaseServer()

    // Delete related records first (if not using CASCADE)
    await supabase.from('blog_post_tags').delete().eq('post_id', id)
    await supabase.from('blog_faqs').delete().eq('post_id', id)

    // Delete the post
    const { error } = await supabase.from('blog_posts').delete().eq('id', id)

    if (error) {
      console.error('Error deleting post:', error)
      throw new Error('Failed to delete blog post')
    }
  }

  /**
   * Increment post views
   */
  static async incrementViews(id: string): Promise<void> {
    const supabase = await createSupabaseServer()

    const { error } = await supabase.rpc('increment_post_views', {
      post_id: id,
    })

    if (error) {
      console.error('Error incrementing views:', error)
    }
  }

  /**
   * Get blog statistics for admin dashboard
   */
  static async getStats(): Promise<BlogStats> {
    const supabase = await createSupabaseServer()

    // Get total posts
    const { count: totalPosts } = await supabase
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })

    // Get published posts
    const { count: publishedPosts } = await supabase
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')

    // Get draft posts
    const { count: draftPosts } = await supabase
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft')

    // Get total views
    const { data: viewsData } = await supabase
      .from('blog_posts')
      .select('views')

    const totalViews = viewsData?.reduce((sum, post) => sum + post.views, 0) || 0

    // Get recent posts
    const { data: recentPosts } = await supabase
      .from('blog_posts')
      .select(
        `
        *,
        category:blog_categories(*),
        author:blog_authors(*)
      `
      )
      .order('created_at', { ascending: false })
      .limit(5)

    return {
      totalPosts: totalPosts || 0,
      publishedPosts: publishedPosts || 0,
      draftPosts: draftPosts || 0,
      totalViews,
      recentPosts: (recentPosts || []) as BlogPost[],
    }
  }

  /**
   * Publish a draft post
   */
  static async publishPost(id: string): Promise<BlogPost> {
    return this.updatePost(id, {
      id,
      status: 'published',
      published_at: new Date().toISOString(),
    })
  }

  /**
   * Unpublish a post (revert to draft)
   */
  static async unpublishPost(id: string): Promise<BlogPost> {
    return this.updatePost(id, {
      id,
      status: 'draft',
    })
  }
}
