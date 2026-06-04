-- =============================================================
-- 33_client_affinity_assignment.sql
-- Merges Pass 0 (client + content-type affinity) with the
-- batch-deadline logic from migration 30.
--
-- Assignment order:
--   Pass 0  → prefer whoever already handles same client+content_type
--   Pass 1  → specialty/generalist match, has room in 14-day window
--   Pass 2  → fallback, least-loaded
-- After picking who: find optimal batch deadline
--   → fill existing batches first (same type, same day, has room)
--   → then latest available day in window (most lead time)
-- Updates both assignee_id AND internal_deadline.
-- =============================================================


-- ── 1. auto_assign_task (simple, no daily cap, no batching) ──
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
  v_client_name     text;
  v_req_specialty   text;
  v_assignee        uuid;
BEGIN
  SELECT
    t.task_type,
    t.manually_assigned,
    lower(coalesce(cr.content_type, '')),
    cr.client_name
  INTO v_task_type, v_is_manual, v_content_type, v_client_name
  FROM public.tasks t
  LEFT JOIN public.content_rows cr ON cr.id = t.content_row_id
  WHERE t.id = p_task_id;

  IF v_is_manual THEN RETURN null; END IF;

  v_target_role   := CASE WHEN v_task_type = 'design' THEN 'designer' ELSE 'smo' END;
  v_req_specialty := CASE WHEN v_task_type = 'design'
                          THEN public.required_specialty(v_content_type)
                          ELSE null END;

  -- Pass 0: client + content-type affinity
  IF v_client_name IS NOT NULL AND v_content_type != '' THEN
    SELECT assignee_id INTO v_assignee
    FROM (
      SELECT DISTINCT t_other.assignee_id
      FROM public.tasks t_other
      JOIN public.content_rows cr_other ON cr_other.id = t_other.content_row_id
      JOIN public.profiles p ON p.id = t_other.assignee_id
      WHERE t_other.task_type = v_task_type
        AND t_other.id != p_task_id
        AND t_other.assignee_id IS NOT NULL
        AND cr_other.client_name = v_client_name
        AND lower(coalesce(cr_other.content_type, '')) = v_content_type
        AND p.is_active = true
        AND p.role = v_target_role
        AND (v_req_specialty IS NULL OR p.specialty = v_req_specialty OR p.specialty IS NULL)
      GROUP BY t_other.assignee_id, p.max_concurrent_tasks
      HAVING count(
        CASE WHEN t_other.status NOT IN ('done', 'approved') THEN 1 END
      ) < coalesce(p.max_concurrent_tasks, 10)
    ) candidates
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- Pass 1: specialty/generalist match, under concurrent cap
  IF v_assignee IS NULL THEN
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
  END IF;

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
            'assignee_id',   v_assignee,
            'method',        'affinity_concurrent',
            'content_type',  v_content_type,
            'client_name',   v_client_name,
            'req_specialty', v_req_specialty
          ));

  RETURN v_assignee;
END;
$$;


-- ── 2. auto_assign_with_daily_cap (affinity + batch deadlines) ──
CREATE OR REPLACE FUNCTION public.auto_assign_with_daily_cap(p_task_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_type       text;
  v_is_manual       boolean;
  v_target_role     text;
  v_orig_deadline   date;
  v_posting_date    date;
  v_deadline_date   date;   -- upper bound: posting_date - 1 day
  v_content_type    text;
  v_client_name     text;
  v_req_specialty   text;
  v_assignee        uuid;
  v_batch_deadline  date;
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

  v_target_role   := CASE WHEN v_task_type = 'design' THEN 'designer' ELSE 'smo' END;
  v_req_specialty := CASE WHEN v_task_type = 'design'
                          THEN public.required_specialty(v_content_type)
                          ELSE null END;

  -- Upper bound: 1 day before posting (can't submit on posting day itself)
  v_deadline_date := COALESCE(
    CASE WHEN v_posting_date IS NOT NULL THEN v_posting_date - 1 ELSE NULL END,
    v_orig_deadline,
    CURRENT_DATE + 7
  );

  -- ── Pass 0: client + content-type affinity ───────────────────
  -- Prefer whoever already handles this client's content type,
  -- as long as they have capacity somewhere in the 14-day window.
  IF v_client_name IS NOT NULL AND v_content_type != '' THEN
    SELECT assignee_id INTO v_assignee
    FROM (
      SELECT DISTINCT t_other.assignee_id
      FROM public.tasks t_other
      JOIN public.content_rows cr_other ON cr_other.id = t_other.content_row_id
      JOIN public.profiles p ON p.id = t_other.assignee_id
      WHERE t_other.task_type = v_task_type
        AND t_other.id != p_task_id
        AND t_other.assignee_id IS NOT NULL
        AND cr_other.client_name = v_client_name
        AND lower(coalesce(cr_other.content_type, '')) = v_content_type
        AND p.is_active = true
        AND p.role = v_target_role
        AND (v_req_specialty IS NULL OR p.specialty = v_req_specialty OR p.specialty IS NULL)
        -- must have at least one available day in the window
        AND EXISTS (
          SELECT 1
          FROM generate_series(
            GREATEST(CURRENT_DATE, v_deadline_date - 13),
            v_deadline_date,
            '1 day'::interval
          ) d(dt)
          WHERE (
            SELECT count(*)
            FROM public.tasks t2
            LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
            WHERE t2.assignee_id = t_other.assignee_id
              AND t2.internal_deadline::date = d.dt::date
              AND t2.status NOT IN ('done', 'approved')
              AND t2.id != p_task_id
              AND (v_content_type = '' OR lower(coalesce(cr2.content_type, '')) = v_content_type)
          ) < public.get_daily_cap(t_other.assignee_id, NULLIF(v_content_type, ''))
        )
    ) candidates
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- ── Pass 1: specialty/generalist, has room in 14-day window ──
  IF v_assignee IS NULL THEN
    SELECT p.id INTO v_assignee
    FROM public.profiles p
    WHERE p.role = v_target_role
      AND p.is_active = true
      AND (v_req_specialty IS NULL
           OR p.specialty = v_req_specialty
           OR p.specialty IS NULL)
      AND EXISTS (
        SELECT 1
        FROM generate_series(
          GREATEST(CURRENT_DATE, v_deadline_date - 13),
          v_deadline_date,
          '1 day'::interval
        ) d(dt)
        WHERE (
          SELECT count(*)
          FROM public.tasks t2
          LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
          WHERE t2.assignee_id = p.id
            AND t2.internal_deadline::date = d.dt::date
            AND t2.status NOT IN ('done', 'approved')
            AND t2.id != p_task_id
            AND (v_content_type = ''
                 OR lower(coalesce(cr2.content_type, '')) = v_content_type)
        ) < public.get_daily_cap(p.id, NULLIF(v_content_type, ''))
      )
    ORDER BY
      (SELECT count(*) FROM public.tasks t2
       WHERE t2.assignee_id = p.id
         AND t2.status NOT IN ('done', 'approved')) ASC,
      CASE WHEN p.specialty = v_req_specialty THEN 0 ELSE 1 END,
      random()
    LIMIT 1;
  END IF;

  -- ── Pass 2: fallback — least loaded, no cap constraint ───────
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

  -- ── Batch deadline: pick the optimal day for the chosen designer ─
  -- Priority 1: a day that already has tasks of this type with room
  --             (fill existing batch before opening a new day)
  -- Priority 2: latest available day in window (most lead time)
  IF v_assignee IS NOT NULL AND v_batch_deadline IS NULL THEN
    SELECT d.dt::date INTO v_batch_deadline
    FROM generate_series(
      GREATEST(CURRENT_DATE, v_deadline_date - 13),
      v_deadline_date,
      '1 day'::interval
    ) d(dt),
    LATERAL (
      SELECT count(*) AS existing_cnt
      FROM public.tasks t2
      LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
      WHERE t2.assignee_id = v_assignee
        AND t2.internal_deadline::date = d.dt::date
        AND t2.status NOT IN ('done', 'approved')
        AND t2.id != p_task_id
        AND (v_content_type = ''
             OR lower(coalesce(cr2.content_type, '')) = v_content_type)
    ) load_check
    WHERE load_check.existing_cnt
          < public.get_daily_cap(v_assignee, NULLIF(v_content_type, ''))
    ORDER BY
      CASE WHEN load_check.existing_cnt > 0 THEN 0 ELSE 1 END ASC,  -- fill existing first
      d.dt DESC                                                        -- then latest date
    LIMIT 1;

    v_batch_deadline := COALESCE(v_batch_deadline, v_deadline_date);
  END IF;

  -- ── Apply ─────────────────────────────────────────────────────
  UPDATE public.tasks
  SET assignee_id       = v_assignee,
      internal_deadline = v_batch_deadline::timestamptz,
      updated_at        = now()
  WHERE id = p_task_id;

  INSERT INTO public.activity_log (task_id, actor_id, action, details)
  VALUES (p_task_id, null, 'auto_assigned',
          jsonb_build_object(
            'assignee_id',    v_assignee,
            'method',         'affinity_batch',
            'content_type',   v_content_type,
            'client_name',    v_client_name,
            'req_specialty',  v_req_specialty,
            'batch_deadline', v_batch_deadline,
            'posting_date',   v_posting_date
          ));

  RETURN v_assignee;
END;
$$;
