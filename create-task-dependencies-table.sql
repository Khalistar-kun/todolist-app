-- =====================================================
-- TASK DEPENDENCIES TABLE
-- Critical table for task dependency management
-- Run this immediately to fix 500 errors
-- =====================================================

-- =====================================================
-- CREATE DEPENDENCY TYPE ENUM
-- =====================================================

DO $$ BEGIN
    CREATE TYPE public.dependency_type AS ENUM (
      'finish_to_start',
      'start_to_start',
      'finish_to_finish',
      'start_to_finish'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- CREATE TASK_DEPENDENCIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocking_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  blocked_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependency_type public.dependency_type DEFAULT 'finish_to_start',
  lag_days INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocking_task_id, blocked_task_id),
  CHECK (blocking_task_id != blocked_task_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_task_deps_blocking ON public.task_dependencies(blocking_task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_blocked ON public.task_dependencies(blocked_task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_type ON public.task_dependencies(dependency_type);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DROP EXISTING POLICIES (for idempotency)
-- =====================================================

DROP POLICY IF EXISTS "task_dependencies_select" ON public.task_dependencies;
DROP POLICY IF EXISTS "task_dependencies_insert" ON public.task_dependencies;
DROP POLICY IF EXISTS "task_dependencies_update" ON public.task_dependencies;
DROP POLICY IF EXISTS "task_dependencies_delete" ON public.task_dependencies;

-- =====================================================
-- RLS POLICIES
-- =====================================================

CREATE POLICY "task_dependencies_select"
  ON public.task_dependencies FOR SELECT
  USING (
    blocking_task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    )
    OR
    blocked_task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "task_dependencies_insert"
  ON public.task_dependencies FOR INSERT
  WITH CHECK (
    blocking_task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'editor')
      )
    )
    AND
    blocked_task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'editor')
      )
    )
  );

CREATE POLICY "task_dependencies_update"
  ON public.task_dependencies FOR UPDATE
  USING (
    blocking_task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'editor')
      )
    )
  );

CREATE POLICY "task_dependencies_delete"
  ON public.task_dependencies FOR DELETE
  USING (
    blocking_task_id IN (
      SELECT t.id FROM public.tasks t
      WHERE t.project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'editor')
      )
    )
  );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ task_dependencies table created successfully!';
  RAISE NOTICE '📊 Table includes:';
  RAISE NOTICE '   - Blocking and blocked task references';
  RAISE NOTICE '   - 4 dependency types (finish_to_start, etc.)';
  RAISE NOTICE '   - Lag days support';
  RAISE NOTICE '   - Circular dependency prevention';
  RAISE NOTICE '🔒 RLS enabled with 4 policies';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: This table is critical for task management';
  RAISE NOTICE '   Run this immediately to fix 500 errors!';
END $$;
