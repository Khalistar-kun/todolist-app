import type { User as SupabaseUser } from '@supabase/supabase-js'

// Enhanced user profile type
export interface UserProfile {
  id: string
  email: string
  full_name?: string | null
  avatar_url?: string | null
  bio?: string | null
  timezone?: string
  language?: string
  last_seen_at?: string | null
  is_online?: boolean
  phone?: string | null
  title?: string | null
  department?: string | null
  created_at?: string
}

// Workspace/Project types
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Project {
  id: string
  name: string
  description?: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: ProjectRole
  invited_by?: string | null
  joined_at: string
  user?: UserProfile // Joined user profile
}

// Client types
export interface Client {
  id: string
  project_id: string | null
  name: string
  description?: string | null
  color?: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// Enhanced task types
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  project_id: string | null
  client_id: string | null
  workflow_id?: string | null
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  due_at?: string | null
  assignees: string[]
  assigned_to: string[] // Legacy field
  tags: string[]
  estimated_hours?: number | null
  actual_hours?: number | null
  parent_task_id?: string | null
  position: number
  custom_fields: Record<string, any>
  created_by: string
  completed_at?: string | null
  slack_thread_ts?: string | null
  slack_message_ts?: string | null
  created_at: string
  updated_at: string

  // Joined fields for convenience
  assignee_profiles?: UserProfile[]
  project?: Project
  client?: Client
  parent_task?: Task
  subtasks?: Task[]
  comments?: Comment[]
  attachments?: Attachment[]
  time_entries?: TimeEntry[]
}

// Workflow types
export type StepTrigger = 'on_completion' | 'on_status_change' | 'manual'

export interface Workflow {
  id: string
  project_id: string
  name: string
  description?: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface WorkflowStep {
  id: string
  workflow_id: string
  step_order: number
  from_status: TaskStatus
  to_status: TaskStatus
  trigger_type: StepTrigger
  auto_assign_to?: string | null
  created_at: string
}

// Comments and collaboration
export interface Comment {
  id: string
  task_id: string
  content: string
  mentioned_users: string[]
  created_by: string
  created_at: string
  updated_at: string
  deleted_at?: string | null

  // Joined fields
  author_profile?: UserProfile
  mentioned_profiles?: UserProfile[]
}

export interface Attachment {
  id: string
  task_id?: string
  project_id?: string
  comment_id?: string
  filename: string
  file_path: string
  file_size: number
  mime_type: string
  uploaded_by: string
  created_at: string

  // Joined fields
  uploader_profile?: UserProfile
}

// Notifications
export interface Notification {
  id: string
  user_id: string
  project_id?: string
  task_id?: string
  comment_id?: string
  type: string
  title: string
  message?: string | null
  read_at?: string | null
  created_at: string
  metadata: Record<string, any>

  // Joined fields
  task?: Task
  comment?: Comment
  project?: Project
}

export type NotificationType =
  | 'task_assigned'
  | 'task_updated'
  | 'task_completed'
  | 'comment_added'
  | 'mention'
  | 'due_reminder'
  | 'project_invitation'
  | 'task_overdue'

// Activity logs
export interface ActivityLog {
  id: string
  project_id?: string
  task_id?: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  details: Record<string, any>
  old_values: Record<string, any>
  new_values: Record<string, any>
  created_at: string

  // Joined fields
  user_profile?: UserProfile
  task?: Task
  project?: Project
}

// User preferences
export interface UserPreferences {
  id: string
  user_id: string
  project_id?: string
  notifications_enabled: boolean
  email_notifications: boolean
  theme: 'light' | 'dark' | 'system'
  language: string
  timezone: string
  working_hours_start: string
  working_hours_end: string
  working_days: number[] // Monday=1, Sunday=7
  created_at: string
  updated_at: string
}

// Templates
export interface ProjectTemplate {
  id: string
  name: string
  description?: string | null
  is_public: boolean
  created_by: string
  template_data: any
  created_at: string
  updated_at: string
}

export interface TaskTemplate {
  id: string
  project_id?: string
  name: string
  description?: string | null
  checklist: any[]
  default_priority: TaskPriority
  default_tags: string[]
  estimated_hours?: number | null
  created_by: string
  created_at: string
  updated_at: string
}

// Recurring tasks
export interface RecurringTask {
  id: string
  project_id: string
  template_task_id?: string
  title: string
  description?: string | null
  recurrence_rule: string // Cron expression
  next_due_at: string
  last_completed_at?: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

// Time tracking
export interface TimeEntry {
  id: string
  task_id: string
  user_id: string
  description?: string | null
  hours: number
  date: string
  created_at: string
  updated_at: string

  // Joined fields
  user_profile?: UserProfile
  task?: Task
}

// Webhooks
export interface Webhook {
  id: string
  project_id: string
  name: string
  url: string
  events: string[]
  secret_key?: string | null
  is_active: boolean
  last_triggered_at?: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// Slack integration types
export interface SlackIntegration {
  id: string
  project_id: string
  webhook_url: string
  channel_name?: string | null
  notify_on_task_create: boolean
  notify_on_task_assign: boolean
  notify_on_task_complete: boolean
  created_by: string
  created_at: string
}

// Auth context types
export interface User {
  id: string
  email: string
  token?: string
  profile?: UserProfile
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string) => Promise<void>
  signOut: () => void
  signUp: (email: string, password: string, metadata?: any) => Promise<void>
  signInWithProvider: (provider: 'google' | 'github') => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  isAuthenticated: boolean
}

// API response types
export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T = any> {
  data: T[]
  count: number
  page: number
  limit: number
  hasMore: boolean
}

// Form types
export interface TaskFormData {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  due_at?: string
  assignees: string[]
  tags: string[]
  estimated_hours?: number
  parent_task_id?: string
  custom_fields?: Record<string, any>
}

export interface ProjectFormData {
  name: string
  description?: string
}

export interface CommentFormData {
  content: string
  mentioned_users: string[]
}

// Filter and search types
export interface TaskFilters {
  status?: TaskStatus[]
  priority?: TaskPriority[]
  assignees?: string[]
  tags?: string[]
  due_date?: {
    from?: string
    to?: string
  }
  search?: string
  project_id?: string
  client_id?: string
}

export interface TaskSort {
  field: 'title' | 'status' | 'priority' | 'due_at' | 'created_at' | 'updated_at' | 'position'
  direction: 'asc' | 'desc'
}

// UI state types
export type ViewMode = 'list' | 'board' | 'calendar' | 'timeline'

export interface ViewState {
  mode: ViewMode
  filters: TaskFilters
  sort: TaskSort
  selectedTaskId?: string
  isEditingTask: boolean
  creatingTask: boolean
}

// Modal types
export interface ModalState {
  taskDetail: { isOpen: boolean; taskId?: string }
  taskEdit: { isOpen: boolean; task?: Task }
  projectSettings: { isOpen: boolean; projectId?: string }
  memberInvite: { isOpen: boolean; projectId?: string }
  fileUpload: { isOpen: boolean; taskId?: string }
}

// Notification settings
export interface NotificationSettings {
  task_assigned: boolean
  task_updated: boolean
  task_completed: boolean
  comment_added: boolean
  mentioned: boolean
  due_reminder: boolean
  project_invitation: boolean
  task_overdue: boolean
}

// Dashboard analytics
export interface DashboardStats {
  totalTasks: number
  completedTasks: number
  overdueTasks: number
  tasksByStatus: Record<TaskStatus, number>
  tasksByPriority: Record<TaskPriority, number>
  recentActivity: ActivityLog[]
  upcomingDeadlines: Task[]
  teamProductivity: Array<{
    user_id: string
    user_name: string
    tasks_completed: number
    hours_logged: number
  }>
}

// Chart data types
export interface ChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string
    borderColor?: string
  }>
}

// Search result types
export interface SearchResult {
  type: 'task' | 'project' | 'comment' | 'user'
  id: string
  title: string
  description?: string
  relevance_score: number
  metadata: Record<string, any>
}

// Bulk operations
export interface BulkOperation {
  type: 'update_status' | 'assign' | 'delete' | 'add_tags' | 'remove_tags'
  taskIds: string[]
  data: any
}

// Import/Export types
export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx'
  includeAttachments: boolean
  dateRange: {
    from?: string
    to?: string
  }
  projects: string[]
}

export interface ImportResult {
  success: number
  failed: number
  errors: string[]
  importedItems: any[]
}

// Real-time subscription events
export type RealtimeEvent =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'comment_added'
  | 'comment_updated'
  | 'comment_deleted'
  | 'project_updated'
  | 'member_added'
  | 'member_removed'
  | 'user_online'
  | 'user_offline'

export interface RealtimePayload<T = any> {
  event: RealtimeEvent
  data: T
  projectId?: string
  taskId?: string
  userId?: string
}

// Integration types
export interface Integration {
  id: string
  type: 'slack' | 'github' | 'jira' | 'email' | 'webhook'
  name: string
  config: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string
}

// Error types
export interface AppError {
  code: string
  message: string
  details?: any
  timestamp: string
}

// Loading states
export interface LoadingState {
  tasks: boolean
  projects: boolean
  comments: boolean
  attachments: boolean
  saving: boolean
}

// Helper types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

// Database trigger function types
export interface ActivityLogTrigger {
  action: 'created' | 'updated' | 'deleted'
  entity_type: string
  entity_id: string
  old_values?: Record<string, any>
  new_values?: Record<string, any>
}

// Task workflow transition
export interface TaskTransition {
  from_status: TaskStatus
  to_status: TaskStatus
  trigger: StepTrigger
  auto_assign_to?: string
  conditions?: Record<string, any>
}

// Project analytics
export interface ProjectAnalytics {
  task_completion_rate: number
  average_completion_time: number
  tasks_created_this_month: number
  tasks_completed_this_month: number
  team_member_count: number
  most_productive_member: UserProfile
  common_tags: Array<{ tag: string; count: number }>
}