import { supabase } from '@/lib/supabase'

export type ActivityType =
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_moved'
  | 'task_assigned'
  | 'task_unassigned'
  | 'comment_added'
  | 'comment_mentioned'
  | 'milestone_created'
  | 'milestone_completed'
  | 'project_member_added'
  | 'project_member_removed'
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_rejected'
  | 'time_logged'

export interface Activity {
  id: string
  type: ActivityType
  actor_id: string
  actor_name: string
  actor_avatar: string | null
  project_id: string
  project_name: string
  project_color: string
  task_id?: string
  task_title?: string
  comment_id?: string
  milestone_id?: string
  milestone_name?: string
  target_user_id?: string
  target_user_name?: string
  metadata: Record<string, any>
  created_at: string
}

export interface ActivityFilters {
  projectId?: string
  userId?: string
  types?: ActivityType[]
  limit?: number
  offset?: number
}

export class ActivityService {
  /**
   * Get activity feed for a project
   */
  static async getProjectActivity(
    projectId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Activity[]> {
    const { limit = 50, offset = 0 } = options
    const activities: Activity[] = []

    // Get project info
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, color')
      .eq('id', projectId)
      .single()

    if (!project) return []

    // Fetch different activity types in parallel
    const [tasks, comments, assignments] = await Promise.all([
      // Recent task updates
      supabase
        .from('tasks')
        .select(`
          id,
          title,
          created_at,
          updated_at,
          completed_at,
          stage_id,
          approval_status,
          created_by,
          creator:profiles!tasks_created_by_fkey (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(limit),

      // Recent comments
      supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          task_id,
          created_by,
          task:tasks (title),
          creator:profiles!comments_created_by_fkey (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit),

      // Recent assignments
      supabase
        .from('task_assignments')
        .select(`
          id,
          task_id,
          user_id,
          assigned_at,
          assigned_by,
          task:tasks (title, project_id),
          user:profiles!task_assignments_user_id_fkey (full_name, email),
          assigner:profiles!task_assignments_assigned_by_fkey (full_name, email, avatar_url)
        `)
        .order('assigned_at', { ascending: false })
        .limit(limit),
    ])

    // Process tasks
    for (const task of tasks.data || []) {
      const creator = task.creator as any

      // Task created
      activities.push({
        id: `task-created-${task.id}`,
        type: 'task_created',
        actor_id: task.created_by || '',
        actor_name: creator?.full_name || creator?.email || 'Unknown',
        actor_avatar: creator?.avatar_url || null,
        project_id: projectId,
        project_name: project.name,
        project_color: project.color,
        task_id: task.id,
        task_title: task.title,
        metadata: {},
        created_at: task.created_at,
      })

      // Task completed
      if (task.completed_at) {
        activities.push({
          id: `task-completed-${task.id}`,
          type: 'task_completed',
          actor_id: task.created_by || '',
          actor_name: creator?.full_name || creator?.email || 'Unknown',
          actor_avatar: creator?.avatar_url || null,
          project_id: projectId,
          project_name: project.name,
          project_color: project.color,
          task_id: task.id,
          task_title: task.title,
          metadata: {},
          created_at: task.completed_at,
        })
      }

      // Approval requested
      if (task.approval_status === 'pending') {
        activities.push({
          id: `approval-requested-${task.id}`,
          type: 'approval_requested',
          actor_id: task.created_by || '',
          actor_name: creator?.full_name || creator?.email || 'Unknown',
          actor_avatar: creator?.avatar_url || null,
          project_id: projectId,
          project_name: project.name,
          project_color: project.color,
          task_id: task.id,
          task_title: task.title,
          metadata: {},
          created_at: task.updated_at,
        })
      }
    }

    // Process comments
    for (const comment of comments.data || []) {
      const creator = comment.creator as any
      const task = comment.task as any

      activities.push({
        id: `comment-${comment.id}`,
        type: 'comment_added',
        actor_id: comment.created_by || '',
        actor_name: creator?.full_name || creator?.email || 'Unknown',
        actor_avatar: creator?.avatar_url || null,
        project_id: projectId,
        project_name: project.name,
        project_color: project.color,
        task_id: comment.task_id,
        task_title: task?.title || 'Unknown Task',
        comment_id: comment.id,
        metadata: {
          content_preview: comment.content.substring(0, 100),
        },
        created_at: comment.created_at,
      })
    }

    // Process assignments
    for (const assignment of assignments.data || []) {
      const task = assignment.task as any
      if (task?.project_id !== projectId) continue

      const assigner = assignment.assigner as any
      const user = assignment.user as any

      activities.push({
        id: `assignment-${assignment.id}`,
        type: 'task_assigned',
        actor_id: assignment.assigned_by || '',
        actor_name: assigner?.full_name || assigner?.email || 'Unknown',
        actor_avatar: assigner?.avatar_url || null,
        project_id: projectId,
        project_name: project.name,
        project_color: project.color,
        task_id: assignment.task_id,
        task_title: task?.title || 'Unknown Task',
        target_user_id: assignment.user_id,
        target_user_name: user?.full_name || user?.email || 'Unknown',
        metadata: {},
        created_at: assignment.assigned_at,
      })
    }

    // Sort by date and apply limit/offset
    return activities
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(offset, offset + limit)
  }

  /**
   * Get activity feed for a user (their mentions, assignments, etc.)
   */
  static async getUserActivity(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Activity[]> {
    const { limit = 50, offset = 0 } = options
    const activities: Activity[] = []

    // Get user's project memberships
    const { data: memberships } = await supabase
      .from('project_members')
      .select('project_id, project:projects (name, color)')
      .eq('user_id', userId)

    const projectMap = new Map(
      memberships?.map(m => [m.project_id, m.project as any]) || []
    )

    // Get tasks assigned to user
    const { data: assignments } = await supabase
      .from('task_assignments')
      .select(`
        id,
        task_id,
        assigned_at,
        assigned_by,
        task:tasks (title, project_id),
        assigner:profiles!task_assignments_assigned_by_fkey (full_name, email, avatar_url)
      `)
      .eq('user_id', userId)
      .order('assigned_at', { ascending: false })
      .limit(limit)

    for (const assignment of assignments || []) {
      const task = assignment.task as any
      const assigner = assignment.assigner as any
      const project = projectMap.get(task?.project_id)

      if (!project) continue

      activities.push({
        id: `assigned-${assignment.id}`,
        type: 'task_assigned',
        actor_id: assignment.assigned_by || '',
        actor_name: assigner?.full_name || assigner?.email || 'Unknown',
        actor_avatar: assigner?.avatar_url || null,
        project_id: task.project_id,
        project_name: project.name,
        project_color: project.color,
        task_id: assignment.task_id,
        task_title: task.title,
        target_user_id: userId,
        metadata: {},
        created_at: assignment.assigned_at,
      })
    }

    // Get comments mentioning user
    const { data: mentions } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        task_id,
        project_id,
        created_by,
        task:tasks (title),
        creator:profiles!comments_created_by_fkey (full_name, email, avatar_url)
      `)
      .contains('mentions', [userId])
      .order('created_at', { ascending: false })
      .limit(limit)

    for (const comment of mentions || []) {
      const creator = comment.creator as any
      const task = comment.task as any
      const project = projectMap.get(comment.project_id)

      if (!project) continue

      activities.push({
        id: `mention-${comment.id}`,
        type: 'comment_mentioned',
        actor_id: comment.created_by || '',
        actor_name: creator?.full_name || creator?.email || 'Unknown',
        actor_avatar: creator?.avatar_url || null,
        project_id: comment.project_id,
        project_name: project.name,
        project_color: project.color,
        task_id: comment.task_id,
        task_title: task?.title || 'Unknown Task',
        comment_id: comment.id,
        target_user_id: userId,
        metadata: {
          content_preview: comment.content.substring(0, 100),
        },
        created_at: comment.created_at,
      })
    }

    return activities
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(offset, offset + limit)
  }

  /**
   * Format activity for display
   */
  static formatActivity(activity: Activity): string {
    switch (activity.type) {
      case 'task_created':
        return `created task "${activity.task_title}"`
      case 'task_completed':
        return `completed task "${activity.task_title}"`
      case 'task_moved':
        return `moved task "${activity.task_title}"`
      case 'task_assigned':
        return `assigned "${activity.task_title}" to ${activity.target_user_name}`
      case 'task_unassigned':
        return `unassigned ${activity.target_user_name} from "${activity.task_title}"`
      case 'comment_added':
        return `commented on "${activity.task_title}"`
      case 'comment_mentioned':
        return `mentioned you in a comment on "${activity.task_title}"`
      case 'milestone_created':
        return `created milestone "${activity.milestone_name}"`
      case 'milestone_completed':
        return `completed milestone "${activity.milestone_name}"`
      case 'approval_requested':
        return `requested approval for "${activity.task_title}"`
      case 'approval_approved':
        return `approved "${activity.task_title}"`
      case 'approval_rejected':
        return `rejected "${activity.task_title}"`
      case 'time_logged':
        return `logged time on "${activity.task_title}"`
      default:
        return 'performed an action'
    }
  }

  /**
   * Get activity icon
   */
  static getActivityIcon(type: ActivityType): string {
    switch (type) {
      case 'task_created':
        return 'plus'
      case 'task_completed':
        return 'check'
      case 'task_moved':
        return 'arrow-right'
      case 'task_assigned':
      case 'task_unassigned':
        return 'user'
      case 'comment_added':
      case 'comment_mentioned':
        return 'chat'
      case 'milestone_created':
      case 'milestone_completed':
        return 'flag'
      case 'approval_requested':
      case 'approval_approved':
      case 'approval_rejected':
        return 'clipboard-check'
      case 'time_logged':
        return 'clock'
      default:
        return 'activity'
    }
  }
}
