-- =============================================================
-- 34_hour_based_capacity.sql
-- Switches capacity tracking from task-count to hour-based.
--
-- New table: task_type_config (content_type + task_type → duration_hours)
--
-- Shift hours per role:
--   Designer: 8h → carousel (2h) = 4/day, logo (4h) = 2/day
--   SMO:      8h → post (0.75h) = 10/day, reel (1.5h) = 5/day
--
-- The scheduler sums hours of all tasks on a day and rejects days where
-- adding the new task would exceed the role's shift hours.
-- =============================================================

-- ── 1. task_type_config ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_type_config (
  content_type     text    NOT NULL,
  task_type        text    NOT NULL DEFAULT 'design'
    CHECK (task_type IN ('design', 'post')),
  duration_hours   numeric(4,2) NOT NULL DEFAULT 1.33
    CHECK (duration_hours > 0 AND duration_hours <= 8),
  requires_posting boolean NOT NULL DEFAULT true,
  label            text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_type, task_type)
);

ALTER TABLE public.task_type_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "managers_manage_task_type_config" ON public.task_type_config;
CREATE POLICY "managers_manage_task_type_config"
  ON public.task_type_config FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid())
    IN ('admin', 'manager', 'ceo')
  );

DROP POLICY IF EXISTS "authenticated_read_task_type_config" ON public.task_type_config;
CREATE POLICY "authenticated_read_task_type_config"
  ON public.task_type_config FOR SELECT TO authenticated
  USING (true);

-- ── Design task hours (8h designer shift) ───────────────────────
-- Carousel (2h) → 4/day
-- Logo (4h)     → 2/day  (1 logo + 2 carousels fits exactly in 8h)
INSERT INTO public.task_type_config (content_type, task_type, duration_hours, requires_posting, label)
VALUES
  ('carousel',    'design', 2.00, true,  'Carousel'),
  ('reel',        'design', 2.00, true,  'Reel'),
  ('post',        'design', 1.00, true,  'Post'),
  ('static',      'design', 1.00, true,  'Static Post'),
  ('story',       'design', 1.00, true,  'Story'),
  ('graphic',     'design', 1.00, true,  'Graphic'),
  ('thumbnail',   'design', 1.00, true,  'Thumbnail'),
  ('reel_cover',  'design', 1.00, true,  'Reel Cover'),
  ('infographic', 'design', 4.00, true,  'Infographic'),
  ('flyer',       'design', 2.00, true,  'Flyer'),
  ('logo',        'design', 4.00, false, 'Logo'),
  ('branding',    'design', 8.00, false, 'Branding'),
  ('video',       'design', 4.00, true,  'Video'),
  ('youtube',     'design', 8.00, true,  'YouTube Edit'),
  ('revisions',   'design', 1.00, false, 'Revisions')
ON CONFLICT (content_type, task_type) DO NOTHING;

-- ── Post/SMO task hours (4.5h effective SMO task shift) ─────────
-- Post (0.75h) → 6/day  (6 × 0.75 = 4.5h, rest is strategy/planning)
INSERT INTO public.task_type_config (content_type, task_type, duration_hours, requires_posting, label)
VALUES
  ('carousel',   'post', 0.75, true, 'Carousel'),
  ('static',     'post', 0.75, true, 'Static Post'),
  ('story',      'post', 0.50, true, 'Story'),
  ('post',       'post', 0.75, true, 'Post'),
  ('graphic',    'post', 0.75, true, 'Graphic'),
  ('reel',       'post', 1.50, true, 'Reel'),
  ('thread',     'post', 1.00, true, 'Thread'),
  ('linkedin',   'post', 1.50, true, 'LinkedIn'),
  ('thumbnail',  'post', 0.75, true, 'Thumbnail'),
  ('youtube',    'post', 2.25, true, 'YouTube')
ON CONFLICT (content_type, task_type) DO NOTHING;


-- ── 2. required_specialty — only video content needs a specialist ──
-- Carousel, post, graphic, static, etc. = NULL (any designer eligible).
-- Reel, video, youtube = video_editor preferred.
-- Returning NULL means the specialty filter in auto_assign is skipped,
-- allowing even load distribution across all active designers.
CREATE OR REPLACE FUNCTION public.required_specialty(p_content_type text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(p_content_type) IN ('reel', 'video', 'youtube') THEN 'video_editor'
    ELSE NULL
  END;
$$;


-- ── 3. get_daily_cap — role-aware hour-derived cap ───────────────
-- All roles: 8h shift
-- Designer → carousel (2h) = 4/day, logo (4h) = 2/day
-- SMO      → post (0.75h) = 10/day, reel (1.5h) = 5/day
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
  v_task_type   := CASE WHEN v_role = 'smo' THEN 'post' ELSE 'design' END;
  v_shift_hours := 8.0;

  -- Hour-based cap: floor(shift_hours / task_duration)
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

  IF v_legacy_cap IS NOT NULL THEN
    RETURN v_legacy_cap;
  END IF;

  SELECT COALESCE(daily_capacity, 3) INTO v_legacy_cap
  FROM public.profiles WHERE id = p_user_id;

  RETURN COALESCE(v_legacy_cap, 3);
END;
$$;


-- ── 4. auto_assign_with_daily_cap — 8h shift for all roles ──────
CREATE OR REPLACE FUNCTION public.auto_assign_with_daily_cap(p_task_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  v_task_type      text;
  v_is_manual      boolean;
  v_target_role    text;
  v_orig_deadline  date;
  v_posting_date   date;
  v_deadline_date  date;
  v_content_type   text;
  v_client_name    text;
  v_req_specialty  text;
  v_task_hours     numeric;
  v_shift_hours    numeric;   -- 8h for all roles
  v_assignee       uuid;
  v_batch_deadline date;
BEGIN
  SELECT
    t.task_type,
    t.manually_assigned,
    t.internal_deadline::date,
    cr.posting_date::date,
    lower(coalesce(cr.content_type, '')),
    cr.client_name
  INTO v_task_type, v_is_manual, v_orig_deadline, v_posting_date, v_content_type, v_client_name
  FROM public.tasks t
  LEFT JOIN public.content_rows cr ON cr.id = t.content_row_id
  WHERE t.id = p_task_id;

  IF v_is_manual THEN RETURN null; END IF;

  v_target_role := CASE WHEN v_task_type = 'design' THEN 'designer' ELSE 'smo' END;
  v_shift_hours := 8.0;
  v_req_specialty := CASE WHEN v_task_type = 'design'
                          THEN public.required_specialty(v_content_type)
                          ELSE null END;

  -- Duration of this task (falls back to 1.33h if not in config)
  SELECT COALESCE(duration_hours, 1.33) INTO v_task_hours
  FROM public.task_type_config
  WHERE content_type = v_content_type AND task_type = v_task_type;
  v_task_hours := COALESCE(v_task_hours, 1.33);

  -- Upper bound: 1 day before posting date, walked back to last working day
  v_deadline_date := COALESCE(
    CASE WHEN v_posting_date IS NOT NULL THEN v_posting_date - 1 ELSE NULL END,
    v_orig_deadline,
    CURRENT_DATE + 7
  );
  WHILE public.is_excluded_posting_day(v_deadline_date) AND v_deadline_date > CURRENT_DATE LOOP
    v_deadline_date := v_deadline_date - 1;
  END LOOP;

  -- ── Pass 1: least loaded, has hour capacity in window ──────────
  -- Specialty filter:
  --   Video content (reel/video/youtube) → require video_editor or null specialty
  --   Non-video content (carousel/post/etc) → exclude video_editor so they only do video work
  IF v_assignee IS NULL THEN
    SELECT p.id INTO v_assignee
    FROM public.profiles p
    WHERE p.role = v_target_role
      AND p.is_active = true
      AND (
        CASE
          WHEN v_req_specialty IS NOT NULL THEN
            p.specialty = v_req_specialty OR p.specialty IS NULL
          ELSE
            p.specialty IS NULL OR p.specialty <> 'video_editor'
        END
      )
      AND EXISTS (
        SELECT 1
        FROM generate_series(
          GREATEST(CURRENT_DATE, v_deadline_date - 13),
          v_deadline_date,
          '1 day'::interval
        ) d(dt)
        WHERE NOT public.is_excluded_posting_day(d.dt::date)
          AND (
          SELECT COALESCE(SUM(tc.duration_hours), 0)
          FROM public.tasks t2
          LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
          LEFT JOIN public.task_type_config tc
            ON tc.content_type = lower(coalesce(cr2.content_type, ''))
           AND tc.task_type    = v_task_type
          WHERE t2.assignee_id = p.id
            AND t2.task_type   = v_task_type
            AND t2.internal_deadline::date = d.dt::date
            AND t2.status NOT IN ('done', 'approved')
            AND t2.id != p_task_id
        ) + v_task_hours <= v_shift_hours
      )
    ORDER BY
      (SELECT count(*) FROM public.tasks t2
       WHERE t2.assignee_id = p.id AND t2.status NOT IN ('done', 'approved')) ASC,
      CASE WHEN p.specialty = v_req_specialty THEN 0 ELSE 1 END,
      random()
    LIMIT 1;
  END IF;

  -- ── Pass 2: fallback — least loaded, ignore hour cap, keep specialty filter ──
  IF v_assignee IS NULL THEN
    SELECT p.id INTO v_assignee
    FROM public.profiles p
    LEFT JOIN public.tasks t
      ON t.assignee_id = p.id AND t.status NOT IN ('done', 'approved')
    WHERE p.role = v_target_role
      AND p.is_active = true
      AND (
        CASE
          WHEN v_req_specialty IS NOT NULL THEN
            p.specialty = v_req_specialty OR p.specialty IS NULL
          ELSE
            p.specialty IS NULL OR p.specialty <> 'video_editor'
        END
      )
    GROUP BY p.id
    ORDER BY count(t.id) ASC, random()
    LIMIT 1;

    v_batch_deadline := v_deadline_date;
  END IF;

  -- ── Pass 3: absolute fallback — ignore specialty entirely ──────
  IF v_assignee IS NULL THEN
    SELECT p.id INTO v_assignee
    FROM public.profiles p
    LEFT JOIN public.tasks t
      ON t.assignee_id = p.id AND t.status NOT IN ('done', 'approved')
    WHERE p.role = v_target_role
      AND p.is_active = true
    GROUP BY p.id
    ORDER BY count(t.id) ASC, random()
    LIMIT 1;

    v_batch_deadline := v_deadline_date;
  END IF;

  -- ── Batch deadline: choose optimal day for chosen designer ──────
  -- Priority 1: a day that already has tasks of this content type
  --             with enough hours remaining (fill the batch first)
  -- Priority 2: latest available day in window (maximum lead time)
  IF v_assignee IS NOT NULL AND v_batch_deadline IS NULL THEN
    SELECT d.dt::date INTO v_batch_deadline
    FROM generate_series(
      GREATEST(CURRENT_DATE, v_deadline_date - 13),
      v_deadline_date,
      '1 day'::interval
    ) d(dt),
    LATERAL (
      SELECT
        COALESCE(SUM(tc.duration_hours), 0)                             AS used_hours,
        COUNT(*) FILTER (
          WHERE lower(coalesce(cr2.content_type, '')) = v_content_type
        )                                                                 AS same_type_cnt
      FROM public.tasks t2
      LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
      LEFT JOIN public.task_type_config tc
        ON tc.content_type = lower(coalesce(cr2.content_type, ''))
       AND tc.task_type    = v_task_type
      WHERE t2.assignee_id = v_assignee
        AND t2.task_type   = v_task_type
        AND t2.internal_deadline::date = d.dt::date
        AND t2.status NOT IN ('done', 'approved')
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

  -- ── Apply ──────────────────────────────────────────────────────
  UPDATE public.tasks
  SET assignee_id       = v_assignee,
      internal_deadline = v_batch_deadline::timestamptz,
      updated_at        = now()
  WHERE id = p_task_id;

  INSERT INTO public.activity_log (task_id, actor_id, action, details)
  VALUES (p_task_id, null, 'auto_assigned',
          jsonb_build_object(
            'assignee_id',    v_assignee,
            'method',         'affinity_batch_hours',
            'content_type',   v_content_type,
            'client_name',    v_client_name,
            'req_specialty',  v_req_specialty,
            'task_hours',     v_task_hours,
            'shift_hours',    v_shift_hours,
            'batch_deadline', v_batch_deadline,
            'posting_date',   v_posting_date
          ));

  RETURN v_assignee;
END;
$$;


