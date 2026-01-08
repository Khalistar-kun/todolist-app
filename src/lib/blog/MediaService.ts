import { createSupabaseServer } from '@/lib/supabase/server'
import { getSupabaseBrowser } from '@/lib/supabase/client'

export interface MediaFile {
  id: string
  filename: string
  original_filename: string
  file_path: string
  file_url: string
  mime_type: string
  file_size: number
  media_type: 'image' | 'video' | 'document' | 'audio' | 'other'
  width?: number
  height?: number
  alt_text?: string
  caption?: string
  title?: string
  description?: string
  usage_count: number
  bucket_name: string
  uploaded_by?: string
  created_at: string
  updated_at: string
}

export interface UploadOptions {
  bucket?: string
  altText?: string
  caption?: string
  title?: string
  description?: string
}

export class MediaService {
  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  /**
   * Determines media type from MIME type
   */
  private getMediaType(mimeType: string): MediaFile['media_type'] {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('powerpoint')
    ) {
      return 'document'
    }
    return 'other'
  }

  /**
   * Generates a unique filename to prevent collisions
   */
  private generateUniqueFilename(originalFilename: string): string {
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const ext = originalFilename.split('.').pop()
    const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '')
    const sanitized = nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50)

    return `${sanitized}-${timestamp}-${randomStr}.${ext}`
  }

  /**
   * Gets image dimensions if file is an image
   */
  private async getImageDimensions(
    file: File
  ): Promise<{ width: number; height: number } | null> {
    if (!file.type.startsWith('image/')) return null

    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.width, height: img.height })
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }

      img.src = url
    })
  }

  /**
   * Upload file to Supabase Storage
   */
  async uploadToStorage(
    file: File,
    bucketName: string = 'blog-media'
  ): Promise<{ path: string; url: string }> {
    const filename = this.generateUniqueFilename(file.name)
    const filePath = `${filename}`

    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Storage upload error:', error)
      throw new Error(`Failed to upload file: ${error.message}`)
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = this.supabase.storage.from(bucketName).getPublicUrl(filePath)

    return {
      path: data.path,
      url: publicUrl,
    }
  }

  /**
   * Create media record in database
   */
  async createMediaRecord(
    file: File,
    storagePath: string,
    storageUrl: string,
    options: UploadOptions = {}
  ): Promise<MediaFile> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser()

    const mediaType = this.getMediaType(file.type)
    let dimensions = null

    // Get dimensions for images (browser-side only)
    if (typeof window !== 'undefined' && mediaType === 'image') {
      dimensions = await this.getImageDimensions(file)
    }

    const mediaData = {
      filename: storagePath.split('/').pop(),
      original_filename: file.name,
      file_path: storagePath,
      file_url: storageUrl,
      mime_type: file.type,
      file_size: file.size,
      media_type: mediaType,
      width: dimensions?.width,
      height: dimensions?.height,
      alt_text: options.altText,
      caption: options.caption,
      title: options.title || file.name,
      description: options.description,
      bucket_name: options.bucket || 'blog-media',
      uploaded_by: user?.id,
    }

    const { data, error } = await this.supabase
      .from('blog_media')
      .insert(mediaData)
      .select()
      .single()

    if (error) {
      // Clean up uploaded file if database insert fails
      await this.supabase.storage
        .from(options.bucket || 'blog-media')
        .remove([storagePath])

      console.error('Database insert error:', error)
      throw new Error(`Failed to create media record: ${error.message}`)
    }

    return data
  }

  /**
   * Upload file and create database record (complete upload flow)
   */
  async uploadMedia(
    file: File,
    options: UploadOptions = {}
  ): Promise<MediaFile> {
    const bucketName = options.bucket || 'blog-media'

    // Upload to storage
    const { path, url } = await this.uploadToStorage(file, bucketName)

    // Create database record
    const media = await this.createMediaRecord(file, path, url, {
      ...options,
      bucket: bucketName,
    })

    return media
  }

  /**
   * List media with pagination and filtering
   */
  async listMedia(params: {
    page?: number
    limit?: number
    mediaType?: MediaFile['media_type']
    search?: string
  } = {}): Promise<{ media: MediaFile[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 20, mediaType, search } = params
    const offset = (page - 1) * limit

    let query = this.supabase
      .from('blog_media')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filter by media type
    if (mediaType && mediaType !== 'other') {
      query = query.eq('media_type', mediaType)
    }

    // Search by filename
    if (search) {
      query = query.ilike('original_filename', `%${search}%`)
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('List media error:', error)
      throw new Error(`Failed to list media: ${error.message}`)
    }

    return {
      media: data || [],
      total: count || 0,
      hasMore: count ? offset + limit < count : false,
    }
  }

  /**
   * Get single media by ID
   */
  async getMedia(id: string): Promise<MediaFile | null> {
    const { data, error } = await this.supabase
      .from('blog_media')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Get media error:', error)
      return null
    }

    return data
  }

  /**
   * Update media metadata
   */
  async updateMedia(
    id: string,
    updates: Partial<Pick<MediaFile, 'alt_text' | 'caption' | 'title' | 'description'>>
  ): Promise<MediaFile> {
    const { data, error } = await this.supabase
      .from('blog_media')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update media error:', error)
      throw new Error(`Failed to update media: ${error.message}`)
    }

    return data
  }

  /**
   * Delete media (both storage and database)
   */
  async deleteMedia(id: string): Promise<void> {
    // First get the media record
    const media = await this.getMedia(id)
    if (!media) {
      throw new Error('Media not found')
    }

    // Check if media is in use
    if (media.usage_count > 0) {
      throw new Error(
        `Cannot delete media that is in use by ${media.usage_count} post(s)`
      )
    }

    // Delete from storage
    const { error: storageError } = await this.supabase.storage
      .from(media.bucket_name)
      .remove([media.file_path])

    if (storageError) {
      console.error('Storage delete error:', storageError)
      // Continue to delete database record even if storage delete fails
    }

    // Delete from database
    const { error: dbError } = await this.supabase
      .from('blog_media')
      .delete()
      .eq('id', id)

    if (dbError) {
      console.error('Database delete error:', dbError)
      throw new Error(`Failed to delete media record: ${dbError.message}`)
    }
  }

  /**
   * Get media statistics
   */
  async getStats(): Promise<{
    total: number
    byType: Record<string, number>
    totalSize: number
  }> {
    const { data, error } = await this.supabase
      .from('blog_media')
      .select('media_type, file_size')

    if (error) {
      console.error('Get stats error:', error)
      return { total: 0, byType: {}, totalSize: 0 }
    }

    const byType: Record<string, number> = {}
    let totalSize = 0

    data.forEach((item: any) => {
      byType[item.media_type] = (byType[item.media_type] || 0) + 1
      totalSize += item.file_size || 0
    })

    return {
      total: data.length,
      byType,
      totalSize,
    }
  }
}

// Server-side instance
export async function getServerMediaService() {
  const supabase = await createSupabaseServer()
  return new MediaService(supabase)
}

// Client-side instance
export function getClientMediaService() {
  const supabase = getSupabaseBrowser()
  return new MediaService(supabase)
}
