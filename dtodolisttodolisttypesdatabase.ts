export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  todoAAPP: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          created_by: string
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          project_id: string | null
          task_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by: string
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          project_id?: string | null
          task_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          project_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_project_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: null
          },
          {
            foreignKeyName: "activity_logs_task_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: null
          },
        ]
      }
      attachments: {
        Row: {
          comment_id: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          task_id: string | null
          uploaded_by: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string | null
          uploaded_by: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_comment_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: null
          },
          {
            foreignKeyName: "attachments_task_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: null
          },
        ]
      }
      clients: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_project_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: null
          },
        ]
      }
      comments: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          created_by: string
          edited: boolean | null
          id: string
          mentions: string[] | null
          project_id: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          created_by: string
          edited?: boolean | null
          id?: string
          mentions?: string[] | null
          project_id?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          created_by?: string
          edited?: boolean | null
          id?: string
          mentions?: string[] | null
          project_id?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: null
          },
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: null
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: null
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          logo_url: string | null
          max_members: number | null
          name: string
          slug: string
          subscription_tier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          logo_url?: string | null
          max_members?: number | null
          name: string
          slug: string
          subscription_tier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          max_members?: number | null
          name?: string
          slug?: string
          subscription_tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          timezone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          timezone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string | null
          project_id: string
          role: "owner" | "admin" | "member" | "viewer" | null
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          project_id: string
          role?: "owner" | "admin" | "member" | "viewer" | null
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          project_id?: string
          role?: "owner" | "admin" | "member" | "viewer" | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: null
          },
        ]
      }
      projects: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          status: string | null
          updated_at: string | null
          workflow_stages: Json | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          status?: string | null
          updated_at?: string | null
          workflow_stages?: Json | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          status?: string | null
          updated_at?: string | null
          workflow_stages?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: null
          },
        ]
      }
      slack_integrations: {
        Row: {
          channel_name: string | null
          created_at: string | null
          created_by: string
          id: string
          notify_on_task_assign: boolean | null
          notify_on_task_complete: boolean | null
          notify_on_task_create: boolean | null
          project_id: string
          webhook_url: string
        }
        Insert: {
          channel_name?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          notify_on_task_assign?: boolean | null
          notify_on_task_complete?: boolean | null
          notify_on_task_create?: boolean | null
          project_id: string
          webhook_url: string
        }
        Update: {
          channel_name?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          notify_on_task_assign?: boolean | null
          notify_on_task_complete?: boolean | null
          notify_on_task_create?: boolean | null
          project_id?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_integrations_project_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: null
          },
        ]
      }
      subtasks: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          position: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          position?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          position?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: null
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: null
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string[] | null
          assignees: string[]
          client_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_at: string | null
          due_date: string | null
          id: string
          priority: string | null
          project_id: string | null
          slack_message_ts: string | null
          slack_thread_ts: string | null
          stage_id: string | null
          status: "todo" | "in_progress" | "done"
          tags: string[] | null
          title: string
          updated_at: string | null
          workflow_id: string | null
        }
        Insert: {
          assigned_to?: string[] | null
          assignees?: string[]
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          slack_message_ts?: string | null
          slack_thread_ts?: string | null
          stage_id?: string | null
          status?: "todo" | "in_progress" | "done"
          tags?: string[] | null
          title: string
          updated_at?: string | null
          workflow_id?: string | null
        }
        Update: {
          assigned_to?: string[] | null
          assignees?: string[]
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          slack_message_ts?: string | null
          slack_thread_ts?: string | null
          stage_id?: string | null
          status?: "todo" | "in_progress" | "done"
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: null
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: null
          },
          {
            foreignKeyName: "tasks_workflow_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: null
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean | null
          created_at: string
          description: string | null
          duration: number
          ended_at: string | null
          id: string
          started_at: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billable?: boolean | null
          created_at?: string
          description?: string | null
          duration: number
          ended_at?: string | null
          id?: string
          started_at: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billable?: boolean | null
          created_at?: string
          description?: string | null
          duration?: number
          ended_at?: string | null
          id?: string
          started_at?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: null
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean | null
          created_at: string
          created_by: string
          events: string[]
          failure_count: number | null
          id: string
          last_triggered_at: string | null
          project_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          created_by: string
          events?: string[]
          failure_count?: number | null
          id?: string
          last_triggered_at?: string | null
          project_id: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          created_by?: string
          events?: string[]
          failure_count?: number | null
          id?: string
          last_triggered_at?: string | null
          project_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_project_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: null
          },
        ]
      }
      workflow_executions: {
        Row: {
          actions_executed: number | null
          error_message: string | null
          executed_at: string | null
          id: string
          success: boolean
          task_id: string
          workflow_rule_id: string
        }
        Insert: {
          actions_executed?: number | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          success: boolean
          task_id: string
          workflow_rule_id: string
        }
        Update: {
          actions_executed?: number | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          success?: boolean
          task_id?: string
          workflow_rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_task_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: null
          },
          {
            foreignKeyName: "workflow_executions_workflow_rule_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "workflow_rules"
            referencedColumns: null
          },
        ]
      }
      workflow_rules: {
        Row: {
          actions: Json | null
          conditions: Json | null
          created_at: string | null
          created_by: string
          description: string | null
          enabled: boolean | null
          id: string
          name: string
          project_id: string
          trigger: string
          updated_at: string | null
        }
        Insert: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string | null
          created_by: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          project_id: string
          trigger: string
          updated_at?: string | null
        }
        Update: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          project_id?: string
          trigger?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_rules_project_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: null
          },
        ]
      }
      workflow_steps: {
        Row: {
          auto_assign_to: string | null
          created_at: string | null
          from_status: "todo" | "in_progress" | "done"
          id: string
          step_order: number
          to_status: "todo" | "in_progress" | "done"
          trigger_type: "on_completion" | "on_status_change" | "manual" | null
          workflow_id: string
        }
        Insert: {
          auto_assign_to?: string | null
          created_at?: string | null
          from_status: "todo" | "in_progress" | "done"
          id?: string
          step_order: number
          to_status: "todo" | "in_progress" | "done"
          trigger_type?: "on_completion" | "on_status_change" | "manual" | null
          workflow_id: string
        }
        Update: {
          auto_assign_to?: string | null
          created_at?: string | null
          from_status?: "todo" | "in_progress" | "done"
          id?: string
          step_order?: number
          to_status?: "todo" | "in_progress" | "done"
          trigger_type?: "on_completion" | "on_status_change" | "manual" | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: null
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflows_project_id_fkey"
            columns: null
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: null
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  todoAAPP: {
    Enums: {},
  },
} as const
