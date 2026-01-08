#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database for TodoList App...');

  try {
    // Enable necessary extensions
    console.log('📦 Enabling PostgreSQL extensions...');
    await supabase.rpc('sql', { query: 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"' });
    await supabase.rpc('sql', { query: 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"' });

    // Create user_profiles table
    console.log('👥 Creating user_profiles table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.user_profiles (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT,
          full_name TEXT,
          username TEXT UNIQUE,
          avatar_url TEXT,
          timezone TEXT DEFAULT 'UTC',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `
    });

    // Create organizations table
    console.log('🏢 Creating organizations table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.organizations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          description TEXT,
          avatar_url TEXT,
          owner_id UUID REFERENCES auth.users(id),
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `
    });

    // Create organization_members table
    console.log('👥 Creating organization_members table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.organization_members (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
          invited_by UUID REFERENCES auth.users(id),
          invited_at TIMESTAMPTZ DEFAULT now(),
          joined_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(organization_id, user_id)
        );
      `
    });

    // Create projects table
    console.log('📋 Creating projects table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.projects (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name TEXT NOT NULL,
          description TEXT,
          color TEXT DEFAULT '#3B82F6',
          organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
          owner_id UUID REFERENCES auth.users(id),
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
          workflow JSONB DEFAULT '[
            {"id": "todo", "name": "To Do", "color": "#94A3B8"},
            {"id": "progress", "name": "In Progress", "color": "#3B82F6"},
            {"id": "review", "name": "Review", "color": "#F59E0B"},
            {"id": "done", "name": "Done", "color": "#10B981"}
          ]',
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `
    });

    // Create project_members table
    console.log('👥 Creating project_members table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.project_members (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
          added_by UUID REFERENCES auth.users(id),
          created_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(project_id, user_id)
        );
      `
    });

    // Create tasks table
    console.log('✅ Creating tasks table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.tasks (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          title TEXT NOT NULL,
          description TEXT,
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          assignee_id UUID REFERENCES auth.users(id),
          reporter_id UUID REFERENCES auth.users(id),
          status TEXT DEFAULT 'todo',
          priority TEXT DEFAULT 'medium' CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
          labels JSONB DEFAULT '[]',
          due_date TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          archived_at TIMESTAMPTZ,
          position INTEGER DEFAULT 0,
          estimated_hours INTEGER,
          actual_hours INTEGER,
          custom_fields JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `
    });

    // Create task_assignments table (for multiple assignees)
    console.log('👥 Creating task_assignments table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.task_assignments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          assigned_by UUID REFERENCES auth.users(id),
          assigned_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(task_id, user_id)
        );
      `
    });

    // Create subtasks table
    console.log('📝 Creating subtasks table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.subtasks (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          completed BOOLEAN DEFAULT false,
          position INTEGER DEFAULT 0,
          created_by UUID REFERENCES auth.users(id),
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `
    });

    // Create comments table
    console.log('💬 Creating comments table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.comments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id),
          content TEXT NOT NULL,
          mentions JSONB DEFAULT '[]',
          edited BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `
    });

    // Create attachments table
    console.log('📎 Creating attachments table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.attachments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id),
          name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size BIGINT,
          file_type TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `
    });

    // Create activity_logs table
    console.log('📊 Creating activity_logs table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.activity_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'project', 'comment')),
          entity_id UUID NOT NULL,
          action TEXT NOT NULL,
          user_id UUID REFERENCES auth.users(id),
          old_values JSONB,
          new_values JSONB,
          details JSONB,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `
    });

    // Create notifications table
    console.log('🔔 Creating notifications table...');
    await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.notifications (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT,
          entity_type TEXT,
          entity_id UUID,
          read BOOLEAN DEFAULT false,
          data JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `
    });

    // Create indexes for performance
    console.log('🔍 Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);',
      'CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);',
      'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);',
      'CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);',
      'CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);',
      'CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);'
    ];

    for (const index of indexes) {
      await supabase.rpc('sql', { query: index });
    }

    // Enable RLS on all tables
    console.log('🔒 Enabling Row Level Security...');
    const tables = [
      'user_profiles', 'organizations', 'organization_members', 'projects',
      'project_members', 'tasks', 'task_assignments', 'subtasks', 'comments',
      'attachments', 'activity_logs', 'notifications'
    ];

    for (const table of tables) {
      await supabase.rpc('sql', { query: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;` });
    }

    // Create trigger function for updated_at
    console.log('⚙️ Creating update triggers...');
    await supabase.rpc('sql', {
      query: `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `
    });

    // Create triggers
    const triggers = [
      'CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      'CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      'CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      'CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      'CREATE TRIGGER update_subtasks_updated_at BEFORE UPDATE ON subtasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      'CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();'
    ];

    for (const trigger of triggers) {
      await supabase.rpc('sql', { query: trigger });
    }

    console.log('✅ Database setup complete!');
    console.log('\n📊 Tables created:');
    console.log('- user_profiles');
    console.log('- organizations');
    console.log('- organization_members');
    console.log('- projects');
    console.log('- project_members');
    console.log('- tasks');
    console.log('- task_assignments');
    console.log('- subtasks');
    console.log('- comments');
    console.log('- attachments');
    console.log('- activity_logs');
    console.log('- notifications');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

// Run the setup
setupDatabase();