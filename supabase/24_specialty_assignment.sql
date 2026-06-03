-- =============================================================
-- 24_specialty_assignment.sql
-- Adds specialty column to profiles and rewrites assignment
-- functions to route tasks by content type:
--   reel / video / youtube  →  video_editor
--   everything else         →  graphic_designer (or null = both)
-- =============================================================

-- ── 1. Add specialty column ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS specialty text
  CHECK (specialty IN ('video_editor', 'graphic_designer'))
  DEFAULT NULL;

COMMENT ON COLUMN public.profiles.specialty IS
  'NULL = generalist (any design), video_editor = reels/video/youtube, graphic_designer = static/carousel/post';


-- ── 2. Helper: map content_type → required specialty ─────────
CREATE OR REPLACE FUNCTION public.required_specialty(p_content_type text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(p_content_type) IN ('reel', 'video', 'youtube') THEN 'video_editor'
    ELSE 'graphic_designer'
  END;
$$;


-- ── 3. Rewrite auto_assign_task (specialty-aware) ─────────────
CREATE OR REPLACE FUNCTION public.auto_assign_task(p_task_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_type       text;
  v_is_manual       boolean;
  v_target_role     text;
  v_content_type    text;
  v_req_specialty   text;
  v_assignee        uuid;
BEGIN
  SELECT
    t.task_type,
    t.manually_assigned,
    lower(coalesce(cr.content_type, ''))
  INTO v_task_type, v_is_manual, v_content_type
  FROM public.tasks t
  LEFT JOIN public.content_rows cr ON cr.id = t.content_row_id
  WHERE t.id = p_task_id;

  IF v_is_manual THEN RETURN null; END IF;

  v_target_role   := CASE WHEN v_task_type = 'design' THEN 'designer' ELSE 'smo' END;
  v_req_specialty := CASE WHEN v_task_type = 'design'
                          THEN public.required_specialty(v_content_type)
                          ELSE null END;

  -- Pass 1: exact specialty match (or generalist null), under capacity
  SELECT p.id INTO v_assignee
  FROM public.profiles p
  LEFT JOIN public.tasks t
    ON t.assignee_id = p.id AND t.status NOT IN ('done', 'approved')
  WHERE p.role = v_target_role
    AND p.is_active = true
    AND (v_req_specialty IS NULL
         OR p.specialty = v_req_specialty
         OR p.specialty IS NULL)
  GROUP BY p.id, p.max_concurrent_tasks
  HAVING count(t.id) < coalesce(p.max_concurrent_tasks, 10)
  ORDER BY
    CASE WHEN p.specialty = v_req_specialty THEN 0 ELSE 1 END,
    count(t.id) ASC,
    random()
  LIMIT 1;

  -- Pass 2: fallback — least loaded, any matching role
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
  END IF;

  UPDATE public.tasks
    SET assignee_id = v_assignee, updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO public.activity_log (task_id, actor_id, action, details)
  VALUES (p_task_id, null, 'auto_assigned',
          jsonb_build_object(
            'assignee_id',    v_assignee,
            'content_type',   v_content_type,
            'req_specialty',  v_req_specialty
          ));

  RETURN v_assignee;
END;
$$;


-- ── 4. Rewrite auto_assign_with_daily_cap (specialty-aware) ───
CREATE OR REPLACE FUNCTION public.auto_assign_with_daily_cap(p_task_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_type       text;
  v_is_manual       boolean;
  v_target_role     text;
  v_deadline_date   date;
  v_content_type    text;
  v_req_specialty   text;
  v_assignee        uuid;
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

  v_target_role   := CASE WHEN v_task_type = 'design' THEN 'designer' ELSE 'smo' END;
  v_req_specialty := CASE WHEN v_task_type = 'design'
                          THEN public.required_specialty(v_content_type)
                          ELSE null END;

  -- Pass 1: exact/generalist match, under daily cap on deadline date
  SELECT p.id INTO v_assignee
  FROM public.profiles p
  WHERE p.role = v_target_role
    AND p.is_active = true
    AND (v_req_specialty IS NULL
         OR p.specialty = v_req_specialty
         OR p.specialty IS NULL)
    AND (
      SELECT count(*)
      FROM public.tasks t2
      LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
      WHERE t2.assignee_id = p.id
        AND t2.internal_deadline::date = v_deadline_date
        AND t2.status NOT IN ('done', 'approved')
        AND t2.id != p_task_id
        AND (v_content_type = ''
             OR lower(coalesce(cr2.content_type, '')) = v_content_type)
    ) < public.get_daily_cap(p.id, NULLIF(v_content_type, ''))
  ORDER BY
    CASE WHEN p.specialty = v_req_specialty THEN 0 ELSE 1 END,
    (
      SELECT count(*)
      FROM public.tasks t2
      LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
      WHERE t2.assignee_id = p.id
        AND t2.internal_deadline::date = v_deadline_date
        AND t2.status NOT IN ('done', 'approved')
        AND t2.id != p_task_id
        AND (v_content_type = ''
             OR lower(coalesce(cr2.content_type, '')) = v_content_type)
    ) ASC,
    random()
  LIMIT 1;

  -- Pass 2: fallback — least total open tasks, any matching role
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
  END IF;

  UPDATE public.tasks
    SET assignee_id = v_assignee, updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO public.activity_log (task_id, actor_id, action, details)
  VALUES (p_task_id, null, 'auto_assigned',
          jsonb_build_object(
            'assignee_id',    v_assignee,
            'method',         'specialty_daily_cap',
            'content_type',   v_content_type,
            'req_specialty',  v_req_specialty,
            'deadline_date',  v_deadline_date
          ));

  RETURN v_assignee;
END;
$$;


-- ── 5. Update create_tasks_for_rows to use daily-cap version ──
CREATE OR REPLACE FUNCTION public.create_tasks_for_rows(p_ids bigint[])
RETURNS TABLE(content_row_id bigint, design_task_id bigint, post_task_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row           public.content_rows%rowtype;
  v_design_buffer int;
  v_review_buffer int;
  v_posting_at    timestamptz;
  v_design_due    timestamptz;
  v_post_due      timestamptz;
  v_design_id     bigint;
  v_post_id       bigint;
BEGIN
  FOREACH v_row.id IN ARRAY p_ids LOOP
    SELECT * INTO v_row FROM public.content_rows WHERE id = v_row.id;
    IF NOT FOUND THEN CONTINUE; END IF;

    -- Idempotent: return existing task ids if already created
    IF EXISTS (SELECT 1 FROM public.tasks t WHERE t.content_row_id = v_row.id) THEN
      SELECT t.id INTO v_design_id FROM public.tasks t
        WHERE t.content_row_id = v_row.id AND t.task_type = 'design' LIMIT 1;
      SELECT t.id INTO v_post_id FROM public.tasks t
        WHERE t.content_row_id = v_row.id AND t.task_type = 'post' LIMIT 1;
      content_row_id := v_row.id;
      design_task_id := v_design_id;
      post_task_id   := v_post_id;
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT bc.design_buffer_days, bc.review_buffer_days
      INTO v_design_buffer, v_review_buffer
    FROM public.buffer_config bc
    WHERE lower(bc.platform) = lower(coalesce(v_row.platform, ''))
      AND lower(bc.content_type) = lower(v_row.content_type)
    LIMIT 1;

    v_design_buffer := coalesce(v_design_buffer, 3);
    v_review_buffer := coalesce(v_review_buffer, 1);

    v_posting_at := (v_row.posting_date + coalesce(v_row.posting_time, '10:00:00'::time))
                    AT TIME ZONE 'Asia/Kolkata';
    v_design_due := v_posting_at - ((v_design_buffer + v_review_buffer) || ' days')::interval;
    v_post_due   := v_posting_at;

    INSERT INTO public.tasks (content_row_id, task_type, internal_deadline)
    VALUES (v_row.id, 'design', v_design_due)
    RETURNING id INTO v_design_id;

    PERFORM public.auto_assign_with_daily_cap(v_design_id);

    INSERT INTO public.tasks (content_row_id, task_type, internal_deadline)
    VALUES (v_row.id, 'post', v_post_due)
    RETURNING id INTO v_post_id;

    PERFORM public.auto_assign_with_daily_cap(v_post_id);

    UPDATE public.content_rows SET auto_create_tasks = true WHERE id = v_row.id;

    INSERT INTO public.activity_log (content_row_id, action, details)
    VALUES (v_row.id, 'tasks_created',
            jsonb_build_object('design_task_id', v_design_id, 'post_task_id', v_post_id));

    content_row_id := v_row.id;
    design_task_id := v_design_id;
    post_task_id   := v_post_id;
    RETURN NEXT;
  END LOOP;
END;
$$;
