-- =============================================================
-- 15_leave_conflicts.sql
-- Leave-aware task conflict resolution with AI suggestions
-- Run after 14_employee_fields.sql
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Extend task status to include new granular statuses
-- ---------------------------------------------------------------

-- Drop constraint first, then rename rows, then re-add
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

UPDATE public.tasks SET status = 'working_on_it' WHERE status = 'in_progress';

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'todo', 'assigned', 'working_on_it', 'on_hold',
    'submitted', 'approved', 'done', 'blocked',
    'adjusted_before', 'adjusted_after'
  ));

-- Store original deadline before any adjustment
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS original_deadline timestamptz;

-- Why was this task adjusted / moved
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS adjustment_reason text;


-- ---------------------------------------------------------------
-- 2. Leave conflict tasks — one row per conflicting task per leave
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_conflict_tasks (
  id               bigserial PRIMARY KEY,
  leave_request_id bigint NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  task_id          bigint NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,

  -- AI output
  ai_suggestion    text CHECK (ai_suggestion IN ('before', 'after', 'reassign')),
  ai_reasoning     text,

  -- Manager resolution
  resolution       text NOT NULL DEFAULT 'pending'
                   CHECK (resolution IN ('pending', 'before', 'after', 'reassign')),
  resolved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at      timestamptz,

  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(leave_request_id, task_id)
);

CREATE INDEX IF NOT EXISTS leave_conflict_leave_idx
  ON public.leave_conflict_tasks(leave_request_id);

CREATE INDEX IF NOT EXISTS leave_conflict_pending_idx
  ON public.leave_conflict_tasks(resolution)
  WHERE resolution = 'pending';


-- ---------------------------------------------------------------
-- 3. Update pending_approvals view to use new statuses
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW public.pending_approvals AS
SELECT *
FROM public.task_pipeline_health
WHERE task_status = 'submitted'
ORDER BY internal_deadline ASC;