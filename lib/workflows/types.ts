/**
 * Workflow System Types
 * Defines the structure for automated task workflows
 */

import type { TaskStatus } from '../types'

// Workflow trigger types
export type WorkflowTrigger =
  | 'task_created'
  | 'task_updated'
  | 'status_changed'
  | 'assignee_added'
  | 'assignee_removed'
  | 'due_date_approaching'
  | 'due_date_passed'
  | 'task_completed'

// Workflow action types
export type WorkflowAction =
  | 'send_email'
  | 'send_slack'
  | 'create_task'
  | 'update_task'
  | 'assign_user'
  | 'set_due_date'
  | 'change_status'
  | 'add_comment'

// Condition operators
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'

// Field types for conditions
export type ConditionField =
  | 'title'
  | 'description'
  | 'status'
  | 'assignees'
  | 'due_at'
  | 'client_id'
  | 'created_at'

// Workflow condition
export interface WorkflowCondition {
  field: ConditionField
  operator: ConditionOperator
  value?: string | number | boolean
}

// Workflow action configuration
export interface WorkflowActionConfig {
  type: WorkflowAction
  params: Record<string, any>
}

// Complete workflow rule
export interface WorkflowRule {
  id: string
  project_id: string
  name: string
  description?: string
  enabled: boolean
  trigger: WorkflowTrigger
  conditions: WorkflowCondition[]
  actions: WorkflowActionConfig[]
  created_by: string
  created_at: string
  updated_at: string
}

// Workflow execution log
export interface WorkflowExecution {
  id: string
  workflow_rule_id: string
  task_id: string
  executed_at: string
  success: boolean
  error_message?: string
  actions_executed: number
}

// UI Builder types
export interface WorkflowBuilderState {
  name: string
  description: string
  enabled: boolean
  trigger: WorkflowTrigger | null
  conditions: WorkflowCondition[]
  actions: WorkflowActionConfig[]
}
