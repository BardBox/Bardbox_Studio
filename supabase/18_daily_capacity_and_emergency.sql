-- =============================================================
-- 18_daily_capacity_and_emergency.sql
-- Run AFTER 17_priority_field.sql (all DDL uses IF NOT EXISTS
-- so it is safe to run standalone too).
--
-- Adds:
--   • daily_capacity (int) on profiles
--   • is_emergency, original_deadline, rescheduled_reason on tasks
--   • is_emergency on content_rows
--   • 'emergency' value added to priority CHECK on both tables
--   • find_available_slot()            – finds first day under cap
--   • auto_assign_with_daily_cap()     – day-load-aware auto-assign
--   • insert_emergency_task()          – marks emergency + cascades pushes
--   • Rebuilds create_tasks_for_content_row trigger
--   • Rebuilds create_tasks_for_rows RPC
--   • Rebuilds task_pipeline_health view
-- =============================================================


-- ── 1. Profiles: per-user daily capacity ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_capacity int DEFAULT 3;


-- ── 2. Priority columns (idempotent — migration 17 may have run) ──
ALTER TABLE public.content_rows
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

-- Extend CHECK to include 'emergency'
ALTER TABLE public.content_rows DROP CONSTRAINT IF EXISTS content_rows_priority_check;
ALTER TABLE public.content_rows
  ADD CONSTRAINT content_rows_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'emergency'));

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'emergency'));


-- ── 3. Tasks: emergency flag + reschedule audit ───────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_emergency boolean NOT NULL DEFAULT false;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS original_deadline timestamptz;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS rescheduled_reason text;


-- ── 4. Content rows: emergency flag ──────────────────────────
ALTER TABLE public.content_rows
  ADD COLUMN IF NOT EXISTS is_emergency boolean NOT NULL DEFAULT false;


-- ── 5. Index: assignee × deadline (used by scheduler) ────────
-- Plain index on timestamptz — cannot use (::date) expression as
-- timestamptz→date is STABLE not IMMUTABLE in PostgreSQL.
CREATE INDEX IF NOT EXISTS tasks_assignee_deadline_idx
  ON public.tasks (assignee_id, internal_deadline)
  WHERE status NOT IN ('done', 'approved');


-- ── 6. find_available_slot ────────────────────────────────────
-- Returns earliest date >= p_desired_date where p_assignee_id has
-- fewer scheduled tasks than their daily_capacity.
-- p_exclude_task_id: skip this task when counting (for edits).
CREATE OR REPLACE FUNCTION public.find_available_slot(
  p_assignee_id     uuid,
  p_desired_date    date,
  p_exclude_task_id bigint DEFAULT null
)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity   int;
  v_check_date date := p_desired_date;
  v_count      int;
BEGIN
  SELECT coalesce(daily_capacity, 3)
    INTO v_capacity
  FROM public.profiles
  WHERE id = p_assignee_id;

  FOR i IN 0..29 LOOP
    SELECT count(*) INTO v_count
    FROM public.tasks t
    WHERE t.assignee_id = p_assignee_id
      AND t.internal_deadline::date = v_check_date
      AND t.status NOT IN ('done', 'approved')
      AND (p_exclude_task_id IS NULL OR t.id != p_exclude_task_id);

    IF v_count < v_capacity THEN
      RETURN v_check_date;
    END IF;

    v_check_date := v_check_date + 1;
  END LOOP;

  RETURN v_check_date; -- fallback: 30th day ahead
END;
$$;


-- ── 7. auto_assign_with_daily_cap ─────────────────────────────
-- Like auto_assign_task but picks the person with the lowest load
-- on the task's specific deadline DAY (not total open tasks).
-- Falls back to least-total if everyone is at daily cap.
CREATE OR REPLACE FUNCTION public.auto_assign_with_daily_cap(p_task_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_type    text;
  v_is_manual    boolean;
  v_target_role  text;
  v_deadline_date date;
  v_assignee     uuid;
BEGIN
  SELECT task_type, manually_assigned, internal_deadline::date
    INTO v_task_type, v_is_manual, v_deadline_date
  FROM public.tasks
  WHERE id = p_task_id;

  IF v_is_manual THEN RETURN null; END IF;

  v_target_role := CASE WHEN v_task_type = 'design' THEN 'designer' ELSE 'smo' END;

  -- Primary: least tasks on this specific day, under daily cap
  SELECT p.id INTO v_assignee
  FROM public.profiles p
  LEFT JOIN public.tasks t
    ON  t.assignee_id = p.id
    AND t.internal_deadline::date = v_deadline_date
    AND t.status NOT IN ('done', 'approved')
    AND t.id != p_task_id
  WHERE p.role = v_target_role
    AND p.is_active = true
  GROUP BY p.id, p.daily_capacity
  HAVING count(t.id) < coalesce(p.daily_capacity, 3)
  ORDER BY count(t.id) ASC, random()
  LIMIT 1;

  IF v_assignee IS NULL THEN
    -- Fallback: least total open tasks (same as original auto_assign_task)
    SELECT p.id INTO v_assignee
    FROM public.profiles p
    LEFT JOIN public.tasks t
      ON  t.assignee_id = p.id
      AND t.status NOT IN ('done', 'approved')
    WHERE p.role = v_target_role
      AND p.is_active = true
    GROUP BY p.id
    ORDER BY count(t.id) ASC, random()
    LIMIT 1;
  END IF;

  UPDATE public.tasks
    SET assignee_id = v_assignee,
        updated_at  = now()
  WHERE id = p_task_id;

  INSERT INTO public.activity_log (task_id, actor_id, action, details)
  VALUES (p_task_id, null, 'auto_assigned',
          jsonb_build_object('assignee_id', v_assignee, 'method', 'daily_cap'));

  RETURN v_assignee;
END;
$$;


-- ── 8. Rebuild create_tasks_for_content_row trigger ───────────
-- Now passes priority + is_emergency into tasks,
-- and calls auto_assign_with_daily_cap instead of auto_assign_task.
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
  IF NOT coalesce(new.auto_create_tasks, true) THEN
    RETURN new;
  END IF;

  SELECT bc.design_buffer_days, bc.review_buffer_days
    INTO v_design_buffer, v_review_buffer
  FROM public.buffer_config bc
  WHERE lower(bc.platform)     = lower(new.platform)
    AND lower(bc.content_type) = lower(new.content_type)
  LIMIT 1;

  v_design_buffer := coalesce(v_design_buffer, 3);
  v_review_buffer := coalesce(v_review_buffer, 1);

  v_posting_at := (new.posting_date + coalesce(new.posting_time, '10:00:00'::time))
                  AT TIME ZONE 'Asia/Kolkata';
  v_design_due := v_posting_at - ((v_design_buffer + v_review_buffer) || ' days')::interval;
  v_post_due   := v_posting_at;

  INSERT INTO public.tasks (content_row_id, task_type, internal_deadline, priority, is_emergency)
  VALUES (new.id, 'design', v_design_due,
          coalesce(new.priority, 'medium'),
          coalesce(new.is_emergency, false))
  RETURNING id INTO v_design_id;

  PERFORM public.auto_assign_with_daily_cap(v_design_id);

  INSERT INTO public.tasks (content_row_id, task_type, internal_deadline, priority, is_emergency)
  VALUES (new.id, 'post', v_post_due,
          coalesce(new.priority, 'medium'),
          coalesce(new.is_emergency, false))
  RETURNING id INTO v_post_id;

  PERFORM public.auto_assign_with_daily_cap(v_post_id);

  INSERT INTO public.activity_log (content_row_id, action, details)
  VALUES (new.id, 'tasks_created',
          jsonb_build_object('design_task_id', v_design_id, 'post_task_id', v_post_id));

  RETURN new;
END;
$$;


-- ── 9. Rebuild create_tasks_for_rows RPC ──────────────────────
-- Idempotent bulk task creation (called from /api/content/create-tasks).
-- Now uses auto_assign_with_daily_cap and passes priority/is_emergency.
CREATE OR REPLACE FUNCTION public.create_tasks_for_rows(p_ids bigint[])
RETURNS TABLE(content_row_id bigint, design_task_id bigint, post_task_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row            record;
  v_design_buffer  int;
  v_review_buffer  int;
  v_posting_at     timestamptz;
  v_design_due     timestamptz;
  v_post_due       timestamptz;
  v_design_id      bigint;
  v_post_id        bigint;
BEGIN
  FOR v_row IN
    SELECT cr.id, cr.platform, cr.content_type, cr.posting_date,
           cr.posting_time,
           coalesce(cr.priority, 'medium')     AS priority,
           coalesce(cr.is_emergency, false)     AS is_emergency
    FROM public.content_rows cr
    WHERE cr.id = ANY(p_ids)
  LOOP
    -- Idempotent: skip rows that already have tasks
    IF EXISTS (
      SELECT 1 FROM public.tasks WHERE content_row_id = v_row.id
    ) THEN
      CONTINUE;
    END IF;

    SELECT bc.design_buffer_days, bc.review_buffer_days
      INTO v_design_buffer, v_review_buffer
    FROM public.buffer_config bc
    WHERE lower(bc.platform)     = lower(v_row.platform)
      AND lower(bc.content_type) = lower(v_row.content_type)
    LIMIT 1;

    v_design_buffer := coalesce(v_design_buffer, 3);
    v_review_buffer := coalesce(v_review_buffer, 1);

    v_posting_at := (v_row.posting_date + coalesce(v_row.posting_time, '10:00:00'::time))
                    AT TIME ZONE 'Asia/Kolkata';
    v_design_due := v_posting_at - ((v_design_buffer + v_review_buffer) || ' days')::interval;
    v_post_due   := v_posting_at;

    INSERT INTO public.tasks (content_row_id, task_type, internal_deadline, priority, is_emergency)
    VALUES (v_row.id, 'design', v_design_due, v_row.priority, v_row.is_emergency)
    RETURNING id INTO v_design_id;

    PERFORM public.auto_assign_with_daily_cap(v_design_id);

    INSERT INTO public.tasks (content_row_id, task_type, internal_deadline, priority, is_emergency)
    VALUES (v_row.id, 'post', v_post_due, v_row.priority, v_row.is_emergency)
    RETURNING id INTO v_post_id;

    PERFORM public.auto_assign_with_daily_cap(v_post_id);

    INSERT INTO public.activity_log (content_row_id, action, details)
    VALUES (v_row.id, 'tasks_created',
            jsonb_build_object('design_task_id', v_design_id, 'post_task_id', v_post_id));

    RETURN QUERY SELECT v_row.id, v_design_id, v_post_id;
  END LOOP;
END;
$$;


-- ── 10. insert_emergency_task ─────────────────────────────────
-- Marks a content row + its tasks as emergency (priority = 'emergency',
-- is_emergency = true). If the assignee's day is over capacity,
-- displaces the lowest-priority non-emergency task on that day to the
-- next available slot (cascading via find_available_slot).
-- Every displacement is logged in activity_log with original_deadline
-- preserved for audit.
CREATE OR REPLACE FUNCTION public.insert_emergency_task(p_content_row_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task          record;
  v_assignee      uuid;
  v_deadline_date date;
  v_capacity      int;
  v_day_count     int;
  v_bump_task     record;
  v_new_date      date;
  v_days_shift    int;
BEGIN
  -- Mark content row as emergency
  UPDATE public.content_rows
    SET is_emergency = true,
        priority     = 'emergency',
        updated_at   = now()
  WHERE id = p_content_row_id;

  FOR v_task IN
    SELECT id, assignee_id, internal_deadline
    FROM public.tasks
    WHERE content_row_id = p_content_row_id
  LOOP
    -- Mark the emergency task itself
    UPDATE public.tasks
      SET is_emergency = true,
          priority     = 'emergency',
          updated_at   = now()
    WHERE id = v_task.id;

    v_assignee := v_task.assignee_id;
    IF v_assignee IS NULL THEN CONTINUE; END IF;

    v_deadline_date := v_task.internal_deadline::date;

    SELECT coalesce(daily_capacity, 3) INTO v_capacity
    FROM public.profiles WHERE id = v_assignee;

    -- Count tasks the assignee has on that day (including this emergency task)
    SELECT count(*) INTO v_day_count
    FROM public.tasks t
    WHERE t.assignee_id = v_assignee
      AND t.internal_deadline::date = v_deadline_date
      AND t.status NOT IN ('done', 'approved');

    IF v_day_count <= v_capacity THEN
      CONTINUE; -- fits, no displacement needed
    END IF;

    -- Displace the lowest-priority non-emergency task on that day
    SELECT t.id, t.internal_deadline INTO v_bump_task
    FROM public.tasks t
    WHERE t.assignee_id = v_assignee
      AND t.internal_deadline::date = v_deadline_date
      AND t.status NOT IN ('done', 'approved')
      AND t.is_emergency = false
      AND t.id != v_task.id
    ORDER BY
      CASE t.priority
        WHEN 'low'    THEN 1
        WHEN 'medium' THEN 2
        WHEN 'high'   THEN 3
        ELSE 2
      END ASC,
      t.internal_deadline ASC
    LIMIT 1;

    IF v_bump_task.id IS NULL THEN CONTINUE; END IF;

    v_new_date   := public.find_available_slot(v_assignee, v_deadline_date + 1, v_bump_task.id);
    v_days_shift := v_new_date - v_deadline_date;

    UPDATE public.tasks
      SET internal_deadline  = internal_deadline + (v_days_shift || ' days')::interval,
          original_deadline  = coalesce(original_deadline, v_bump_task.internal_deadline),
          rescheduled_reason = 'displaced by emergency on content_row ' || p_content_row_id::text,
          updated_at         = now()
    WHERE id = v_bump_task.id;

    INSERT INTO public.activity_log (task_id, action, details)
    VALUES (v_bump_task.id, 'rescheduled',
            jsonb_build_object(
              'reason',           'emergency_displacement',
              'original_date',    v_deadline_date,
              'new_date',         v_new_date,
              'days_pushed',      v_days_shift,
              'emergency_row_id', p_content_row_id
            ));
  END LOOP;
END;
$$;


-- ── 11. Rebuild task_pipeline_health view ─────────────────────
DROP VIEW IF EXISTS public.task_pipeline_health CASCADE;

CREATE VIEW public.task_pipeline_health AS
SELECT
  t.id                    AS task_id,
  t.task_type,
  t.status                AS task_status,
  t.priority,
  t.is_emergency,
  t.original_deadline,
  t.rescheduled_reason,
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
  cr.is_emergency         AS row_is_emergency,
  p.full_name             AS assignee_name,
  p.role                  AS assignee_role,
  p.daily_capacity,
  round(extract(epoch FROM (t.internal_deadline - now())) / 3600.0, 1) AS hours_until_deadline,
  CASE
    WHEN t.status IN ('done', 'approved')                        THEN 'completed'
    WHEN t.internal_deadline < now()                             THEN 'overdue'
    WHEN t.is_emergency AND t.status NOT IN ('done', 'approved') THEN 'critical'
    WHEN (t.internal_deadline - now()) < INTERVAL '48 hours'     THEN 'critical'
    WHEN (t.internal_deadline - now()) < INTERVAL '7 days'       THEN 'approaching'
    ELSE 'comfortable'
  END AS pressure_level
FROM public.tasks t
JOIN  public.content_rows cr ON cr.id = t.content_row_id
LEFT JOIN public.profiles p   ON p.id  = t.assignee_id;
