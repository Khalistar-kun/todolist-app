-- Project Invitations table for inviting users who may or may not have accounts yet
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('viewer', 'member', 'admin')),
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(project_id, email)
);

-- Index for looking up invitations by email (for when user logs in)
CREATE INDEX idx_project_invitations_email ON project_invitations(email) WHERE status = 'pending';

-- Index for looking up by token (for accepting via link)
CREATE INDEX idx_project_invitations_token ON project_invitations(token) WHERE status = 'pending';

-- RLS policies
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

-- Project admins/owners can view invitations for their projects
CREATE POLICY "Project admins can view invitations" ON project_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_invitations.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('admin', 'owner')
    )
  );

-- Project admins/owners can create invitations
CREATE POLICY "Project admins can create invitations" ON project_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_invitations.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('admin', 'owner')
    )
  );

-- Project admins/owners can update invitations (e.g., cancel)
CREATE POLICY "Project admins can update invitations" ON project_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_invitations.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('admin', 'owner')
    )
  );

-- Project admins/owners can delete invitations
CREATE POLICY "Project admins can delete invitations" ON project_invitations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_invitations.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('admin', 'owner')
    )
  );

-- Users can view their own invitations (by email match with their profile)
CREATE POLICY "Users can view their own invitations" ON project_invitations
  FOR SELECT
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- Users can update their own invitations (accept/decline)
CREATE POLICY "Users can update their own invitations" ON project_invitations
  FOR UPDATE
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );
