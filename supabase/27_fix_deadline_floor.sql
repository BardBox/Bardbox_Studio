-- =============================================================
-- 27_fix_deadline_floor.sql
-- Fix: design internal_deadline must never be in the past.
-- If posting_date is very soon, clamp deadline to CURRENT_DATE.
-- =============================================================

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

    -- Clamp: design deadline can never be earlier than today.
    -- If posting date is very close, the buffer window has already started —
    -- deadline becomes today so the task shows as urgent, not overdue.
    v_design_due := GREATEST(
      v_posting_at - ((v_design_buffer + v_review_buffer) || ' days')::interval,
      CURRENT_DATE::timestamptz AT TIME ZONE 'Asia/Kolkata'
    );

    v_post_due := v_posting_at;

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
