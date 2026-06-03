-- =============================================================
-- 25_view_specialty.sql
-- Adds assignee_specialty to task_pipeline_health view
-- =============================================================

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

-- Also seed specialties for existing designers (run if not already done)
UPDATE public.profiles SET specialty = 'video_editor'    WHERE role = 'designer' AND designation ILIKE '%video%';
UPDATE public.profiles SET specialty = 'graphic_designer' WHERE role = 'designer' AND designation ILIKE '%graphic%';
