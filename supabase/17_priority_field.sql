-- =============================================================
-- 17_priority_field.sql
-- Adds a priority column (low / medium / high) to content_rows
-- and tasks. Rebuilds the create_tasks trigger to copy priority
-- from the content_row into both child tasks.
-- Also refreshes task_pipeline_health to expose priority.
-- =============================================================

-- ── 1. Add priority to content_rows ─────────────────────────
ALTER TABLE public.content_rows
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('low', 'medium', 'high'));

-- ── 2. Add priority to tasks ─────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('low', 'medium', 'high'));

-- ── 3. Rebuild trigger to copy priority from content_row ─────
CREATE OR REPLACE FUNCTION public.create_tasks_for_content_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_design_buffer int;
  v_review_buffer int;
  v_posting_at    timestamptz;
  v_design_due    timestamptz;
  v_post_due      timestamptz;
  v_design_id     bigint;
  v_post_id       bigint;
BEGIN
  SELECT bc.design_buffer_days, bc.review_buffer_days
    INTO v_design_buffer, v_review_buffer
  FROM public.buffer_config bc
  WHERE lower(bc.platform)      = lower(new.platform)
    AND lower(bc.content_type)  = lower(new.content_type)
  LIMIT 1;

  v_design_buffer := coalesce(v_design_buffer, 3);
  v_review_buffer := coalesce(v_review_buffer, 1);

  v_posting_at := (new.posting_date + coalesce(new.posting_time, '10:00:00'::time))
                  AT TIME ZONE 'Asia/Kolkata';
  v_design_due := v_posting_at - ((v_design_buffer + v_review_buffer) || ' days')::interval;
  v_post_due   := v_posting_at;

  INSERT INTO public.tasks (content_row_id, task_type, internal_deadline, priority)
  VALUES (new.id, 'design', v_design_due, new.priority)
  RETURNING id INTO v_design_id;

  PERFORM public.auto_assign_task(v_design_id);

  INSERT INTO public.tasks (content_row_id, task_type, internal_deadline, priority)
  VALUES (new.id, 'post', v_post_due, new.priority)
  RETURNING id INTO v_post_id;

  PERFORM public.auto_assign_task(v_post_id);

  INSERT INTO public.activity_log (content_row_id, action, details)
  VALUES (new.id, 'tasks_created',
          jsonb_build_object('design_task_id', v_design_id, 'post_task_id', v_post_id));

  RETURN new;
END;
$$;

-- ── 4. Rebuild task_pipeline_health to include priority ──────
CREATE OR REPLACE VIEW public.task_pipeline_health AS
SELECT
  t.id                    AS task_id,
  t.task_type,
  t.status                AS task_status,
  t.priority,
  t.internal_deadline,
  t.assignee_id,
  t.manually_assigned,
  t.completed_at,
  t.design_url,
  t.rejection_notes,
  cr.id                   AS content_row_id,
  cr.client_name,
  cr.platform,
  cr.content_type,
  cr.brief,
  cr.caption,
  cr.posting_date,
  cr.posting_time,
  cr.status               AS row_status,
  p.full_name             AS assignee_name,
  p.role                  AS assignee_role,
  round(extract(epoch FROM (t.internal_deadline - now())) / 3600.0, 1) AS hours_until_deadline,
  CASE
    WHEN t.status IN ('done','approved') THEN 'completed'
    WHEN t.internal_deadline < now()     THEN 'overdue'
    WHEN (t.internal_deadline - now()) < INTERVAL '48 hours' THEN 'critical'
    WHEN (t.internal_deadline - now()) < INTERVAL '7 days'   THEN 'approaching'
    ELSE 'comfortable'
  END AS pressure_level
FROM public.tasks t
JOIN public.content_rows cr ON cr.id = t.content_row_id
LEFT JOIN public.profiles p  ON p.id  = t.assignee_id;
