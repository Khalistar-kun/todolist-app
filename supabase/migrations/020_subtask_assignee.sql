-- Add assigned_to field to subtasks table for member assignments
-- This allows assigning team members to individual subtasks

ALTER TABLE subtasks
ADD COLUMN assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for faster lookups by assignee
CREATE INDEX idx_subtasks_assigned_to ON subtasks(assigned_to);

-- Add RLS policy for subtask assignments
-- Users can update subtask assignment if they can edit the parent task
CREATE POLICY "Users can update subtask assignment"
ON subtasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN project_members pm ON pm.project_id = t.project_id
    WHERE t.id = subtasks.task_id
    AND pm.user_id = auth.uid()
    AND pm.role IN ('owner', 'admin', 'member')
  )
);

-- Comment for documentation
COMMENT ON COLUMN subtasks.assigned_to IS 'The user ID assigned to complete this subtask';
