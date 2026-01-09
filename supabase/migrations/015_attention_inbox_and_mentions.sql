-- =====================================================
-- ATTENTION INBOX & @MENTIONS SYSTEM
-- Migration 015
-- =====================================================

-- -----------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------

-- Type of attention item
CREATE TYPE attention_type AS ENUM (
  'mention',           -- Someone @mentioned you
  'assignment',        -- Task assigned to you
  'due_soon',          -- Task due within 24 hours
  'overdue',           -- Task is past due date
  'comment',           -- New comment on your task
  'status_change',     -- Task status changed
  'unassignment'       -- Task unassigned from you
);

-- Priority for inbox sorting
CREATE TYPE attention_priority AS ENUM (
  'urgent',    -- Overdue, explicit mentions
  'high',      -- Due soon, new assignments
  'normal',    -- Comments, status changes
  'low'        -- FYI items
);

-- -----------------------------------------------------
-- 2. MENTIONS TABLE
-- -----------------------------------------------------

CREATE TABLE mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who was mentioned
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Who made the mention
  mentioner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Context of the mention
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- The actual mention text for context
  mention_context TEXT, -- e.g., "Hey @john can you review this?"

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT mention_has_context CHECK (
    task_id IS NOT NULL OR comment_id IS NOT NULL
  )
);

-- Indexes for mentions
CREATE INDEX idx_mentions_mentioned_user ON mentions(mentioned_user_id);
CREATE INDEX idx_mentions_mentioner ON mentions(mentioner_user_id);
CREATE INDEX idx_mentions_task ON mentions(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_mentions_comment ON mentions(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX idx_mentions_unread ON mentions(mentioned_user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_mentions_created ON mentions(created_at DESC);

-- -----------------------------------------------------
-- 3. ATTENTION ITEMS TABLE (Unified Inbox)
-- -----------------------------------------------------

CREATE TABLE attention_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who this attention item is for
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Classification
  attention_type attention_type NOT NULL,
  priority attention_priority NOT NULL DEFAULT 'normal',

  -- Source references (nullable based on type)
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  mention_id UUID REFERENCES mentions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Actor who caused this (nullable for system-generated items like due_soon)
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Display content
  title TEXT NOT NULL,
  body TEXT,

  -- State
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ, -- When user took action (clicked, responded, etc.)

  -- Deduplication key to prevent spam
  dedup_key TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Only one active item per dedup_key per user
  CONSTRAINT unique_active_attention UNIQUE NULLS NOT DISTINCT (user_id, dedup_key, dismissed_at)
);

-- Indexes for attention_items
CREATE INDEX idx_attention_user_active ON attention_items(user_id, created_at DESC)
  WHERE dismissed_at IS NULL;
CREATE INDEX idx_attention_user_unread ON attention_items(user_id, read_at)
  WHERE read_at IS NULL AND dismissed_at IS NULL;
CREATE INDEX idx_attention_priority ON attention_items(user_id, priority, created_at DESC)
  WHERE dismissed_at IS NULL;
CREATE INDEX idx_attention_type ON attention_items(user_id, attention_type)
  WHERE dismissed_at IS NULL;
CREATE INDEX idx_attention_task ON attention_items(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_attention_dedup ON attention_items(user_id, dedup_key) WHERE dismissed_at IS NULL;

-- -----------------------------------------------------
-- 4. HELPER FUNCTIONS
-- -----------------------------------------------------

-- Function to create attention item with deduplication
CREATE OR REPLACE FUNCTION create_attention_item(
  p_user_id UUID,
  p_attention_type attention_type,
  p_priority attention_priority,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_task_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_mention_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_dedup_key TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Don't create attention items for the actor themselves
  IF p_user_id = p_actor_user_id THEN
    RETURN NULL;
  END IF;

  -- Insert with conflict handling for dedup
  INSERT INTO attention_items (
    user_id, attention_type, priority, title, body,
    task_id, comment_id, mention_id, project_id,
    actor_user_id, dedup_key
  ) VALUES (
    p_user_id, p_attention_type, p_priority, p_title, p_body,
    p_task_id, p_comment_id, p_mention_id, p_project_id,
    p_actor_user_id, p_dedup_key
  )
  ON CONFLICT (user_id, dedup_key, dismissed_at)
  WHERE dismissed_at IS NULL
  DO UPDATE SET
    updated_at = NOW(),
    title = EXCLUDED.title,
    body = EXCLUDED.body
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to extract mentions from text
CREATE OR REPLACE FUNCTION extract_mentions(p_text TEXT)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT DISTINCT lower(matches[1])
    FROM regexp_matches(p_text, '@([a-zA-Z0-9_.-]+)', 'g') AS matches
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -----------------------------------------------------
-- 5. TRIGGERS FOR AUTOMATIC ATTENTION ITEMS
-- -----------------------------------------------------

-- Trigger: Task assignment creates attention item
CREATE OR REPLACE FUNCTION trigger_task_assignment_attention()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title TEXT;
  v_project_id UUID;
  v_actor_name TEXT;
BEGIN
  -- Only fire on assignment changes
  IF TG_OP = 'UPDATE' AND
     (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) AND
     NEW.assigned_to IS NOT NULL THEN

    SELECT title, project_id INTO v_task_title, v_project_id
    FROM tasks WHERE id = NEW.id;

    SELECT COALESCE(full_name, email) INTO v_actor_name
    FROM profiles WHERE id = auth.uid();

    PERFORM create_attention_item(
      NEW.assigned_to,
      'assignment',
      'high',
      'Task assigned: ' || v_task_title,
      COALESCE(v_actor_name, 'Someone') || ' assigned you to this task',
      NEW.id,
      NULL,
      NULL,
      v_project_id,
      auth.uid(),
      'assignment:' || NEW.id
    );
  END IF;

  -- Handle unassignment
  IF TG_OP = 'UPDATE' AND
     OLD.assigned_to IS NOT NULL AND
     NEW.assigned_to IS NULL THEN

    SELECT title, project_id INTO v_task_title, v_project_id
    FROM tasks WHERE id = NEW.id;

    PERFORM create_attention_item(
      OLD.assigned_to,
      'unassignment',
      'normal',
      'Task unassigned: ' || v_task_title,
      'You were unassigned from this task',
      NEW.id,
      NULL,
      NULL,
      v_project_id,
      auth.uid(),
      'unassignment:' || NEW.id || ':' || NOW()::DATE
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_assignment_attention_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_task_assignment_attention();

-- Trigger: Task status change creates attention item for assignee
CREATE OR REPLACE FUNCTION trigger_task_status_attention()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title TEXT;
  v_project_id UUID;
  v_actor_name TEXT;
BEGIN
  -- Only fire on status changes, notify the assignee (if different from actor)
  IF TG_OP = 'UPDATE' AND
     OLD.status IS DISTINCT FROM NEW.status AND
     NEW.assigned_to IS NOT NULL AND
     NEW.assigned_to != auth.uid() THEN

    SELECT title, project_id INTO v_task_title, v_project_id
    FROM tasks WHERE id = NEW.id;

    SELECT COALESCE(full_name, email) INTO v_actor_name
    FROM profiles WHERE id = auth.uid();

    PERFORM create_attention_item(
      NEW.assigned_to,
      'status_change',
      'normal',
      'Status changed: ' || v_task_title,
      COALESCE(v_actor_name, 'Someone') || ' changed status to ' || NEW.status,
      NEW.id,
      NULL,
      NULL,
      v_project_id,
      auth.uid(),
      'status:' || NEW.id || ':' || NEW.status
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_status_attention_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_task_status_attention();

-- Trigger: Comment creates attention item for task owner/assignee
CREATE OR REPLACE FUNCTION trigger_comment_attention()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title TEXT;
  v_task_assignee UUID;
  v_task_creator UUID;
  v_project_id UUID;
  v_actor_name TEXT;
BEGIN
  SELECT t.title, t.assigned_to, t.created_by, t.project_id
  INTO v_task_title, v_task_assignee, v_task_creator, v_project_id
  FROM tasks t WHERE t.id = NEW.task_id;

  SELECT COALESCE(full_name, email) INTO v_actor_name
  FROM profiles WHERE id = NEW.user_id;

  -- Notify assignee (if not the commenter)
  IF v_task_assignee IS NOT NULL AND v_task_assignee != NEW.user_id THEN
    PERFORM create_attention_item(
      v_task_assignee,
      'comment',
      'normal',
      'New comment on: ' || v_task_title,
      COALESCE(v_actor_name, 'Someone') || ': ' || LEFT(NEW.content, 100),
      NEW.task_id,
      NEW.id,
      NULL,
      v_project_id,
      NEW.user_id,
      'comment:' || NEW.task_id || ':' || DATE_TRUNC('hour', NOW())
    );
  END IF;

  -- Also notify task creator if different from assignee and commenter
  IF v_task_creator IS NOT NULL AND
     v_task_creator != NEW.user_id AND
     v_task_creator != COALESCE(v_task_assignee, '00000000-0000-0000-0000-000000000000'::UUID) THEN
    PERFORM create_attention_item(
      v_task_creator,
      'comment',
      'normal',
      'New comment on: ' || v_task_title,
      COALESCE(v_actor_name, 'Someone') || ': ' || LEFT(NEW.content, 100),
      NEW.task_id,
      NEW.id,
      NULL,
      v_project_id,
      NEW.user_id,
      'comment:' || NEW.task_id || ':creator:' || DATE_TRUNC('hour', NOW())
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER comment_attention_trigger
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_comment_attention();

-- -----------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- -----------------------------------------------------

ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attention_items ENABLE ROW LEVEL SECURITY;

-- Mentions: Users can see mentions where they are mentioned or the mentioner
CREATE POLICY mentions_select ON mentions
  FOR SELECT USING (
    mentioned_user_id = auth.uid() OR
    mentioner_user_id = auth.uid()
  );

-- Mentions: Users can create mentions (for others)
CREATE POLICY mentions_insert ON mentions
  FOR INSERT WITH CHECK (
    mentioner_user_id = auth.uid()
  );

-- Mentions: Users can update their own mentions (mark as read)
CREATE POLICY mentions_update ON mentions
  FOR UPDATE USING (
    mentioned_user_id = auth.uid()
  );

-- Attention items: Users can only see their own
CREATE POLICY attention_select ON attention_items
  FOR SELECT USING (user_id = auth.uid());

-- Attention items: System can insert (via security definer functions)
CREATE POLICY attention_insert ON attention_items
  FOR INSERT WITH CHECK (true);

-- Attention items: Users can update their own (mark read, dismiss)
CREATE POLICY attention_update ON attention_items
  FOR UPDATE USING (user_id = auth.uid());

-- Attention items: Users can delete their own
CREATE POLICY attention_delete ON attention_items
  FOR DELETE USING (user_id = auth.uid());

-- -----------------------------------------------------
-- 7. VIEWS FOR COMMON QUERIES
-- -----------------------------------------------------

-- Inbox view with all relevant data
CREATE OR REPLACE VIEW inbox_view AS
SELECT
  ai.id,
  ai.user_id,
  ai.attention_type,
  ai.priority,
  ai.title,
  ai.body,
  ai.read_at,
  ai.created_at,
  ai.updated_at,
  ai.task_id,
  ai.comment_id,
  ai.mention_id,
  ai.project_id,
  -- Task info
  t.title AS task_title,
  t.status AS task_status,
  -- Project info
  p.name AS project_name,
  -- Actor info
  actor.full_name AS actor_name,
  actor.avatar_url AS actor_avatar
FROM attention_items ai
LEFT JOIN tasks t ON ai.task_id = t.id
LEFT JOIN projects p ON ai.project_id = p.id
LEFT JOIN profiles actor ON ai.actor_user_id = actor.id
WHERE ai.dismissed_at IS NULL
ORDER BY
  CASE ai.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END,
  ai.created_at DESC;

-- -----------------------------------------------------
-- 8. UTILITY FUNCTIONS FOR API
-- -----------------------------------------------------

-- Mark item as read
CREATE OR REPLACE FUNCTION mark_attention_read(p_item_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE attention_items
  SET read_at = NOW(), updated_at = NOW()
  WHERE id = p_item_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark all as read
CREATE OR REPLACE FUNCTION mark_all_attention_read()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE attention_items
  SET read_at = NOW(), updated_at = NOW()
  WHERE user_id = auth.uid()
    AND read_at IS NULL
    AND dismissed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dismiss item
CREATE OR REPLACE FUNCTION dismiss_attention_item(p_item_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE attention_items
  SET dismissed_at = NOW(), updated_at = NOW()
  WHERE id = p_item_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread count
CREATE OR REPLACE FUNCTION get_unread_attention_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM attention_items
    WHERE user_id = auth.uid()
      AND read_at IS NULL
      AND dismissed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------
-- 9. GRANTS
-- -----------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON mentions TO authenticated;
GRANT SELECT, UPDATE, DELETE ON attention_items TO authenticated;
GRANT SELECT ON inbox_view TO authenticated;
GRANT EXECUTE ON FUNCTION mark_attention_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_attention_read() TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_attention_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_attention_count() TO authenticated;
