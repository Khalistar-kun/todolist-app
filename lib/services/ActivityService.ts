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

    // Fetch different activity types in parallel (without nested joins)
    const [tasksResult, commentsResult, assignmentsResult] = await Promise.all([
      // Recent task updates
      supabase
        .from('tasks')
        .select('id, title, created_at, updated_at, completed_at, stage_id, approval_status, created_by')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(limit),

      // Recent comments
      supabase
        .from('comments')
        .select('id, content, created_at, task_id, created_by')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit),

      // Recent assignments
      supabase
        .from('task_assignments')
        .select('id, task_id, user_id, assigned_at, assigned_by')
        .order('assigned_at', { ascending: false })
        .limit(limit),
    ])

    const tasks = tasksResult
    const comments = commentsResult
    const assignments = assignmentsResult

    // Collect all user IDs we need profiles for
    const userIds = new Set<string>()
    tasks.data?.forEach(t => t.created_by && userIds.add(t.created_by))
    comments.data?.forEach(c => c.created_by && userIds.add(c.created_by))
    assignments.data?.forEach(a => {
      if (a.user_id) userIds.add(a.user_id)
      if (a.assigned_by) userIds.add(a.assigned_by)
    })

    // Fetch all profiles at once
    const { data: profiles } = userIds.size > 0 ? await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', Array.from(userIds)) : { data: [] }

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    // Get task titles for comments and assignments
    const taskIdsNeeded = new Set<string>()
    comments.data?.forEach(c => c.task_id && taskIdsNeeded.add(c.task_id))
    assignments.data?.forEach(a => a.task_id && taskIdsNeeded.add(a.task_id))

    const { data: taskTitles } = taskIdsNeeded.size > 0 ? await supabase
      .from('tasks')
      .select('id, title, project_id')
      .in('id', Array.from(taskIdsNeeded)) : { data: [] }

    const taskMap = new Map(taskTitles?.map(t => [t.id, t]) || [])

    // Process tasks
    for (const task of tasks.data || []) {
      const creator = task.created_by ? profileMap.get(task.created_by) : null

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
      const creator = comment.created_by ? profileMap.get(comment.created_by) : null
      const task = taskMap.get(comment.task_id)

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
      const task = taskMap.get(assignment.task_id)
      if (task?.project_id !== projectId) continue

      const assigner = assignment.assigned_by ? profileMap.get(assignment.assigned_by) : null
      const user = assignment.user_id ? profileMap.get(assignment.user_id) : null

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
      .select('project_id')
      .eq('user_id', userId)

    const projectIds = memberships?.map(m => m.project_id) || []

    // Get projects info
    const { data: projects } = projectIds.length > 0 ? await supabase
      .from('projects')
      .select('id, name, color')
      .in('id', projectIds) : { data: [] }

    const projectMap = new Map(projects?.map(p => [p.id, p]) || [])

    // Get tasks assigned to user
    const { data: assignments } = await supabase
      .from('task_assignments')
      .select('id, task_id, assigned_at, assigned_by')
      .eq('user_id', userId)
      .order('assigned_at', { ascending: false })
      .limit(limit)

    // Get comments mentioning user
    const { data: mentions } = await supabase
      .from('comments')
      .select('id, content, created_at, task_id, project_id, created_by')
      .contains('mentions', [userId])
      .order('created_at', { ascending: false })
      .limit(limit)

    // Collect all task IDs and user IDs we need
    const taskIds = new Set<string>()
    const userIdsNeeded = new Set<string>()

    assignments?.forEach(a => {
      if (a.task_id) taskIds.add(a.task_id)
      if (a.assigned_by) userIdsNeeded.add(a.assigned_by)
    })
    mentions?.forEach(c => {
      if (c.task_id) taskIds.add(c.task_id)
      if (c.created_by) userIdsNeeded.add(c.created_by)
    })

    // Fetch tasks and profiles
    const { data: tasksData } = taskIds.size > 0 ? await supabase
      .from('tasks')
      .select('id, title, project_id')
      .in('id', Array.from(taskIds)) : { data: [] }

    const taskMap = new Map(tasksData?.map(t => [t.id, t]) || [])

    const { data: profilesData } = userIdsNeeded.size > 0 ? await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', Array.from(userIdsNeeded)) : { data: [] }

    const profileMap = new Map(profilesData?.map(p => [p.id, p]) || [])

    // Process assignments
    for (const assignment of assignments || []) {
      const task = taskMap.get(assignment.task_id)
      const assigner = assignment.assigned_by ? profileMap.get(assignment.assigned_by) : null
      const project = task?.project_id ? projectMap.get(task.project_id) : null

      if (!project || !task) continue

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

    // Process mentions
    for (const comment of mentions || []) {
      const creator = comment.created_by ? profileMap.get(comment.created_by) : null
      const task = taskMap.get(comment.task_id)
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
