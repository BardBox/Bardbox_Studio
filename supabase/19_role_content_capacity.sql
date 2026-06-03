-- =============================================================
-- 19_role_content_capacity.sql
-- Per-employee content-type daily capacity
-- Weekend-aware + content-type-aware scheduler update
-- =============================================================

-- ── 1. user_content_capacity table ───────────────────────────
CREATE TABLE IF NOT EXISTS public.user_content_capacity (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      uuid   NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type text   NOT NULL,
  task_type    text   NOT NULL DEFAULT 'design' CHECK (task_type IN ('design', 'post')),
  daily_cap    int    NOT NULL DEFAULT 3 CHECK (daily_cap > 0 AND daily_cap <= 50),
  notes        text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_type, task_type)
);

ALTER TABLE public.user_content_capacity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_capacity" ON public.user_content_capacity;
CREATE POLICY "admin_full_capacity" ON public.user_content_capacity
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'ceo'));

DROP POLICY IF EXISTS "self_read_capacity" ON public.user_content_capacity;
CREATE POLICY "self_read_capacity" ON public.user_content_capacity
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ── 2. Seed: existing designers ──────────────────────────────
INSERT INTO public.user_content_capacity (user_id, content_type, task_type, daily_cap, notes)
SELECT p.id, v.content_type, v.task_type, v.daily_cap, v.notes
FROM public.profiles p
CROSS JOIN (VALUES
  ('carousel',    'design', 3,  '8-10 slides, ~2.5 hrs each'),
  ('static',      'design', 5,  'Single frame, ~1.5 hrs each'),
  ('story',       'design', 6,  'Small canvas, ~1 hr each'),
  ('infographic', 'design', 2,  'Data-heavy, ~4 hrs each'),
  ('thumbnail',   'design', 7,  'Quick crop, ~1 hr each'),
  ('flyer',       'design', 3,  'Print quality, ~2.5 hrs each'),
  ('logo',        'design', 1,  'Conceptual, ~8 hrs each'),
  ('reel_cover',  'design', 7,  'One frame, ~1 hr each'),
  ('reel',        'design', 3,  'Short reel ≤30s, ~2.5 hrs each'),
  ('youtube',     'design', 1,  'Full edit, ~8 hrs each')
) AS v(content_type, task_type, daily_cap, notes)
WHERE p.role = 'designer' AND p.is_active = true
ON CONFLICT (user_id, content_type, task_type) DO NOTHING;


-- ── 3. Seed: existing SMOs ───────────────────────────────────
INSERT INTO public.user_content_capacity (user_id, content_type, task_type, daily_cap, notes)
SELECT p.id, v.content_type, v.task_type, v.daily_cap, v.notes
FROM public.profiles p
CROSS JOIN (VALUES
  ('carousel',  'post', 10, 'Upload + schedule, ~45 min'),
  ('static',    'post', 10, 'Upload + schedule, ~45 min'),
  ('story',     'post', 12, 'Fastest workflow, ~30 min'),
  ('reel',      'post',  5, 'Hashtag + cover + schedule, ~1.5 hrs'),
  ('thread',    'post',  7, 'Multi-tweet planning, ~1 hr'),
  ('linkedin',  'post',  5, 'Professional format, ~1.5 hrs'),
  ('thumbnail', 'post', 10, 'Upload + schedule, ~45 min'),
  ('youtube',   'post',  3, 'Description + tags + schedule, ~2.5 hrs')
) AS v(content_type, task_type, daily_cap, notes)
WHERE p.role = 'smo' AND p.is_active = true
ON CONFLICT (user_id, content_type, task_type) DO NOTHING;


-- ── 4. get_daily_cap helper ──────────────────────────────────
-- Looks up user_content_capacity for this person + content type.
-- Falls back to profiles.daily_capacity if no specific rule found.
CREATE OR REPLACE FUNCTION public.get_daily_cap(
  p_user_id      uuid,
  p_content_type text DEFAULT null
) RETURNS int
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_role      text;
  v_task_type text;
  v_cap       int;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  v_task_type := CASE WHEN v_role = 'smo' THEN 'post' ELSE 'design' END;

  IF p_content_type IS NOT NULL AND p_content_type <> '' THEN
    SELECT daily_cap INTO v_cap
    FROM public.user_content_capacity
    WHERE user_id     = p_user_id
      AND lower(content_type) = lower(p_content_type)
      AND task_type   = v_task_type;
  END IF;

  IF v_cap IS NULL THEN
    SELECT coalesce(daily_capacity, 3) INTO v_cap
    FROM public.profiles WHERE id = p_user_id;
  END IF;

  RETURN coalesce(v_cap, 3);
END;
$$;


-- ── 5. find_available_slot (weekend-aware + content-type-aware) ─
CREATE OR REPLACE FUNCTION public.find_available_slot(
  p_assignee_id     uuid,
  p_desired_date    date,
  p_exclude_task_id bigint DEFAULT null,
  p_content_type    text   DEFAULT null
)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity   int;
  v_check_date date := p_desired_date;
  v_count      int;
  v_dow        int;
BEGIN
  v_capacity := public.get_daily_cap(p_assignee_id, p_content_type);

  FOR i IN 0..89 LOOP
    -- Skip Saturday (6) and Sunday (0)
    v_dow := EXTRACT(DOW FROM v_check_date)::int;
    IF v_dow IN (0, 6) THEN
      v_check_date := v_check_date + 1;
      CONTINUE;
    END IF;

    SELECT count(*) INTO v_count
    FROM public.tasks t
    LEFT JOIN public.content_rows cr ON cr.id = t.content_row_id
    WHERE t.assignee_id = p_assignee_id
      AND t.internal_deadline::date = v_check_date
      AND t.status NOT IN ('done', 'approved')
      AND (p_exclude_task_id IS NULL OR t.id != p_exclude_task_id)
      AND (
        p_content_type IS NULL
        OR p_content_type = ''
        OR lower(coalesce(cr.content_type, '')) = lower(p_content_type)
      );

    IF v_count < v_capacity THEN
      RETURN v_check_date;
    END IF;

    v_check_date := v_check_date + 1;
  END LOOP;

  RETURN v_check_date;
END;
$$;


-- ── 6. auto_assign_with_daily_cap (content-type-aware) ────────
CREATE OR REPLACE FUNCTION public.auto_assign_with_daily_cap(p_task_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_type     text;
  v_is_manual     boolean;
  v_target_role   text;
  v_deadline_date date;
  v_content_type  text;
  v_assignee      uuid;
BEGIN
  SELECT
    t.task_type,
    t.manually_assigned,
    t.internal_deadline::date,
    lower(coalesce(cr.content_type, ''))
  INTO v_task_type, v_is_manual, v_deadline_date, v_content_type
  FROM public.tasks t
  LEFT JOIN public.content_rows cr ON cr.id = t.content_row_id
  WHERE t.id = p_task_id;

  IF v_is_manual THEN RETURN null; END IF;

  v_target_role := CASE WHEN v_task_type = 'design' THEN 'designer' ELSE 'smo' END;

  -- Primary: person with fewest tasks of this content_type on the day, under their cap
  SELECT p.id INTO v_assignee
  FROM public.profiles p
  WHERE p.role = v_target_role
    AND p.is_active = true
    AND (
      SELECT count(*)
      FROM public.tasks t2
      LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
      WHERE t2.assignee_id = p.id
        AND t2.internal_deadline::date = v_deadline_date
        AND t2.status NOT IN ('done', 'approved')
        AND t2.id != p_task_id
        AND (v_content_type = '' OR lower(coalesce(cr2.content_type, '')) = v_content_type)
    ) < public.get_daily_cap(p.id, NULLIF(v_content_type, ''))
  ORDER BY (
    SELECT count(*)
    FROM public.tasks t2
    LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
    WHERE t2.assignee_id = p.id
      AND t2.internal_deadline::date = v_deadline_date
      AND t2.status NOT IN ('done', 'approved')
      AND t2.id != p_task_id
      AND (v_content_type = '' OR lower(coalesce(cr2.content_type, '')) = v_content_type)
  ) ASC, random()
  LIMIT 1;

  -- Fallback: least total open tasks
  IF v_assignee IS NULL THEN
    SELECT p.id INTO v_assignee
    FROM public.profiles p
    LEFT JOIN public.tasks t ON t.assignee_id = p.id AND t.status NOT IN ('done', 'approved')
    WHERE p.role = v_target_role AND p.is_active = true
    GROUP BY p.id
    ORDER BY count(t.id) ASC, random()
    LIMIT 1;
  END IF;

  UPDATE public.tasks
    SET assignee_id = v_assignee, updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO public.activity_log (task_id, actor_id, action, details)
  VALUES (p_task_id, null, 'auto_assigned',
          jsonb_build_object(
            'assignee_id',   v_assignee,
            'method',        'role_content_cap',
            'content_type',  v_content_type,
            'deadline_date', v_deadline_date
          ));

  RETURN v_assignee;
END;
$$;


-- ── 7. Trigger: seed capacity when new user is created ───────
CREATE OR REPLACE FUNCTION public.seed_user_content_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.role = 'designer' THEN
    INSERT INTO public.user_content_capacity (user_id, content_type, task_type, daily_cap, notes) VALUES
      (new.id, 'carousel',    'design', 3, '8-10 slides, ~2.5 hrs each'),
      (new.id, 'static',      'design', 5, 'Single frame, ~1.5 hrs each'),
      (new.id, 'story',       'design', 6, 'Small canvas, ~1 hr each'),
      (new.id, 'infographic', 'design', 2, 'Data-heavy, ~4 hrs each'),
      (new.id, 'thumbnail',   'design', 7, 'Quick crop, ~1 hr each'),
      (new.id, 'flyer',       'design', 3, 'Print quality, ~2.5 hrs each'),
      (new.id, 'logo',        'design', 1, 'Conceptual, ~8 hrs each'),
      (new.id, 'reel_cover',  'design', 7, 'One frame, ~1 hr each'),
      (new.id, 'reel',        'design', 3, 'Short reel ≤30s, ~2.5 hrs each'),
      (new.id, 'youtube',     'design', 1, 'Full edit, ~8 hrs each')
    ON CONFLICT DO NOTHING;
  ELSIF new.role = 'smo' THEN
    INSERT INTO public.user_content_capacity (user_id, content_type, task_type, daily_cap, notes) VALUES
      (new.id, 'carousel',  'post', 10, 'Upload + schedule, ~45 min'),
      (new.id, 'static',    'post', 10, 'Upload + schedule, ~45 min'),
      (new.id, 'story',     'post', 12, 'Fastest workflow, ~30 min'),
      (new.id, 'reel',      'post',  5, 'Hashtag + cover + schedule, ~1.5 hrs'),
      (new.id, 'thread',    'post',  7, 'Multi-tweet planning, ~1 hr'),
      (new.id, 'linkedin',  'post',  5, 'Professional format, ~1.5 hrs'),
      (new.id, 'thumbnail', 'post', 10, 'Upload + schedule, ~45 min'),
      (new.id, 'youtube',   'post',  3, 'Description + tags + schedule, ~2.5 hrs')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_user_capacity ON public.profiles;
CREATE TRIGGER trg_seed_user_capacity
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_user_content_capacity();


-- ── 8. Add /admin/capacity to role_permissions ───────────────
INSERT INTO public.role_permissions (role, route, enabled) VALUES
  ('admin',   '/admin/capacity', true),
  ('manager', '/admin/capacity', true),
  ('ceo',     '/admin/capacity', false),
  ('designer','/admin/capacity', false),
  ('smo',     '/admin/capacity', false),
  ('hr',      '/admin/capacity', false),
  ('developer','/admin/capacity',false)
ON CONFLICT (role, route) DO UPDATE SET enabled = EXCLUDED.enabled;
