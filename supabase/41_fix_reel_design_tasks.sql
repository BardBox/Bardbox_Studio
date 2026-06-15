-- Migration 41: Fix reels mistakenly created as DESIGN tasks
--
-- Reels (and any content_type whose task_type_config maps to 'video') are
-- video_editor work. Tasks created BEFORE the reel→video config existed fell
-- back to task_type='design' and got auto-assigned to graphic designers.
-- create_tasks_for_rows is idempotent, so it never relabels them.
--
-- This one-off migration:
--   1. Relabels those media tasks from 'design' → the correct video task type,
--      but only for content types that task_type_config says are video work,
--      and only for unfinished tasks (don't touch done/approved history).
--   2. Clears the (wrong) designer assignment + manual flag.
--   3. Re-runs auto_assign_with_daily_cap so they land on a video editor,
--      respecting the per-day cap and front-load placement.

-- ── 1 + 2. Relabel + unassign mislabeled media tasks ──────────────────────────
WITH mislabeled AS (
  SELECT t.id
  FROM public.tasks t
  JOIN public.content_rows cr ON cr.id = t.content_row_id
  JOIN public.task_type_config tc
    ON tc.content_type = lower(coalesce(cr.content_type, ''))
   AND tc.task_type = 'video'
  WHERE t.task_type = 'design'
    AND t.status NOT IN ('done', 'approved')
)
UPDATE public.tasks t
SET task_type         = 'video',
    assignee_id       = NULL,
    manually_assigned = false,
    updated_at        = now()
FROM mislabeled m
WHERE t.id = m.id;

-- ── 3. Re-assign every now-unassigned, unfinished video task ──────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.tasks
    WHERE task_type = 'video'
      AND assignee_id IS NULL
      AND status NOT IN ('done', 'approved')
  LOOP
    PERFORM public.auto_assign_with_daily_cap(r.id);
  END LOOP;
END $$;
