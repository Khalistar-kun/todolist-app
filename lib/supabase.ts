import { createBrowserClient } from '@supabase/ssr'

// Use fallback empty strings during build time to prevent build failures
// The client will only be used at runtime when env vars are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create browser client with cookie-based auth
// During build time, this creates a non-functional client that won't be used
// At runtime, the actual env vars will be available
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Helper function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

// Helper types for our database
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          username: string | null
          bio: string | null
          timezone: string
          language: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          username?: string | null
          bio?: string | null
          timezone?: string
          language?: string
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          username?: string | null
          bio?: string | null
          timezone?: string
          language?: string
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          avatar_url: string | null
          settings: Record<string, any>
          subscription_tier: string
          max_members: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          slug: string
          description?: string | null
          avatar_url?: string | null
          settings?: Record<string, any>
          subscription_tier?: string
          max_members?: number
          created_by?: string | null
        }
        Update: {
          name?: string
          slug?: string
          description?: string | null
          avatar_url?: string | null
          settings?: Record<string, any>
          subscription_tier?: string
          max_members?: number
        }
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'editor' | 'reader'
          invited_by: string | null
          joined_at: string
        }
        Insert: {
          organization_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'editor' | 'reader'
          invited_by?: string | null
        }
        Update: {
          role?: 'owner' | 'admin' | 'editor' | 'reader'
        }
      }
      projects: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          color: string
          status: string
          visibility: string
          workflow_stages: Array<{
            id: string
            name: string
            color: string
          }>
          settings: Record<string, any>
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          name: string
          description?: string | null
          color?: string
          status?: string
          visibility?: string
          workflow_stages?: Array<{
            id: string
            name: string
            color: string
          }>
          settings?: Record<string, any>
          created_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          color?: string
          status?: string
          visibility?: string
          workflow_stages?: Array<{
            id: string
            name: string
            color: string
          }>
          settings?: Record<string, any>
        }
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: 'owner' | 'admin' | 'editor' | 'reader'
          assigned_by: string | null
          joined_at: string
        }
        Insert: {
          project_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'editor' | 'reader'
          assigned_by?: string | null
        }
        Update: {
          role?: 'owner' | 'admin' | 'editor' | 'reader'
        }
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'review' | 'done' | 'archived'
          priority: 'none' | 'low' | 'medium' | 'high' | 'urgent'
          position: number
          stage_id: string
          due_date: string | null
          completed_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          tags: string[]
          custom_fields: Record<string, any>
        }
        Insert: {
          project_id: string
          title: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'review' | 'done' | 'archived'
          priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent'
          position?: number
          stage_id?: string
          due_date?: string | null
          created_by?: string | null
          tags?: string[]
          custom_fields?: Record<string, any>
        }
        Update: {
          title?: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'review' | 'done' | 'archived'
          priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent'
          position?: number
          stage_id?: string
          due_date?: string | null
          completed_at?: string | null
          updated_by?: string | null
          tags?: string[]
          custom_fields?: Record<string, any>
        }
      }
      task_assignments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          assigned_by: string | null
          assigned_at: string
        }
        Insert: {
          task_id: string
          user_id: string
          assigned_by?: string | null
        }
        Update: {
          user_id?: string
          assigned_by?: string | null
        }
      }
      subtasks: {
        Row: {
          id: string
          task_id: string
          title: string
          completed: boolean
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          task_id: string
          title: string
          completed?: boolean
          position?: number
        }
        Update: {
          title?: string
          completed?: boolean
          position?: number
        }
      }
      comments: {
        Row: {
          id: string
          task_id: string
          project_id: string
          content: string
          mentions: string[]
          attachments: Array<Record<string, any>>
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          task_id: string
          project_id: string
          content: string
          mentions?: string[]
          attachments?: Array<Record<string, any>>
          created_by?: string | null
        }
        Update: {
          content?: string
          mentions?: string[]
          attachments?: Array<Record<string, any>>
          updated_by?: string | null
        }
      }
      attachments: {
        Row: {
          id: string
          task_id: string
          comment_id: string | null
          file_name: string
          file_size: number
          file_type: string
          file_path: string
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          task_id: string
          comment_id?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_path: string
          uploaded_by?: string | null
        }
      }
      time_entries: {
        Row: {
          id: string
          task_id: string
          user_id: string
          duration: number
          description: string | null
          started_at: string | null
          ended_at: string | null
          created_at: string
        }
        Insert: {
          task_id: string
          user_id: string
          duration: number
          description?: string | null
          started_at?: string | null
          ended_at?: string | null
        }
        Update: {
          duration?: number
          description?: string | null
          started_at?: string | null
          ended_at?: string | null
        }
      }
      activity_logs: {
        Row: {
          id: string
          project_id: string | null
          task_id: string | null
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string
          old_values: Record<string, any> | null
          new_values: Record<string, any> | null
          created_at: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'task_assigned' | 'task_updated' | 'comment_added' | 'project_invite' | 'deadline_reminder'
          title: string
          message: string
          data: Record<string, any>
          read: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          type: 'task_assigned' | 'task_updated' | 'comment_added' | 'project_invite' | 'deadline_reminder'
          title: string
          message: string
          data?: Record<string, any>
          read?: boolean
        }
        Update: {
          type?: 'task_assigned' | 'task_updated' | 'comment_added' | 'project_invite' | 'deadline_reminder'
          title?: string
          message?: string
          data?: Record<string, any>
          read?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      task_priority: 'none' | 'low' | 'medium' | 'high' | 'urgent'
      task_status: 'todo' | 'in_progress' | 'review' | 'done' | 'archived'
      project_role: 'owner' | 'admin' | 'editor' | 'reader'
      notification_type: 'task_assigned' | 'task_updated' | 'comment_added' | 'project_invite' | 'deadline_reminder'
      webhook_event: 'task_created' | 'task_updated' | 'task_deleted' | 'comment_added' | 'project_created'
    }
  }
}

// Type helpers
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Organization = Database['public']['Tables']['organizations']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskAssignment = Database['public']['Tables']['task_assignments']['Row']
export type Subtask = Database['public']['Tables']['subtasks']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type Attachment = Database['public']['Tables']['attachments']['Row']
export type TimeEntry = Database['public']['Tables']['time_entries']['Row']
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

// Extended types with relationships
export type TaskWithDetails = Task & {
  project: Pick<Project, 'id' | 'name' | 'color'>
  assignees: Array<{ id: string; full_name: string | null; avatar_url: string | null }>
  subtasks: Subtask[]
  comments_count: number
  attachments_count: number
  time_spent: number
}

export type ProjectWithDetails = Project & {
  members_count: number
  tasks_count: number
  completed_tasks_count: number
}

export type User = Profile & {
  role?: string
}