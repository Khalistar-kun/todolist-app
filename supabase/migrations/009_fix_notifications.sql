-- Fix notifications table to support all notification types
-- This migration adds new notification types and ensures proper RLS policies

-- First, let's alter the type column to use TEXT instead of the enum
-- This is more flexible and allows for any notification type
ALTER TABLE notifications
  ALTER COLUMN type TYPE TEXT USING type::TEXT;

-- Drop the old enum type if it exists (it might be in use elsewhere)
-- We'll keep using TEXT for flexibility
DO $$
BEGIN
  -- Drop the old enum if no other tables use it
  DROP TYPE IF EXISTS notification_type;
EXCEPTION
  WHEN dependent_objects_still_exist THEN
    -- Enum is still in use elsewhere, that's fine
    NULL;
END $$;

-- Ensure RLS is enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop and recreate all notification policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read, etc.)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- Anyone can create notifications (system/API creates notifications for users)
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Ensure the column name is consistent (use is_read)
-- First check if 'read' column exists and rename it to 'is_read'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'read'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN "read" TO is_read;
  END IF;
END $$;

-- Add is_read column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
