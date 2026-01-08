-- Organization Announcements table
CREATE TABLE IF NOT EXISTS organization_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Meetings table
CREATE TABLE IF NOT EXISTS organization_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  meeting_link TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'organization_invite', 'project_invite', 'announcement', 'meeting', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}', -- Store additional data like organization_id, project_id, etc.
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_announcements_org ON organization_announcements(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_announcements_created ON organization_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_meetings_org ON organization_meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_meetings_scheduled ON organization_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Enable RLS
ALTER TABLE organization_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check organization membership (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = uid
  );
$$;

-- Helper function to check if user is org admin/owner
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = uid
    AND role IN ('owner', 'admin')
  );
$$;

-- RLS Policies for organization_announcements
CREATE POLICY "Organization members can view announcements"
  ON organization_announcements FOR SELECT
  USING (is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org admins can create announcements"
  ON organization_announcements FOR INSERT
  WITH CHECK (is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins can update announcements"
  ON organization_announcements FOR UPDATE
  USING (is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins can delete announcements"
  ON organization_announcements FOR DELETE
  USING (is_org_admin(organization_id, auth.uid()));

-- RLS Policies for organization_meetings
CREATE POLICY "Organization members can view meetings"
  ON organization_meetings FOR SELECT
  USING (is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org admins can create meetings"
  ON organization_meetings FOR INSERT
  WITH CHECK (is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins can update meetings"
  ON organization_meetings FOR UPDATE
  USING (is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Org admins can delete meetings"
  ON organization_meetings FOR DELETE
  USING (is_org_admin(organization_id, auth.uid()));

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true); -- Allow inserts from service role

-- Function to create notification when member is added to organization
CREATE OR REPLACE FUNCTION notify_org_member_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_name TEXT;
  inviter_name TEXT;
BEGIN
  -- Get organization name
  SELECT name INTO org_name FROM organizations WHERE id = NEW.organization_id;

  -- Get inviter name (the user who added them)
  SELECT COALESCE(full_name, email) INTO inviter_name
  FROM profiles
  WHERE id = auth.uid();

  -- Don't notify if user added themselves (owner creating org)
  IF NEW.user_id != auth.uid() THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'organization_invite',
      'You''ve been added to an organization',
      COALESCE(inviter_name, 'Someone') || ' added you to ' || COALESCE(org_name, 'an organization') || ' as ' || NEW.role,
      jsonb_build_object(
        'organization_id', NEW.organization_id,
        'organization_name', org_name,
        'role', NEW.role
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for organization member notifications
DROP TRIGGER IF EXISTS on_org_member_added ON organization_members;
CREATE TRIGGER on_org_member_added
  AFTER INSERT ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_org_member_added();

-- Grant necessary permissions
GRANT SELECT ON organization_announcements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON organization_announcements TO authenticated;
GRANT SELECT ON organization_meetings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON organization_meetings TO authenticated;
GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT INSERT ON notifications TO service_role;
