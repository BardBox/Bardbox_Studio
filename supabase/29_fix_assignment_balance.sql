-- =============================================================
-- 29_fix_assignment_balance.sql
-- Two fixes:
-- 1. Set specialty = 'graphic_designer' for all active designers
--    whose specialty is still NULL (they were being deprioritised
--    against exact-match designers even when less loaded).
-- 2. Rewrite auto_assign_with_daily_cap so that task load is the
--    primary ORDER key and specialty match is only a tiebreaker.
--    Previously the opposite was true, causing all graphic tasks
--    to pile onto the first exact-match designer.
-- =============================================================

-- ── 1. Fill missing specialties ──────────────────────────────
UPDATE public.profiles
SET specialty = 'graphic_designer'
WHERE role = 'designer'
  AND is_active = true
  AND specialty IS NULL;


-- ── 2. Rewrite auto_assign_with_daily_cap ─────────────────────
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

  -- Pass 1: eligible designers under daily cap, ordered by load (fewest tasks on
  -- this deadline date first). Specialty exact-match only breaks ties.
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
    -- PRIMARY: fewest tasks on this deadline date (load balancing)
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
    -- TIEBREAKER: exact specialty match preferred
    CASE WHEN p.specialty = v_req_specialty THEN 0 ELSE 1 END,
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
