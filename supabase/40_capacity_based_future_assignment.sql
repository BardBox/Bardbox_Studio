-- Migration 40: Capacity-based future task assignment
--
-- Assignment should not happen only on the posting day. The posting date is
-- the final anchor, and employee task deadlines are distributed across working
-- days before that date using per-employee task/content capacity.
--
-- Example: if a video editor has user_content_capacity:
--   content_type = 'reel', task_type = 'video', daily_cap = 6
-- then no more than 6 reel video tasks are placed on that editor for one day.

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

  SELECT target_role INTO v_target_role FROM public.task_types WHERE key = v_task_type;
  IF v_target_role IS NULL THEN RETURN null; END IF;

  -- Latest allowed work day is one working day before posting.
  v_deadline_date := COALESCE(
    CASE WHEN v_posting_date IS NOT NULL THEN v_posting_date - 1 ELSE NULL END,
    v_orig_deadline,
    CURRENT_DATE + 7
  );
  WHILE public.is_excluded_posting_day(v_deadline_date) AND v_deadline_date > CURRENT_DATE LOOP
    v_deadline_date := v_deadline_date - 1;
  END LOOP;

  -- Pick an assignee that has at least one free capacity slot in the future
  -- scheduling window. Capacity is per employee + content_type + task_type.
  SELECT p.id INTO v_assignee
  FROM public.profiles p
  WHERE p.role = v_target_role
    AND p.is_active = true
    AND EXISTS (
      SELECT 1
      FROM generate_series(
        GREATEST(CURRENT_DATE, v_deadline_date - 13),
        v_deadline_date,
        '1 day'::interval
      ) d(dt)
      WHERE NOT public.is_excluded_posting_day(d.dt::date)
        AND (
          SELECT COUNT(*)
          FROM public.tasks t2
          LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
          WHERE t2.assignee_id = p.id
            AND t2.task_type = v_task_type
            AND lower(coalesce(cr2.content_type,'')) = v_content_type
            AND t2.internal_deadline::date = d.dt::date
            AND t2.status NOT IN ('done','approved')
            AND t2.id != p_task_id
        ) < COALESCE(
          (
            SELECT ucc.daily_cap
            FROM public.user_content_capacity ucc
            WHERE ucc.user_id = p.id
              AND lower(ucc.content_type) = v_content_type
              AND ucc.task_type = v_task_type
            LIMIT 1
          ),
          public.get_daily_cap(p.id, v_content_type),
          p.daily_capacity,
          3
        )
    )
  ORDER BY
    (SELECT COUNT(*)
     FROM public.tasks t2
     WHERE t2.assignee_id = p.id
       AND t2.status NOT IN ('done','approved')) ASC,
    random()
  LIMIT 1;

  -- Fallback: if everyone is full in the window, keep the least-loaded person.
  IF v_assignee IS NULL THEN
    SELECT p.id INTO v_assignee
    FROM public.profiles p
    LEFT JOIN public.tasks t ON t.assignee_id = p.id AND t.status NOT IN ('done','approved')
    WHERE p.role = v_target_role
      AND p.is_active = true
    GROUP BY p.id
    ORDER BY COUNT(t.id) ASC, random()
    LIMIT 1;

    v_batch_deadline := v_deadline_date;
  END IF;

  -- Put the task on a day with available capacity for this exact work type.
  -- Front-load: prefer the EARLIEST working day in the window so the editor
  -- works ahead — fill each day up to the per-day cap before spilling to the
  -- next day. (e.g. 6 reels/day → the first 6 reels batch onto the earliest
  -- working day, the 7th onto the next, and so on.)
  IF v_assignee IS NOT NULL AND v_batch_deadline IS NULL THEN
    SELECT d.dt::date INTO v_batch_deadline
    FROM generate_series(
      GREATEST(CURRENT_DATE, v_deadline_date - 13),
      v_deadline_date,
      '1 day'::interval
    ) d(dt),
    LATERAL (
      SELECT COUNT(*) AS used_count
      FROM public.tasks t2
      LEFT JOIN public.content_rows cr2 ON cr2.id = t2.content_row_id
      WHERE t2.assignee_id = v_assignee
        AND t2.task_type = v_task_type
        AND lower(coalesce(cr2.content_type,'')) = v_content_type
        AND t2.internal_deadline::date = d.dt::date
        AND t2.status NOT IN ('done','approved')
        AND t2.id != p_task_id
    ) load_check
    WHERE NOT public.is_excluded_posting_day(d.dt::date)
      AND load_check.used_count < COALESCE(
        (
          SELECT ucc.daily_cap
          FROM public.user_content_capacity ucc
          WHERE ucc.user_id = v_assignee
            AND lower(ucc.content_type) = v_content_type
            AND ucc.task_type = v_task_type
          LIMIT 1
        ),
        public.get_daily_cap(v_assignee, v_content_type),
        3
      )
    ORDER BY d.dt ASC, load_check.used_count DESC
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
          jsonb_build_object('assignee_id', v_assignee,
                             'method', 'employee_content_daily_cap',
                             'task_type', v_task_type,
                             'target_role', v_target_role,
                             'content_type', v_content_type,
                             'client_name', v_client_name,
                             'batch_deadline', v_batch_deadline,
                             'posting_date', v_posting_date));

  RETURN v_assignee;
END;
$$;
