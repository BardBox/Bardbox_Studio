-- =============================================================
-- 38_video_task_type.sql
-- Adds 'video' task type and makes ALL task-type→role routing
-- DB-driven via the new task_types table.
--
-- After this migration, adding a new task type never requires
-- a code change — only a row in task_types + rows in task_type_config.
--
-- Content routing:
--   reel / video / youtube  →  'video' task  (video_editor)
--   everything else         →  'design' task (designer)
--   always                  →  'post'   task (smo)
-- =============================================================


-- ── 0. Ensure video_editor is allowed in profiles.role ───────
-- Safe no-op if migration 36 already ran.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('designer','video_editor','smo','manager','admin','ceo','hr','developer'));


-- ── 1. task_types CRUD table ──────────────────────────────────
-- key        = the task_type string stored in tasks.task_type
-- target_role = which role handles tasks of this type
-- sort_order  = display order

CREATE TABLE IF NOT EXISTS public.task_types (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  target_role text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0
);

INSERT INTO public.task_types (key, label, target_role, sort_order) VALUES
  ('design', 'Design',      'designer',     10),
  ('video',  'Video Edit',  'video_editor', 20),
  ('post',   'Post / SMO',  'smo',          30)
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label,
      target_role = EXCLUDED.target_role;

ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "managers_manage_task_types" ON public.task_types;
CREATE POLICY "managers_manage_task_types"
  ON public.task_types FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid())
    IN ('admin', 'manager', 'ceo')
  );

DROP POLICY IF EXISTS "authenticated_read_task_types" ON public.task_types;
CREATE POLICY "authenticated_read_task_types"
  ON public.task_types FOR SELECT TO authenticated
  USING (true);


-- ── 2. Widen task_type CHECK constraints ──────────────────────

-- tasks
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type IN ('design', 'video', 'post'));

-- user_content_capacity
ALTER TABLE public.user_content_capacity
  DROP CONSTRAINT IF EXISTS user_content_capacity_task_type_check;
ALTER TABLE public.user_content_capacity
  ADD CONSTRAINT user_content_capacity_task_type_check
  CHECK (task_type IN ('design', 'video', 'post'));

-- task_type_config (inline CHECK from migration 34 — drop and replace)
ALTER TABLE public.task_type_config
  DROP CONSTRAINT IF EXISTS task_type_config_task_type_check;
ALTER TABLE public.task_type_config
  ADD CONSTRAINT task_type_config_task_type_check
  CHECK (task_type IN ('design', 'video', 'post'));


-- ── 3. Update task_type_config: video content → video task ───
-- reel / video / youtube are now video_editor tasks, not design tasks.

DELETE FROM public.task_type_config
  WHERE content_type IN ('reel', 'video', 'youtube') AND task_type = 'design';

INSERT INTO public.task_type_config
  (content_type, task_type, duration_hours, requires_posting, label)
VALUES
  ('reel',    'video', 3.00, true, 'Reel Edit'),
  ('video',   'video', 4.00, true, 'Video Edit'),
  ('youtube', 'video', 6.00, true, 'YouTube Edit')
ON CONFLICT (content_type, task_type) DO NOTHING;


-- ── 4. Role flags ─────────────────────────────────────────────
-- Add all flag columns (safe if migration 37 already ran)

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS is_designer_type  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_privileged     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_redistribute  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_video_type     boolean NOT NULL DEFAULT false;

-- Seed values for existing roles (idempotent)
UPDATE public.roles SET is_designer_type = true  WHERE key IN ('designer');
UPDATE public.roles SET is_privileged    = true  WHERE key IN ('admin', 'manager', 'smo', 'ceo');
UPDATE public.roles SET can_redistribute = true  WHERE key IN ('admin', 'manager', 'ceo');
UPDATE public.roles SET is_video_type    = true  WHERE key = 'video_editor';
UPDATE public.roles SET is_designer_type = false WHERE key = 'video_editor';


-- ── 5. required_specialty — obsolete, now returns NULL always ──
-- Kept so older compiled functions don't error; logic is in task_types.

CREATE OR REPLACE FUNCTION public.required_specialty(p_content_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT NULL::text; $$;


-- ── 6. get_daily_cap — look up task_type from task_types table ─

CREATE OR REPLACE FUNCTION public.get_daily_cap(
  p_user_id      uuid,
  p_content_type text DEFAULT null
)
RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role         text;
  v_task_type    text;
  v_shift_hours  numeric;
  v_hours        numeric;
  v_legacy_cap   int;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;

  -- DB-driven: which task_type does this role handle?
  SELECT key INTO v_task_type FROM public.task_types WHERE target_role = v_role LIMIT 1;
  -- Fallback for roles not in task_types (manager, admin, etc.)
  v_task_type   := COALESCE(v_task_type, 'design');
  v_shift_hours := 8.0;

  IF p_content_type IS NOT NULL AND p_content_type <> '' THEN
    SELECT duration_hours INTO v_hours
    FROM public.task_type_config
    WHERE content_type = lower(p_content_type)
      AND task_type    = v_task_type;
  END IF;

  IF v_hours IS NOT NULL THEN
    RETURN GREATEST(1, floor(v_shift_hours / v_hours)::int);
  END IF;

  -- Fallback: legacy user_content_capacity table
  IF p_content_type IS NOT NULL AND p_content_type <> '' THEN
    SELECT daily_cap INTO v_legacy_cap
    FROM public.user_content_capacity
    WHERE user_id             = p_user_id
      AND lower(content_type) = lower(p_content_type)
      AND task_type           = v_task_type;
  END IF;

  IF v_legacy_cap IS NOT NULL THEN RETURN v_legacy_cap; END IF;

  SELECT COALESCE(daily_capacity, 3) INTO v_legacy_cap
  FROM public.profiles WHERE id = p_user_id;

  RETURN COALESCE(v_legacy_cap, 3);
END;
$$;


-- ── 7. auto_assign_task (simple, no daily cap) ────────────────

CREATE OR REPLACE FUNCTION public.auto_assign_task(p_task_id bigint)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_task_type    text;
  v_is_manual    boolean;
  v_target_role  text;
  v_content_type text;
  v_client_name  text;
  v_assignee     uuid;
BEGIN
  SELECT t.task_type, t.manually_assigned,
         lower(coalesce(cr.content_type, '')), cr.client_name
  INTO v_task_type, v_is_manual, v_content_type, v_client_name
  FROM public.tasks t
  LEFT JOIN public.content_rows cr ON cr.id = t.content_row_id
  WHERE t.id = p_task_id;

  IF v_is_manual THEN RETURN null; END IF;

  -- DB-driven role lookup
  SELECT target_role INTO v_target_role FROM public.task_types WHERE key = v_task_type;
  IF v_target_role IS NULL THEN RETURN null; END IF;

  -- Pass 0: client + content-type affinity
  IF v_client_name IS NOT NULL AND v_content_type != '' THEN
    SELECT assignee_id INTO v_assignee
    FROM (
      SELECT DISTINCT t2.assignee_id
      FROM public.tasks t2
      JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
      JOIN public.profiles p ON p.id = t2.assignee_id
      WHERE t2.task_type = v_task_type
        AND t2.id != p_task_id
        AND t2.assignee_id IS NOT NULL
        AND cr2.client_name = v_client_name
        AND lower(coalesce(cr2.content_type, '')) = v_content_type
        AND p.is_active = true AND p.role = v_target_role
      GROUP BY t2.assignee_id, p.max_concurrent_tasks
      HAVING count(CASE WHEN t2.status NOT IN ('done','approved') THEN 1 END)
             < coalesce(p.max_concurrent_tasks, 10)
    ) c ORDER BY random() LIMIT 1;
  END IF;

  -- Pass 1: least loaded under concurrent cap
  IF v_assignee IS NULL THEN
    SELECT p.id INTO v_assignee
    FROM public.profiles p
    LEFT JOIN public.tasks t ON t.assignee_id = p.id AND t.status NOT IN ('done','approved')
    WHERE p.role = v_target_role AND p.is_active = true
    GROUP BY p.id, p.max_concurrent_tasks
    HAVING count(t.id) < coalesce(p.max_concurrent_tasks, 10)
    ORDER BY count(t.id) ASC, random() LIMIT 1;
  END IF;

  -- Pass 2: absolute fallback
  IF v_assignee IS NULL THEN
    SELECT p.id INTO v_assignee
    FROM public.profiles p
    LEFT JOIN public.tasks t ON t.assignee_id = p.id AND t.status NOT IN ('done','approved')
    WHERE p.role = v_target_role AND p.is_active = true
    GROUP BY p.id ORDER BY count(t.id) ASC, random() LIMIT 1;
  END IF;

  UPDATE public.tasks SET assignee_id = v_assignee, updated_at = now() WHERE id = p_task_id;

  INSERT INTO public.activity_log (task_id, actor_id, action, details)
  VALUES (p_task_id, null, 'auto_assigned',
          jsonb_build_object('assignee_id', v_assignee, 'method', 'affinity_concurrent',
                             'task_type', v_task_type, 'target_role', v_target_role,
                             'content_type', v_content_type, 'client_name', v_client_name));

  RETURN v_assignee;
END;
$$;


-- ── 8. auto_assign_with_daily_cap (hour-based) ───────────────

CREATE OR REPLACE FUNCTION public.auto_assign_with_daily_cap(p_task_id bigint)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_task_type      text;
  v_is_manual      boolean;
  v_target_role    text;
  v_orig_deadline  date;
  v_posting_date   date;
  v_deadline_date  date;
  v_content_type   text;
  v_client_name    text;
  v_task_hours     numeric;
  v_shift_hours    numeric;
  v_assignee       uuid;
  v_batch_deadline date;
BEGIN
  SELECT t.task_type, t.manually_assigned, t.internal_deadline::date,
         cr.posting_date::date, lower(coalesce(cr.content_type,'')), cr.client_name
  INTO v_task_type, v_is_manual, v_orig_deadline, v_posting_date, v_content_type, v_client_name
  FROM public.tasks t
  LEFT JOIN public.content_rows cr ON cr.id = t.content_row_id
  WHERE t.id = p_task_id;

  IF v_is_manual THEN RETURN null; END IF;

  -- DB-driven role lookup
  SELECT target_role INTO v_target_role FROM public.task_types WHERE key = v_task_type;
  IF v_target_role IS NULL THEN RETURN null; END IF;

  v_shift_hours := 8.0;

  -- Task duration from config (default 1.33h)
  SELECT COALESCE(duration_hours, 1.33) INTO v_task_hours
  FROM public.task_type_config
  WHERE content_type = v_content_type AND task_type = v_task_type;
  v_task_hours := COALESCE(v_task_hours, 1.33);

  -- Upper bound: day before posting, skip excluded days
  v_deadline_date := COALESCE(
    CASE WHEN v_posting_date IS NOT NULL THEN v_posting_date - 1 ELSE NULL END,
    v_orig_deadline,
    CURRENT_DATE + 7
  );
  WHILE public.is_excluded_posting_day(v_deadline_date) AND v_deadline_date > CURRENT_DATE LOOP
    v_deadline_date := v_deadline_date - 1;
  END LOOP;

  -- Pass 1: has hour capacity in 14-day window
  SELECT p.id INTO v_assignee
  FROM public.profiles p
  WHERE p.role = v_target_role AND p.is_active = true
    AND EXISTS (
      SELECT 1
      FROM generate_series(
        GREATEST(CURRENT_DATE, v_deadline_date - 13),
        v_deadline_date, '1 day'::interval
      ) d(dt)
      WHERE NOT public.is_excluded_posting_day(d.dt::date)
        AND (
          SELECT COALESCE(SUM(tc.duration_hours), 0)
          FROM public.tasks t2
          LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
          LEFT JOIN public.task_type_config tc
            ON tc.content_type = lower(coalesce(cr2.content_type,''))
           AND tc.task_type    = v_task_type
          WHERE t2.assignee_id = p.id
            AND t2.task_type   = v_task_type
            AND t2.internal_deadline::date = d.dt::date
            AND t2.status NOT IN ('done','approved')
            AND t2.id != p_task_id
        ) + v_task_hours <= v_shift_hours
    )
  ORDER BY
    (SELECT count(*) FROM public.tasks t2
     WHERE t2.assignee_id = p.id AND t2.status NOT IN ('done','approved')) ASC,
    random()
  LIMIT 1;

  -- Pass 2: fallback — least loaded, ignore cap
  IF v_assignee IS NULL THEN
    SELECT p.id INTO v_assignee
    FROM public.profiles p
    LEFT JOIN public.tasks t ON t.assignee_id = p.id AND t.status NOT IN ('done','approved')
    WHERE p.role = v_target_role AND p.is_active = true
    GROUP BY p.id ORDER BY count(t.id) ASC, random() LIMIT 1;
    v_batch_deadline := v_deadline_date;
  END IF;

  -- Batch deadline: fill existing batch first, then latest available day
  IF v_assignee IS NOT NULL AND v_batch_deadline IS NULL THEN
    SELECT d.dt::date INTO v_batch_deadline
    FROM generate_series(
      GREATEST(CURRENT_DATE, v_deadline_date - 13),
      v_deadline_date, '1 day'::interval
    ) d(dt),
    LATERAL (
      SELECT
        COALESCE(SUM(tc.duration_hours), 0) AS used_hours,
        COUNT(*) FILTER (
          WHERE lower(coalesce(cr2.content_type,'')) = v_content_type
        ) AS same_type_cnt
      FROM public.tasks t2
      LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
      LEFT JOIN public.task_type_config tc
        ON tc.content_type = lower(coalesce(cr2.content_type,''))
       AND tc.task_type    = v_task_type
      WHERE t2.assignee_id = v_assignee
        AND t2.task_type   = v_task_type
        AND t2.internal_deadline::date = d.dt::date
        AND t2.status NOT IN ('done','approved')
        AND t2.id != p_task_id
    ) load_check
    WHERE NOT public.is_excluded_posting_day(d.dt::date)
      AND load_check.used_hours + v_task_hours <= v_shift_hours
    ORDER BY
      CASE WHEN load_check.same_type_cnt > 0 THEN 0 ELSE 1 END ASC,
      d.dt DESC
    LIMIT 1;
    v_batch_deadline := COALESCE(v_batch_deadline, v_deadline_date);
  END IF;

  UPDATE public.tasks
  SET assignee_id       = v_assignee,
      internal_deadline = v_batch_deadline::timestamptz,
      updated_at        = now()
  WHERE id = p_task_id;

  INSERT INTO public.activity_log (task_id, actor_id, action, details)
  VALUES (p_task_id, null, 'auto_assigned',
          jsonb_build_object('assignee_id', v_assignee, 'method', 'affinity_batch_hours',
                             'task_type', v_task_type, 'target_role', v_target_role,
                             'content_type', v_content_type, 'client_name', v_client_name,
                             'task_hours', v_task_hours, 'batch_deadline', v_batch_deadline,
                             'posting_date', v_posting_date));

  RETURN v_assignee;
END;
$$;


-- ── 9. create_tasks_for_rows — media task_type from task_type_config ─
-- Must DROP first: return type changed (added video_task_id column).
DROP FUNCTION IF EXISTS public.create_tasks_for_rows(bigint[]);
-- Queries task_type_config to find which non-post task type applies
-- to this content_type (design vs video). Always creates a post task too.

CREATE OR REPLACE FUNCTION public.create_tasks_for_rows(p_ids bigint[])
RETURNS TABLE(content_row_id bigint, design_task_id bigint, video_task_id bigint, post_task_id bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row           public.content_rows%rowtype;
  v_design_buffer int;
  v_review_buffer int;
  v_posting_at    timestamptz;
  v_media_due     timestamptz;
  v_post_due      timestamptz;
  v_media_id      bigint;
  v_post_id       bigint;
  v_media_type    text;   -- 'design' or 'video', from task_type_config
BEGIN
  FOREACH v_row.id IN ARRAY p_ids LOOP
    SELECT * INTO v_row FROM public.content_rows WHERE id = v_row.id;
    IF NOT FOUND THEN CONTINUE; END IF;

    IF public.is_excluded_posting_day(v_row.posting_date) THEN CONTINUE; END IF;

    -- Determine media task type from task_type_config (DB-driven, not hardcoded)
    SELECT tc.task_type INTO v_media_type
    FROM public.task_type_config tc
    WHERE tc.content_type = lower(v_row.content_type)
      AND tc.task_type   != 'post'
    LIMIT 1;
    v_media_type := COALESCE(v_media_type, 'design');  -- fallback if no config row

    -- Idempotent: return existing ids
    IF EXISTS (SELECT 1 FROM public.tasks t WHERE t.content_row_id = v_row.id) THEN
      SELECT t.id INTO v_media_id FROM public.tasks t
        WHERE t.content_row_id = v_row.id AND t.task_type = v_media_type LIMIT 1;
      SELECT t.id INTO v_post_id FROM public.tasks t
        WHERE t.content_row_id = v_row.id AND t.task_type = 'post' LIMIT 1;
      content_row_id := v_row.id;
      design_task_id := CASE WHEN v_media_type = 'design' THEN v_media_id ELSE NULL END;
      video_task_id  := CASE WHEN v_media_type = 'video'  THEN v_media_id ELSE NULL END;
      post_task_id   := v_post_id;
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT bc.design_buffer_days, bc.review_buffer_days
      INTO v_design_buffer, v_review_buffer
    FROM public.buffer_config bc
    WHERE lower(bc.platform)     = lower(coalesce(v_row.platform,''))
      AND lower(bc.content_type) = lower(v_row.content_type)
    LIMIT 1;

    v_design_buffer := coalesce(v_design_buffer, 3);
    v_review_buffer := coalesce(v_review_buffer, 1);

    v_posting_at := (v_row.posting_date + coalesce(v_row.posting_time,'10:00:00'::time))
                    AT TIME ZONE 'Asia/Kolkata';

    v_media_due := GREATEST(
      v_posting_at - ((v_design_buffer + v_review_buffer) || ' days')::interval,
      CURRENT_DATE::timestamptz AT TIME ZONE 'Asia/Kolkata'
    );
    v_post_due := v_posting_at;

    INSERT INTO public.tasks (content_row_id, task_type, internal_deadline)
    VALUES (v_row.id, v_media_type, v_media_due)
    RETURNING id INTO v_media_id;
    PERFORM public.auto_assign_with_daily_cap(v_media_id);

    INSERT INTO public.tasks (content_row_id, task_type, internal_deadline)
    VALUES (v_row.id, 'post', v_post_due)
    RETURNING id INTO v_post_id;
    PERFORM public.auto_assign_with_daily_cap(v_post_id);

    UPDATE public.content_rows SET auto_create_tasks = true WHERE id = v_row.id;

    INSERT INTO public.activity_log (content_row_id, action, details)
    VALUES (v_row.id, 'tasks_created',
            jsonb_build_object('media_type', v_media_type,
                               'media_task_id', v_media_id, 'post_task_id', v_post_id));

    content_row_id := v_row.id;
    design_task_id := CASE WHEN v_media_type = 'design' THEN v_media_id ELSE NULL END;
    video_task_id  := CASE WHEN v_media_type = 'video'  THEN v_media_id ELSE NULL END;
    post_task_id   := v_post_id;
    RETURN NEXT;
  END LOOP;
END;
$$;


-- ── 10. task_pipeline_health view ────────────────────────────

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
  p.specialty             AS assignee_specialty,
  p.daily_capacity,
  tt.target_role          AS task_target_role,
  -- SMO: assignee of the 'post' task for this content row
  smo_p.id               AS smo_id,
  smo_p.full_name        AS smo_name,
  -- Video editor: assignee of the 'video' task for this content row
  vid_p.id               AS video_editor_id,
  vid_p.full_name        AS video_editor_name,
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
LEFT JOIN public.profiles p   ON p.id  = t.assignee_id
LEFT JOIN public.task_types tt ON tt.key = t.task_type
LEFT JOIN public.tasks smo_t
       ON smo_t.content_row_id = t.content_row_id AND smo_t.task_type = 'post'
LEFT JOIN public.profiles smo_p ON smo_p.id = smo_t.assignee_id
LEFT JOIN public.tasks vid_t
       ON vid_t.content_row_id = t.content_row_id AND vid_t.task_type = 'video'
LEFT JOIN public.profiles vid_p ON vid_p.id = vid_t.assignee_id;


-- ── 11. profile_with_flags view ───────────────────────────────
-- DROP required: column list changed (added is_video_type).
DROP VIEW IF EXISTS public.profile_with_flags;

CREATE VIEW public.profile_with_flags AS
SELECT
  p.*,
  COALESCE(r.is_designer_type, false) AS is_designer_type,
  COALESCE(r.is_video_type,    false) AS is_video_type,
  COALESCE(r.is_privileged,    false) AS is_privileged,
  COALESCE(r.can_redistribute, false) AS can_redistribute
FROM public.profiles p
LEFT JOIN public.roles r ON r.key = p.role;
