import { createBrowserClient } from '@supabase/ssr'

// Use placeholder values during build time to prevent @supabase/ssr validation errors
// These placeholders pass URL validation but won't be used at build time
// At runtime, the actual env vars will be available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key-for-build-time-only'

// Create browser client with cookie-based auth
// During build time, this creates a non-functional client with placeholder values
// At runtime, the actual env vars will be available and the client will work correctly
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Helper function to check if Supabase is properly configured (not using placeholders)
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
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
          color: string | null
          // Approval workflow fields
          approval_status: 'none' | 'pending' | 'approved' | 'rejected'
          approved_at: string | null
          approved_by: string | null
          rejection_reason: string | null
          moved_to_done_at: string | null
          moved_to_done_by: string | null
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
          color?: string | null
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
          color?: string | null
          // Approval workflow fields
          approval_status?: 'none' | 'pending' | 'approved' | 'rejected'
          approved_at?: string | null
          approved_by?: string | null
          rejection_reason?: string | null
          moved_to_done_at?: string | null
          moved_to_done_by?: string | null
        }
      }
      task_assignments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          role: 'owner' | 'assignee' | 'reviewer' | 'collaborator'
          assigned_by: string | null
          assigned_at: string
        }
        Insert: {
          task_id: string
          user_id: string
          role?: 'owner' | 'assignee' | 'reviewer' | 'collaborator'
          assigned_by?: string | null
        }
        Update: {
          user_id?: string
          role?: 'owner' | 'assignee' | 'reviewer' | 'collaborator'
          assigned_by?: string | null
        }
      }
      task_dependencies: {
        Row: {
          id: string
          blocking_task_id: string
          blocked_task_id: string
          dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'
          lag_days: number
          created_at: string
          created_by: string | null
        }
        Insert: {
          blocking_task_id: string
          blocked_task_id: string
          dependency_type?: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'
          lag_days?: number
          created_by?: string | null
        }
        Update: {
          dependency_type?: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'
          lag_days?: number
        }
      }
      milestones: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string | null
          target_date: string
          completed_at: string | null
          color: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          project_id: string
          name: string
          description?: string | null
          target_date: string
          color?: string
          created_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          target_date?: string
          completed_at?: string | null
          color?: string
        }
      }
      portfolios: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          color: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          name: string
          description?: string | null
          color?: string
          created_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          color?: string
        }
      }
      portfolio_projects: {
        Row: {
          portfolio_id: string
          project_id: string
          display_order: number
          added_at: string
        }
        Insert: {
          portfolio_id: string
          project_id: string
          display_order?: number
        }
        Update: {
          display_order?: number
        }
      }
      task_recurrences: {
        Row: {
          id: string
          task_id: string
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom'
          interval_value: number
          days_of_week: number[] | null
          day_of_month: number | null
          end_date: string | null
          max_occurrences: number | null
          occurrences_created: number
          next_occurrence_date: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          task_id: string
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom'
          interval_value?: number
          days_of_week?: number[] | null
          day_of_month?: number | null
          end_date?: string | null
          max_occurrences?: number | null
          next_occurrence_date?: string | null
          is_active?: boolean
        }
        Update: {
          frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom'
          interval_value?: number
          days_of_week?: number[] | null
          day_of_month?: number | null
          end_date?: string | null
          max_occurrences?: number | null
          occurrences_created?: number
          next_occurrence_date?: string | null
          is_active?: boolean
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
          duration: number | null
          description: string | null
          started_at: string | null
          ended_at: string | null
          is_running: boolean
          created_at: string
        }
        Insert: {
          task_id: string
          user_id: string
          duration?: number | null
          description?: string | null
          started_at?: string | null
          ended_at?: string | null
          is_running?: boolean
        }
        Update: {
          duration?: number | null
          description?: string | null
          started_at?: string | null
          ended_at?: string | null
          is_running?: boolean
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
export type TaskDependency = Database['public']['Tables']['task_dependencies']['Row']
export type Milestone = Database['public']['Tables']['milestones']['Row']
export type Portfolio = Database['public']['Tables']['portfolios']['Row']
export type PortfolioProject = Database['public']['Tables']['portfolio_projects']['Row']
export type TaskRecurrence = Database['public']['Tables']['task_recurrences']['Row']
export type Subtask = Database['public']['Tables']['subtasks']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type Attachment = Database['public']['Tables']['attachments']['Row']
export type TimeEntry = Database['public']['Tables']['time_entries']['Row']
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

// Task assignment role type
export type TaskAssignmentRole = 'owner' | 'assignee' | 'reviewer' | 'collaborator'

// Extended task assignment with user details
export type TaskAssignmentWithUser = TaskAssignment & {
  user: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'>
}

// Extended types with relationships
export type TaskWithDetails = Task & {
  project: Pick<Project, 'id' | 'name' | 'color'>
  assignees: Array<{
    id: string
    full_name: string | null
    avatar_url: string | null
    role?: TaskAssignmentRole
  }>
  subtasks: Subtask[]
  comments_count: number
  attachments_count: number
  time_spent: number
  // New fields
  start_date?: string | null
  estimated_hours?: number | null
  parent_task_id?: string | null
  milestone_id?: string | null
  is_blocked?: boolean
  blocking_tasks?: Array<{ id: string; title: string; stage_id: string }>
  blocked_tasks?: Array<{ id: string; title: string; stage_id: string }>
  running_timer?: TimeEntry | null
}

export type ProjectWithDetails = Project & {
  members_count: number
  tasks_count: number
  completed_tasks_count: number
  pending_approval_count?: number
  overdue_tasks_count?: number
  blocked_tasks_count?: number
}

// Portfolio with projects
export type PortfolioWithProjects = Portfolio & {
  projects: Array<ProjectWithDetails & { display_order: number }>
}

// Milestone with linked tasks
export type MilestoneWithTasks = Milestone & {
  tasks_count: number
  completed_tasks_count: number
  progress_percent: number
}

// Workflow stage with WIP limit
export type WorkflowStage = {
  id: string
  name: string
  color: string
  wip_limit?: number | null
  wip_limit_type?: 'warning' | 'strict'
  is_done_stage?: boolean
  is_default?: boolean
}

export type User = Profile & {
  role?: string
}