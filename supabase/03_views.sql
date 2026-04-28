-- =============================================================
-- 03_views.sql
-- Reporting views for dashboards.
-- Run after 02_functions.sql.
-- =============================================================

-- ---------------------------------------------------------------
-- task_pipeline_health
-- Every task enriched with content info, assignee name, and a
-- pressure_level tag the UI can color-code.
--
-- pressure_level values:
--   'completed'   — status is done/approved
--   'overdue'     — past internal_deadline, still open
--   'critical'    — <48 hours to deadline
--   'approaching' — 2–7 days
--   'comfortable' — >7 days
-- ---------------------------------------------------------------
create or replace view public.task_pipeline_health as
select
  t.id                    as task_id,
  t.task_type,
  t.status                as task_status,
  t.internal_deadline,
  t.assignee_id,
  t.manually_assigned,
  t.completed_at,
  cr.id                   as content_row_id,
  cr.client_name,
  cr.platform,
  cr.content_type,
  cr.brief,
  cr.caption,
  cr.posting_date,
  cr.posting_time,
  cr.status               as row_status,
  p.full_name             as assignee_name,
  p.role                  as assignee_role,
  round(extract(epoch from (t.internal_deadline - now())) / 3600.0, 1) as hours_until_deadline,
  case
    when t.status in ('done','approved') then 'completed'
    when t.internal_deadline < now() then 'overdue'
    when (t.internal_deadline - now()) < interval '48 hours' then 'critical'
    when (t.internal_deadline - now()) < interval '7 days' then 'approaching'
    else 'comfortable'
  end as pressure_level
from public.tasks t
join public.content_rows cr on cr.id = t.content_row_id
left join public.profiles p on p.id = t.assignee_id;


-- ---------------------------------------------------------------
-- team_load_report
-- Per-person workload snapshot for the manager dashboard.
-- ---------------------------------------------------------------
create or replace view public.team_load_report as
select
  p.id,
  p.full_name,
  p.role,
  p.max_concurrent_tasks,
  count(t.id) filter (where t.status = 'todo')                               as todo_count,
  count(t.id) filter (where t.status = 'in_progress')                        as in_progress_count,
  count(t.id) filter (where t.status = 'submitted')                          as submitted_count,
  count(t.id) filter (where t.status = 'blocked')                            as blocked_count,
  count(t.id) filter (
    where t.internal_deadline < now()
      and t.status not in ('done','approved')
  )                                                                          as overdue_count,
  count(t.id) filter (
    where (t.internal_deadline - now()) < interval '48 hours'
      and t.status not in ('done','approved')
  )                                                                          as critical_count,
  count(t.id) filter (
    where t.completed_at >= date_trunc('week', now())
  )                                                                          as completed_this_week,
  count(t.id) filter (
    where t.status not in ('done','approved')
  )                                                                          as active_total
from public.profiles p
left join public.tasks t on t.assignee_id = p.id
where p.is_active = true
  and p.role in ('designer','smo')
group by p.id, p.full_name, p.role, p.max_concurrent_tasks
order by p.role, active_total desc;


-- ---------------------------------------------------------------
-- pipeline_summary
-- High-level KPIs for the manager landing page.
-- ---------------------------------------------------------------
create or replace view public.pipeline_summary as
select
  count(*) filter (where pressure_level = 'overdue')               as overdue,
  count(*) filter (where pressure_level = 'critical')              as critical,
  count(*) filter (where pressure_level = 'approaching')           as approaching,
  count(*) filter (where pressure_level = 'comfortable')           as comfortable,
  count(*) filter (where task_status = 'blocked')                  as blocked,
  count(*) filter (
    where completed_at >= date_trunc('week', now())
  )                                                                as completed_this_week,
  count(*) filter (
    where posting_date between current_date and current_date + 7
      and task_type = 'post'
  )                                                                as posts_next_7_days,
  count(*) filter (
    where posting_date = current_date
      and task_type = 'post'
      and task_status not in ('done','approved')
  )                                                                as posts_due_today
from public.task_pipeline_health;


-- ---------------------------------------------------------------
-- weekly_throughput
-- Completed tasks per role per ISO week — for trend charts.
-- ---------------------------------------------------------------
create or replace view public.weekly_throughput as
select
  date_trunc('week', t.completed_at)::date as week_start,
  p.role,
  count(*) as completed
from public.tasks t
join public.profiles p on p.id = t.assignee_id
where t.completed_at is not null
  and t.completed_at > now() - interval '12 weeks'
group by 1, 2
order by 1 desc, 2;
