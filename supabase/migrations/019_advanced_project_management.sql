-- Advanced Project Management Features Migration
-- Adds: Enhanced task assignments with roles, task dependencies,
-- time tracking improvements, milestones, portfolios, recurring tasks

-- ============================================
-- 1. ENHANCED TASK ASSIGNMENTS WITH ROLES
-- ============================================

-- Add role column to existing task_assignments table
ALTER TABLE task_assignments
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'assignee'
CHECK (role IN ('owner', 'assignee', 'reviewer', 'collaborator'));

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_task_assignments_role ON task_assignments(role);

-- ============================================
-- 2. TASK DEPENDENCIES
-- ============================================

CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    blocking_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    blocked_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) DEFAULT 'finish_to_start'
        CHECK (dependency_type IN ('finish_to_start', 'start_to_start',
                                    'finish_to_finish', 'start_to_finish')),
    lag_days INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),

    UNIQUE(blocking_task_id, blocked_task_id),
    CHECK (blocking_task_id != blocked_task_id)
);

CREATE INDEX IF NOT EXISTS idx_dependencies_blocking ON task_dependencies(blocking_task_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_blocked ON task_dependencies(blocked_task_id);

-- Enable RLS
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_dependencies
CREATE POLICY "Users can view dependencies for their projects" ON task_dependencies
    FOR SELECT USING (
        blocking_task_id IN (
            SELECT id FROM tasks WHERE project_id IN (
                SELECT project_id FROM project_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Project editors can create dependencies" ON task_dependencies
    FOR INSERT WITH CHECK (
        blocking_task_id IN (
            SELECT id FROM tasks WHERE project_id IN (
                SELECT project_id FROM project_members
                WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
            )
        )
    );

CREATE POLICY "Project editors can delete dependencies" ON task_dependencies
    FOR DELETE USING (
        blocking_task_id IN (
            SELECT id FROM tasks WHERE project_id IN (
                SELECT project_id FROM project_members
                WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
            )
        )
    );

-- Function to check for circular dependencies
CREATE OR REPLACE FUNCTION check_circular_dependency()
RETURNS TRIGGER AS $$
DECLARE
    cycle_found BOOLEAN := FALSE;
    visited_ids UUID[];
    current_id UUID;
    queue UUID[];
BEGIN
    -- Start BFS from the blocked task to see if we can reach the blocking task
    queue := ARRAY[NEW.blocked_task_id];
    visited_ids := ARRAY[NEW.blocked_task_id];

    WHILE array_length(queue, 1) > 0 LOOP
        current_id := queue[1];
        queue := queue[2:];

        -- Check if we've reached the blocking task (cycle!)
        IF current_id = NEW.blocking_task_id THEN
            RAISE EXCEPTION 'Circular dependency detected: This would create a cycle in task dependencies';
        END IF;

        -- Add all tasks that current_id blocks to the queue
        FOR current_id IN
            SELECT blocked_task_id FROM task_dependencies
            WHERE blocking_task_id = current_id
        LOOP
            IF NOT current_id = ANY(visited_ids) THEN
                visited_ids := array_append(visited_ids, current_id);
                queue := array_append(queue, current_id);
            END IF;
        END LOOP;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_circular_dependencies
    BEFORE INSERT OR UPDATE ON task_dependencies
    FOR EACH ROW EXECUTE FUNCTION check_circular_dependency();

-- ============================================
-- 3. ENHANCED TIME TRACKING
-- ============================================

-- Add is_running column to track active timers
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS is_running BOOLEAN DEFAULT FALSE;

-- Make duration nullable for running timers
ALTER TABLE time_entries
ALTER COLUMN duration DROP NOT NULL;

-- Add index for finding running timers
CREATE INDEX IF NOT EXISTS idx_time_entries_running
ON time_entries(user_id) WHERE is_running = TRUE;

-- Function to ensure only one running timer per user
CREATE OR REPLACE FUNCTION ensure_single_running_timer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_running = TRUE THEN
        -- Stop any existing running timer for this user
        UPDATE time_entries
        SET is_running = FALSE,
            ended_at = NOW(),
            duration = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60
        WHERE user_id = NEW.user_id
          AND is_running = TRUE
          AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER single_running_timer
    BEFORE INSERT OR UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION ensure_single_running_timer();

-- ============================================
-- 4. TASK ENHANCEMENTS (start_date, parent_task, estimated_hours)
-- ============================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(6,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date) WHERE start_date IS NOT NULL;

-- Prevent deep nesting (max 2 levels)
CREATE OR REPLACE FUNCTION check_task_nesting_depth()
RETURNS TRIGGER AS $$
DECLARE
    parent_depth INTEGER := 0;
    current_parent UUID;
BEGIN
    IF NEW.parent_task_id IS NOT NULL THEN
        current_parent := NEW.parent_task_id;

        -- Count depth
        WHILE current_parent IS NOT NULL LOOP
            parent_depth := parent_depth + 1;
            IF parent_depth > 2 THEN
                RAISE EXCEPTION 'Maximum task nesting depth (2 levels) exceeded';
            END IF;

            SELECT parent_task_id INTO current_parent
            FROM tasks WHERE id = current_parent;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_task_depth
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION check_task_nesting_depth();

-- ============================================
-- 5. MILESTONES
-- ============================================

CREATE TABLE IF NOT EXISTS milestones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE NOT NULL,
    completed_at TIMESTAMPTZ,
    color VARCHAR(7) DEFAULT '#6366F1',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON milestones(target_date);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view milestones" ON milestones
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Project editors can manage milestones" ON milestones
    FOR ALL USING (
        project_id IN (
            SELECT project_id FROM project_members
            WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
        )
    );

-- Link tasks to milestones
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone_id) WHERE milestone_id IS NOT NULL;

-- ============================================
-- 6. PORTFOLIOS
-- ============================================

CREATE TABLE IF NOT EXISTS portfolios (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#8B5CF6',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_projects (
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (portfolio_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolios_org ON portfolios(organization_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_portfolio ON portfolio_projects(portfolio_id);

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view portfolios" ON portfolios
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins can manage portfolios" ON portfolios
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Portfolio viewers can see portfolio projects" ON portfolio_projects
    FOR SELECT USING (
        portfolio_id IN (
            SELECT id FROM portfolios WHERE organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

-- ============================================
-- 7. RECURRING TASKS
-- ============================================

CREATE TABLE IF NOT EXISTS task_recurrences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL
        CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom')),
    interval_value INTEGER DEFAULT 1,
    days_of_week INTEGER[] DEFAULT NULL,
    day_of_month INTEGER DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    max_occurrences INTEGER DEFAULT NULL,
    occurrences_created INTEGER DEFAULT 0,
    next_occurrence_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS idx_recurrences_next
ON task_recurrences(next_occurrence_date) WHERE is_active = TRUE;

ALTER TABLE task_recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recurrences for their tasks" ON task_recurrences
    FOR SELECT USING (
        task_id IN (
            SELECT id FROM tasks WHERE project_id IN (
                SELECT project_id FROM project_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Project editors can manage recurrences" ON task_recurrences
    FOR ALL USING (
        task_id IN (
            SELECT id FROM tasks WHERE project_id IN (
                SELECT project_id FROM project_members
                WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner')
            )
        )
    );

-- ============================================
-- 8. WORKFLOW STAGES ENHANCEMENTS (WIP Limits)
-- ============================================

-- Add WIP limit support to projects (stored in workflow_stages JSON)
-- Each stage can have: { id, name, color, wip_limit, wip_limit_type, is_done_stage }

-- Function to validate WIP limits when moving tasks
CREATE OR REPLACE FUNCTION check_wip_limit()
RETURNS TRIGGER AS $$
DECLARE
    stage_config JSONB;
    wip_limit INTEGER;
    wip_type TEXT;
    current_count INTEGER;
    project_workflow JSONB;
BEGIN
    -- Only check if stage_id changed
    IF OLD.stage_id = NEW.stage_id THEN
        RETURN NEW;
    END IF;

    -- Get project workflow stages
    SELECT workflow_stages INTO project_workflow
    FROM projects WHERE id = NEW.project_id;

    -- Find the target stage config
    SELECT elem INTO stage_config
    FROM jsonb_array_elements(project_workflow) AS elem
    WHERE elem->>'id' = NEW.stage_id;

    -- Check if WIP limit exists
    wip_limit := (stage_config->>'wip_limit')::INTEGER;
    wip_type := COALESCE(stage_config->>'wip_limit_type', 'warning');

    IF wip_limit IS NOT NULL AND wip_limit > 0 THEN
        -- Count current tasks in target stage (excluding subtasks)
        SELECT COUNT(*) INTO current_count
        FROM tasks
        WHERE project_id = NEW.project_id
          AND stage_id = NEW.stage_id
          AND parent_task_id IS NULL
          AND id != NEW.id;

        IF current_count >= wip_limit THEN
            IF wip_type = 'strict' THEN
                RAISE EXCEPTION 'WIP limit reached for this column (% tasks max)', wip_limit;
            END IF;
            -- For 'warning' type, we let it through but could log a warning
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_stage_wip_limit
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION check_wip_limit();

-- ============================================
-- 9. PROJECT DAILY SNAPSHOTS (for reporting)
-- ============================================

CREATE TABLE IF NOT EXISTS project_daily_snapshots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    tasks_by_stage JSONB NOT NULL DEFAULT '{}',
    tasks_by_priority JSONB NOT NULL DEFAULT '{}',
    overdue_tasks INTEGER NOT NULL DEFAULT 0,
    total_estimated_hours DECIMAL(10,2) DEFAULT 0,
    total_actual_hours DECIMAL(10,2) DEFAULT 0,

    UNIQUE(project_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_project_date
ON project_daily_snapshots(project_id, snapshot_date DESC);

ALTER TABLE project_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view snapshots" ON project_daily_snapshots
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

-- Function to create daily snapshot
CREATE OR REPLACE FUNCTION create_project_snapshot(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
    snapshot_exists BOOLEAN;
    today DATE := CURRENT_DATE;
BEGIN
    -- Check if snapshot already exists for today
    SELECT EXISTS(
        SELECT 1 FROM project_daily_snapshots
        WHERE project_id = p_project_id AND snapshot_date = today
    ) INTO snapshot_exists;

    IF snapshot_exists THEN
        -- Update existing snapshot
        UPDATE project_daily_snapshots
        SET
            total_tasks = (
                SELECT COUNT(*) FROM tasks
                WHERE project_id = p_project_id AND parent_task_id IS NULL
            ),
            completed_tasks = (
                SELECT COUNT(*) FROM tasks t
                JOIN projects p ON t.project_id = p.id
                WHERE t.project_id = p_project_id
                  AND t.parent_task_id IS NULL
                  AND t.approval_status = 'approved'
                  AND EXISTS (
                      SELECT 1 FROM jsonb_array_elements(p.workflow_stages) AS stage
                      WHERE stage->>'id' = t.stage_id
                        AND (stage->>'is_done_stage')::boolean = true
                  )
            ),
            tasks_by_stage = (
                SELECT jsonb_object_agg(stage_id, cnt)
                FROM (
                    SELECT stage_id, COUNT(*) as cnt
                    FROM tasks
                    WHERE project_id = p_project_id AND parent_task_id IS NULL
                    GROUP BY stage_id
                ) sub
            ),
            tasks_by_priority = (
                SELECT jsonb_object_agg(priority::text, cnt)
                FROM (
                    SELECT priority, COUNT(*) as cnt
                    FROM tasks
                    WHERE project_id = p_project_id AND parent_task_id IS NULL
                    GROUP BY priority
                ) sub
            ),
            overdue_tasks = (
                SELECT COUNT(*) FROM tasks
                WHERE project_id = p_project_id
                  AND parent_task_id IS NULL
                  AND due_date < NOW()
                  AND completed_at IS NULL
            ),
            total_estimated_hours = (
                SELECT COALESCE(SUM(estimated_hours), 0) FROM tasks
                WHERE project_id = p_project_id
            ),
            total_actual_hours = (
                SELECT COALESCE(SUM(duration), 0) / 60.0 FROM time_entries te
                JOIN tasks t ON te.task_id = t.id
                WHERE t.project_id = p_project_id
            )
        WHERE project_id = p_project_id AND snapshot_date = today;
    ELSE
        -- Insert new snapshot
        INSERT INTO project_daily_snapshots (
            project_id, snapshot_date, total_tasks, completed_tasks,
            tasks_by_stage, tasks_by_priority, overdue_tasks,
            total_estimated_hours, total_actual_hours
        )
        SELECT
            p_project_id,
            today,
            (SELECT COUNT(*) FROM tasks WHERE project_id = p_project_id AND parent_task_id IS NULL),
            (SELECT COUNT(*) FROM tasks t
             JOIN projects p ON t.project_id = p.id
             WHERE t.project_id = p_project_id
               AND t.parent_task_id IS NULL
               AND t.approval_status = 'approved'
               AND EXISTS (
                   SELECT 1 FROM jsonb_array_elements(p.workflow_stages) AS stage
                   WHERE stage->>'id' = t.stage_id
                     AND (stage->>'is_done_stage')::boolean = true
               )),
            COALESCE((SELECT jsonb_object_agg(stage_id, cnt)
             FROM (SELECT stage_id, COUNT(*) as cnt FROM tasks
                   WHERE project_id = p_project_id AND parent_task_id IS NULL
                   GROUP BY stage_id) sub), '{}'),
            COALESCE((SELECT jsonb_object_agg(priority::text, cnt)
             FROM (SELECT priority, COUNT(*) as cnt FROM tasks
                   WHERE project_id = p_project_id AND parent_task_id IS NULL
                   GROUP BY priority) sub), '{}'),
            (SELECT COUNT(*) FROM tasks
             WHERE project_id = p_project_id AND parent_task_id IS NULL
               AND due_date < NOW() AND completed_at IS NULL),
            (SELECT COALESCE(SUM(estimated_hours), 0) FROM tasks WHERE project_id = p_project_id),
            (SELECT COALESCE(SUM(duration), 0) / 60.0 FROM time_entries te
             JOIN tasks t ON te.task_id = t.id WHERE t.project_id = p_project_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. ENABLE REALTIME FOR NEW TABLES
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE task_dependencies;
ALTER PUBLICATION supabase_realtime ADD TABLE milestones;
ALTER PUBLICATION supabase_realtime ADD TABLE portfolios;
ALTER PUBLICATION supabase_realtime ADD TABLE task_recurrences;

-- ============================================
-- 11. HELPER FUNCTIONS
-- ============================================

-- Get all tasks blocking a specific task
CREATE OR REPLACE FUNCTION get_blocking_tasks(p_task_id UUID)
RETURNS TABLE (
    task_id UUID,
    title TEXT,
    stage_id TEXT,
    is_completed BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.title, t.stage_id,
           (t.approval_status = 'approved' AND EXISTS (
               SELECT 1 FROM projects p, jsonb_array_elements(p.workflow_stages) AS stage
               WHERE p.id = t.project_id
                 AND stage->>'id' = t.stage_id
                 AND (stage->>'is_done_stage')::boolean = true
           )) as is_completed
    FROM tasks t
    JOIN task_dependencies td ON t.id = td.blocking_task_id
    WHERE td.blocked_task_id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- Get all tasks blocked by a specific task
CREATE OR REPLACE FUNCTION get_blocked_tasks(p_task_id UUID)
RETURNS TABLE (
    task_id UUID,
    title TEXT,
    stage_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.title, t.stage_id
    FROM tasks t
    JOIN task_dependencies td ON t.id = td.blocked_task_id
    WHERE td.blocking_task_id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- Check if a task is blocked
CREATE OR REPLACE FUNCTION is_task_blocked(p_task_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_incomplete_blocker BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM task_dependencies td
        JOIN tasks t ON td.blocking_task_id = t.id
        JOIN projects p ON t.project_id = p.id
        WHERE td.blocked_task_id = p_task_id
          AND NOT (
              t.approval_status = 'approved'
              AND EXISTS (
                  SELECT 1 FROM jsonb_array_elements(p.workflow_stages) AS stage
                  WHERE stage->>'id' = t.stage_id
                    AND (stage->>'is_done_stage')::boolean = true
              )
          )
    ) INTO has_incomplete_blocker;

    RETURN has_incomplete_blocker;
END;
$$ LANGUAGE plpgsql;

-- Get task count summary for a project (excluding subtasks for main counts)
CREATE OR REPLACE FUNCTION get_project_task_counts(p_project_id UUID)
RETURNS TABLE (
    total_tasks BIGINT,
    completed_tasks BIGINT,
    pending_approval BIGINT,
    overdue_tasks BIGINT,
    blocked_tasks BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH project_info AS (
        SELECT workflow_stages FROM projects WHERE id = p_project_id
    ),
    done_stage_ids AS (
        SELECT stage->>'id' as stage_id
        FROM project_info, jsonb_array_elements(workflow_stages) AS stage
        WHERE (stage->>'is_done_stage')::boolean = true
           OR stage->>'id' = 'done'
           OR LOWER(stage->>'name') = 'done'
    )
    SELECT
        COUNT(*) FILTER (WHERE parent_task_id IS NULL) as total_tasks,
        COUNT(*) FILTER (
            WHERE parent_task_id IS NULL
            AND stage_id IN (SELECT stage_id FROM done_stage_ids)
            AND approval_status = 'approved'
        ) as completed_tasks,
        COUNT(*) FILTER (
            WHERE parent_task_id IS NULL
            AND stage_id IN (SELECT stage_id FROM done_stage_ids)
            AND approval_status = 'pending'
        ) as pending_approval,
        COUNT(*) FILTER (
            WHERE parent_task_id IS NULL
            AND due_date < NOW()
            AND completed_at IS NULL
        ) as overdue_tasks,
        COUNT(*) FILTER (
            WHERE parent_task_id IS NULL
            AND is_task_blocked(id) = true
        ) as blocked_tasks
    FROM tasks
    WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate actual hours for a task from time entries
CREATE OR REPLACE FUNCTION get_task_actual_hours(p_task_id UUID)
RETURNS DECIMAL(10,2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(
            CASE
                WHEN is_running THEN EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600
                ELSE COALESCE(duration, 0) / 60.0
            END
        ) FROM time_entries WHERE task_id = p_task_id),
        0
    );
END;
$$ LANGUAGE plpgsql;
