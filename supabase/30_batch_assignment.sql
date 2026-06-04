-- =============================================================
-- 30_batch_assignment.sql
-- Rewrite auto_assign_with_daily_cap to BATCH tasks by type:
--   Instead of one task per deadline day, fill up to daily_cap
--   tasks on the same deadline day before opening a new day.
--   e.g. Jignesh gets 3 reels on Jun 9 rather than 1 reel each
--   on Jun 9 / 10 / 11.
--
-- Key changes vs migration 29:
--   1. Reads posting_date from content_rows to compute deadline window
--   2. Scans a 14-day window per designer instead of a single date
--   3. Picks batch deadline: prefer days with existing same-type tasks
--      (fill existing batches first), then latest available day
--   4. Updates internal_deadline in addition to assignee_id
-- =============================================================

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
  v_deadline_date   date;   -- upper bound for batch window (posting_date - 1)
  v_content_type    text;
  v_req_specialty   text;
  v_assignee        uuid;
  v_batch_deadline  date;
BEGIN
  SELECT
    t.task_type,
    t.manually_assigned,
    t.internal_deadline::date,
    cr.posting_date::date,
    lower(coalesce(cr.content_type, ''))
  INTO v_task_type, v_is_manual, v_orig_deadline, v_posting_date, v_content_type
  FROM public.tasks t
  LEFT JOIN public.content_rows cr ON cr.id = t.content_row_id
  WHERE t.id = p_task_id;

  IF v_is_manual THEN RETURN null; END IF;

  v_target_role   := CASE WHEN v_task_type = 'design' THEN 'designer' ELSE 'smo' END;
  v_req_specialty := CASE WHEN v_task_type = 'design'
                          THEN public.required_specialty(v_content_type)
                          ELSE null END;

  -- Upper bound: 1 day before posting (can't submit on posting day itself)
  -- Fall back to original internal_deadline for tasks without a content row
  v_deadline_date := COALESCE(
    CASE WHEN v_posting_date IS NOT NULL THEN v_posting_date - 1 ELSE NULL END,
    v_orig_deadline,
    CURRENT_DATE + 7
  );

  -- ── Pass 1: find designer with capacity anywhere in [window .. deadline] ──
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
    -- Primary: fewest total open tasks (load balance across designers)
    (SELECT count(*) FROM public.tasks t2
     WHERE t2.assignee_id = p.id
       AND t2.status NOT IN ('done', 'approved')) ASC,
    -- Tiebreaker: exact specialty match
    CASE WHEN p.specialty = v_req_specialty THEN 0 ELSE 1 END,
    random()
  LIMIT 1;

  -- ── Find optimal batch deadline for selected designer ────────────────────
  -- Priority 1: a day that already has tasks of this type AND has room left
  --             (fill the existing batch before opening a new day)
  -- Priority 2: latest available day in window (gives designer most lead time)
  IF v_assignee IS NOT NULL THEN
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
      CASE WHEN load_check.existing_cnt > 0 THEN 0 ELSE 1 END ASC,  -- fill existing batches first
      d.dt DESC                                                        -- then latest date (more lead time)
    LIMIT 1;

    v_batch_deadline := COALESCE(v_batch_deadline, v_deadline_date);
  END IF;

  -- ── Pass 2 fallback: least loaded designer, no cap constraint ─────────────
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

  -- ── Apply ─────────────────────────────────────────────────────────────────
  UPDATE public.tasks
  SET assignee_id       = v_assignee,
      internal_deadline = v_batch_deadline::timestamp,
      updated_at        = now()
  WHERE id = p_task_id;

  INSERT INTO public.activity_log (task_id, actor_id, action, details)
  VALUES (p_task_id, null, 'auto_assigned',
          jsonb_build_object(
            'assignee_id',    v_assignee,
            'method',         'batch_daily_cap',
            'content_type',   v_content_type,
            'req_specialty',  v_req_specialty,
            'batch_deadline', v_batch_deadline,
            'posting_date',   v_posting_date
          ));

  RETURN v_assignee;
END;
$$;
