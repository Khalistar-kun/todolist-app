/**
 * Workflow Execution Engine
 * Evaluates conditions and executes actions for workflow automation
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Task } from '../types'
import type {
  WorkflowRule,
  WorkflowCondition,
  WorkflowActionConfig,
  ConditionOperator,
  WorkflowTrigger,
} from './types'
import { getSlackConfig, notifyTaskCreated } from '../slack'

/**
 * Evaluate a single condition against a task
 */
function evaluateCondition(task: Task, condition: WorkflowCondition): boolean {
  const fieldValue = task[condition.field as keyof Task]
  const { operator, value } = condition

  switch (operator) {
    case 'equals':
      return fieldValue === value

    case 'not_equals':
      return fieldValue !== value

    case 'contains':
      if (typeof fieldValue === 'string' && typeof value === 'string') {
        return fieldValue.toLowerCase().includes(value.toLowerCase())
      }
      if (Array.isArray(fieldValue) && value) {
        return fieldValue.includes(value as any)
      }
      return false

    case 'not_contains':
      if (typeof fieldValue === 'string' && typeof value === 'string') {
        return !fieldValue.toLowerCase().includes(value.toLowerCase())
      }
      if (Array.isArray(fieldValue) && value) {
        return !fieldValue.includes(value as any)
      }
      return true

    case 'greater_than':
      if (typeof fieldValue === 'number' && typeof value === 'number') {
        return fieldValue > value
      }
      if (typeof fieldValue === 'string' && typeof value === 'string') {
        return new Date(fieldValue) > new Date(value)
      }
      return false

    case 'less_than':
      if (typeof fieldValue === 'number' && typeof value === 'number') {
        return fieldValue < value
      }
      if (typeof fieldValue === 'string' && typeof value === 'string') {
        return new Date(fieldValue) < new Date(value)
      }
      return false

    case 'is_empty':
      if (Array.isArray(fieldValue)) return fieldValue.length === 0
      return !fieldValue

    case 'is_not_empty':
      if (Array.isArray(fieldValue)) return fieldValue.length > 0
      return !!fieldValue

    default:
      return false
  }
}

/**
 * Evaluate all conditions for a workflow rule
 * All conditions must pass (AND logic)
 */
export function evaluateConditions(task: Task, conditions: WorkflowCondition[]): boolean {
  if (conditions.length === 0) return true
  return conditions.every((condition) => evaluateCondition(task, condition))
}

/**
 * Execute a single workflow action
 */
async function executeAction(
  supabase: SupabaseClient,
  task: Task,
  action: WorkflowActionConfig
): Promise<void> {
  switch (action.type) {
    case 'send_email':
      // TODO: Implement email sending via API route
      console.log('Send email action:', action.params)
      break

    case 'send_slack':
      if (task.project_id) {
        const slackConfig = await getSlackConfig(supabase, task.project_id)
        if (slackConfig) {
          await notifyTaskCreated(slackConfig, {
            ...task,
            title: action.params.message || task.title,
          })
        }
      }
      break

    case 'create_task':
      await supabase.from('tasks').insert({
        project_id: task.project_id,
        client_id: task.client_id,
        title: action.params.title,
        description: action.params.description || null,
        status: action.params.status || 'todo',
        assignees: action.params.assignees || [],
      })
      break

    case 'update_task':
      const updates: any = {}
      if (action.params.title) updates.title = action.params.title
      if (action.params.description) updates.description = action.params.description
      if (action.params.status) updates.status = action.params.status
      if (action.params.assignees) updates.assignees = action.params.assignees

      await supabase.from('tasks').update(updates).eq('id', task.id)
      break

    case 'assign_user':
      const currentAssignees = task.assignees || []
      const newAssignee = action.params.email
      if (newAssignee && !currentAssignees.includes(newAssignee)) {
        await supabase
          .from('tasks')
          .update({
            assignees: [...currentAssignees, newAssignee],
          })
          .eq('id', task.id)
      }
      break

    case 'set_due_date':
      const dueDate = action.params.due_date
      if (dueDate) {
        await supabase
          .from('tasks')
          .update({ due_at: new Date(dueDate).toISOString() })
          .eq('id', task.id)
      }
      break

    case 'change_status':
      if (action.params.status) {
        await supabase
          .from('tasks')
          .update({
            status: action.params.status,
            completed_at: action.params.status === 'done' ? new Date().toISOString() : null,
          })
          .eq('id', task.id)
      }
      break

    case 'add_comment':
      // TODO: Implement comments system
      console.log('Add comment action:', action.params)
      break

    default:
      console.warn('Unknown action type:', action.type)
  }
}

/**
 * Check if a trigger matches the current event
 */
export function triggerMatches(
  trigger: WorkflowTrigger,
  eventType: string,
  task?: Task,
  oldTask?: Task
): boolean {
  switch (trigger) {
    case 'task_created':
      return eventType === 'task_created'

    case 'task_updated':
      return eventType === 'task_updated'

    case 'status_changed':
      return eventType === 'task_updated' && task?.status !== oldTask?.status

    case 'assignee_added':
      if (eventType === 'task_updated' && task && oldTask) {
        const oldAssignees = oldTask.assignees || []
        const newAssignees = task.assignees || []
        return newAssignees.length > oldAssignees.length
      }
      return false

    case 'assignee_removed':
      if (eventType === 'task_updated' && task && oldTask) {
        const oldAssignees = oldTask.assignees || []
        const newAssignees = task.assignees || []
        return newAssignees.length < oldAssignees.length
      }
      return false

    case 'task_completed':
      return eventType === 'task_updated' && task?.status === 'done'

    case 'due_date_approaching':
      // This would be triggered by a scheduled job, not by task events
      if (task?.due_at) {
        const dueDate = new Date(task.due_at)
        const now = new Date()
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        return hoursUntilDue <= 24 && hoursUntilDue > 0
      }
      return false

    case 'due_date_passed':
      if (task?.due_at) {
        const dueDate = new Date(task.due_at)
        const now = new Date()
        return now > dueDate
      }
      return false

    default:
      return false
  }
}

/**
 * Execute a workflow rule for a given task
 */
export async function executeWorkflow(
  supabase: SupabaseClient,
  rule: WorkflowRule,
  task: Task,
  eventType: string,
  oldTask?: Task
): Promise<{ success: boolean; actionsExecuted: number; error?: string }> {
  try {
    // Check if trigger matches
    if (!triggerMatches(rule.trigger, eventType, task, oldTask)) {
      return { success: true, actionsExecuted: 0 }
    }

    // Evaluate conditions
    if (!evaluateConditions(task, rule.conditions)) {
      return { success: true, actionsExecuted: 0 }
    }

    // Execute all actions
    let actionsExecuted = 0
    for (const action of rule.actions) {
      await executeAction(supabase, task, action)
      actionsExecuted++
    }

    // Log execution
    await supabase.from('workflow_executions').insert({
      workflow_rule_id: rule.id,
      task_id: task.id,
      success: true,
      actions_executed: actionsExecuted,
    })

    return { success: true, actionsExecuted }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Log failed execution
    await supabase.from('workflow_executions').insert({
      workflow_rule_id: rule.id,
      task_id: task.id,
      success: false,
      error_message: errorMessage,
      actions_executed: 0,
    })

    return { success: false, actionsExecuted: 0, error: errorMessage }
  }
}

/**
 * Find and execute all matching workflows for a task event
 */
export async function processTaskWorkflows(
  supabase: SupabaseClient,
  projectId: string,
  task: Task,
  eventType: 'task_created' | 'task_updated',
  oldTask?: Task
): Promise<void> {
  try {
    // Fetch all enabled workflows for this project
    const { data: rules, error } = await supabase
      .from('workflow_rules')
      .select('*')
      .eq('project_id', projectId)
      .eq('enabled', true)

    if (error || !rules) {
      console.error('Failed to fetch workflow rules:', error)
      return
    }

    // Execute each matching workflow
    for (const rule of rules) {
      await executeWorkflow(supabase, rule, task, eventType, oldTask)
    }
  } catch (error) {
    console.error('Error processing workflows:', error)
  }
}
