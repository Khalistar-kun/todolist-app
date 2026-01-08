-- Migration: Add complete RLS policies for all tables
-- This migration adds INSERT and DELETE policies that were missing from the original schema
-- Uses DROP POLICY IF EXISTS to avoid conflicts with existing policies

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================

-- Allow users to insert their own profile (needed for new user signup)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to view other profiles (needed for showing team members)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
CREATE POLICY "Users can view profiles" ON profiles
  FOR SELECT USING (true);  -- All authenticated users can view profiles

-- ============================================
-- ORGANIZATIONS TABLE POLICIES
-- ============================================

-- Allow authenticated users to create organizations
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow organization owners/admins to delete organizations
DROP POLICY IF EXISTS "Organization owners can delete organization" ON organizations;
CREATE POLICY "Organization owners can delete organization" ON organizations
  FOR DELETE USING (
    created_by = auth.uid() OR
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Update the SELECT policy to also allow viewing orgs you created (before membership is added)
DROP POLICY IF EXISTS "Organization members can view organization" ON organizations;
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    created_by = auth.uid() OR
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- ORGANIZATION_MEMBERS TABLE POLICIES
-- ============================================

-- Allow organization owners/admins to add members
DROP POLICY IF EXISTS "Organization admins can add members" ON organization_members;
CREATE POLICY "Organization admins can add members" ON organization_members
  FOR INSERT WITH CHECK (
    -- Allow if user is creating their own membership (self-joining as owner)
    (user_id = auth.uid() AND role = 'owner') OR
    -- Allow if user is an admin/owner of the organization
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow organization owners/admins to update member roles
DROP POLICY IF EXISTS "Organization admins can update members" ON organization_members;
CREATE POLICY "Organization admins can update members" ON organization_members
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow organization owners/admins to remove members
DROP POLICY IF EXISTS "Organization admins can remove members" ON organization_members;
CREATE POLICY "Organization admins can remove members" ON organization_members
  FOR DELETE USING (
    -- Users can remove themselves
    user_id = auth.uid() OR
    -- Admins/owners can remove others
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ============================================
-- PROJECTS TABLE POLICIES
-- ============================================

-- Allow organization members to create projects
DROP POLICY IF EXISTS "Organization members can create projects" ON projects;
CREATE POLICY "Organization members can create projects" ON projects
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Allow project owners/admins to delete projects
DROP POLICY IF EXISTS "Project admins can delete projects" ON projects;
CREATE POLICY "Project admins can delete projects" ON projects
  FOR DELETE USING (
    created_by = auth.uid() OR
    id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Update SELECT policy to include projects user created (before membership is added)
DROP POLICY IF EXISTS "Project members can view projects" ON projects;
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
CREATE POLICY "Users can view their projects" ON projects
  FOR SELECT USING (
    created_by = auth.uid() OR
    id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- PROJECT_MEMBERS TABLE POLICIES
-- ============================================

-- Allow project owners/admins to add members
DROP POLICY IF EXISTS "Project admins can add members" ON project_members;
CREATE POLICY "Project admins can add members" ON project_members
  FOR INSERT WITH CHECK (
    -- Allow if user is creating their own membership (self-joining as owner)
    (user_id = auth.uid() AND role = 'owner') OR
    -- Allow if user is an admin/owner of the project
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow project owners/admins to update member roles
DROP POLICY IF EXISTS "Project admins can update members" ON project_members;
CREATE POLICY "Project admins can update members" ON project_members
  FOR UPDATE USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow project owners/admins to remove members (or users can remove themselves)
DROP POLICY IF EXISTS "Project admins can remove members" ON project_members;
CREATE POLICY "Project admins can remove members" ON project_members
  FOR DELETE USING (
    -- Users can remove themselves
    user_id = auth.uid() OR
    -- Admins/owners can remove others
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================

-- Allow project members with edit permissions to create tasks
DROP POLICY IF EXISTS "Project editors can create tasks" ON tasks;
CREATE POLICY "Project editors can create tasks" ON tasks
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
    )
  );

-- Allow task creators and project admins to delete tasks
DROP POLICY IF EXISTS "Project editors can delete tasks" ON tasks;
CREATE POLICY "Project editors can delete tasks" ON tasks
  FOR DELETE USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
    )
  );

-- ============================================
-- TASK_ASSIGNMENTS TABLE POLICIES
-- ============================================

-- Allow project editors to create task assignments
DROP POLICY IF EXISTS "Project editors can create task assignments" ON task_assignments;
CREATE POLICY "Project editors can create task assignments" ON task_assignments
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- Allow project editors to update task assignments
DROP POLICY IF EXISTS "Project editors can update task assignments" ON task_assignments;
CREATE POLICY "Project editors can update task assignments" ON task_assignments
  FOR UPDATE USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- Allow project editors to delete task assignments
DROP POLICY IF EXISTS "Project editors can delete task assignments" ON task_assignments;
CREATE POLICY "Project editors can delete task assignments" ON task_assignments
  FOR DELETE USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- ============================================
-- SUBTASKS TABLE POLICIES
-- ============================================

-- Allow project members to view subtasks
DROP POLICY IF EXISTS "Project members can view subtasks" ON subtasks;
CREATE POLICY "Project members can view subtasks" ON subtasks
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Allow project editors to create subtasks
DROP POLICY IF EXISTS "Project editors can create subtasks" ON subtasks;
CREATE POLICY "Project editors can create subtasks" ON subtasks
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- Allow project editors to update subtasks
DROP POLICY IF EXISTS "Project editors can update subtasks" ON subtasks;
CREATE POLICY "Project editors can update subtasks" ON subtasks
  FOR UPDATE USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- Allow project editors to delete subtasks
DROP POLICY IF EXISTS "Project editors can delete subtasks" ON subtasks;
CREATE POLICY "Project editors can delete subtasks" ON subtasks
  FOR DELETE USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- ============================================
-- COMMENTS TABLE POLICIES
-- ============================================

-- Allow users to update their own comments
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (created_by = auth.uid());

-- Allow users to delete their own comments (or project admins)
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ============================================
-- ATTACHMENTS TABLE POLICIES
-- ============================================

-- Allow project members to view attachments
DROP POLICY IF EXISTS "Project members can view attachments" ON attachments;
CREATE POLICY "Project members can view attachments" ON attachments
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Allow project editors to create attachments
DROP POLICY IF EXISTS "Project editors can create attachments" ON attachments;
CREATE POLICY "Project editors can create attachments" ON attachments
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
      )
    )
  );

-- Allow attachment uploaders and project admins to delete attachments
DROP POLICY IF EXISTS "Users can delete own attachments" ON attachments;
CREATE POLICY "Users can delete own attachments" ON attachments
  FOR DELETE USING (
    uploaded_by = auth.uid() OR
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
      )
    )
  );

-- ============================================
-- TIME_ENTRIES TABLE POLICIES
-- ============================================

-- Allow project members to view time entries
DROP POLICY IF EXISTS "Project members can view time entries" ON time_entries;
CREATE POLICY "Project members can view time entries" ON time_entries
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Allow users to create their own time entries
DROP POLICY IF EXISTS "Users can create own time entries" ON time_entries;
CREATE POLICY "Users can create own time entries" ON time_entries
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Allow users to update their own time entries
DROP POLICY IF EXISTS "Users can update own time entries" ON time_entries;
CREATE POLICY "Users can update own time entries" ON time_entries
  FOR UPDATE USING (user_id = auth.uid());

-- Allow users to delete their own time entries
DROP POLICY IF EXISTS "Users can delete own time entries" ON time_entries;
CREATE POLICY "Users can delete own time entries" ON time_entries
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- ACTIVITY_LOGS TABLE POLICIES
-- ============================================

-- Allow project members to view activity logs
DROP POLICY IF EXISTS "Project members can view activity logs" ON activity_logs;
CREATE POLICY "Project members can view activity logs" ON activity_logs
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- Activity logs are created by triggers, so we need a policy for system inserts
DROP POLICY IF EXISTS "System can create activity logs" ON activity_logs;
CREATE POLICY "System can create activity logs" ON activity_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================

-- Allow users to create notifications for others (for the notification system)
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Allow users to delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- WEBHOOKS TABLE POLICIES
-- ============================================

-- Enable RLS on webhooks if not already enabled
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Allow project admins to view webhooks
DROP POLICY IF EXISTS "Project admins can view webhooks" ON webhooks;
CREATE POLICY "Project admins can view webhooks" ON webhooks
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow project admins to create webhooks
DROP POLICY IF EXISTS "Project admins can create webhooks" ON webhooks;
CREATE POLICY "Project admins can create webhooks" ON webhooks
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow project admins to update webhooks
DROP POLICY IF EXISTS "Project admins can update webhooks" ON webhooks;
CREATE POLICY "Project admins can update webhooks" ON webhooks
  FOR UPDATE USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Allow project admins to delete webhooks
DROP POLICY IF EXISTS "Project admins can delete webhooks" ON webhooks;
CREATE POLICY "Project admins can delete webhooks" ON webhooks
  FOR DELETE USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ============================================
-- FUNCTION: Auto-create profile on user signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant permissions on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
