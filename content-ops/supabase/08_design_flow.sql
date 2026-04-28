-- =============================================================
-- 08_design_flow.sql
-- Phase 3: design link on tasks, manual task creation flag,
--           create_tasks_for_rows RPC, refreshed views.
-- Run after 07_task_requests_clients.sql
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Add design_url to tasks
-- ---------------------------------------------------------------
alter table public.tasks
  add column if not exists design_url text;

-- ---------------------------------------------------------------
-- 2. Add auto_create_tasks flag to content_rows
--    true  = trigger creates tasks on insert (default, in_app)
--    false = tasks created manually later (imported rows)
-- ---------------------------------------------------------------
alter table public.content_rows
  add column if not exists auto_create_tasks boolean not null default true;

-- ---------------------------------------------------------------
-- 3. Replace create_tasks_for_content_row trigger function
--    to respect the auto_create_tasks flag
-- ---------------------------------------------------------------
create or replace function public.create_tasks_for_content_row()
returns trigger
language plpgsql
as $$
declare
  v_design_buffer int;
  v_review_buffer int;
  v_posting_at    timestamptz;
  v_design_due    timestamptz;
  v_post_due      timestamptz;
  v_design_id     bigint;
  v_post_id       bigint;
begin
  -- Skip task creation for imported rows (manager creates tasks manually)
  if not new.auto_create_tasks then
    return new;
  end if;

  select bc.design_buffer_days, bc.review_buffer_days
    into v_design_buffer, v_review_buffer
  from public.buffer_config bc
  where lower(bc.platform) = lower(new.platform)
    and lower(bc.content_type) = lower(new.content_type)
  limit 1;

  v_design_buffer := coalesce(v_design_buffer, 3);
  v_review_buffer := coalesce(v_review_buffer, 1);

  v_posting_at := (new.posting_date + coalesce(new.posting_time, '10:00:00'::time))
                  at time zone 'Asia/Kolkata';
  v_design_due := v_posting_at - ((v_design_buffer + v_review_buffer) || ' days')::interval;
  v_post_due   := v_posting_at;

  insert into public.tasks (content_row_id, task_type, internal_deadline)
  values (new.id, 'design', v_design_due)
  returning id into v_design_id;

  perform public.auto_assign_task(v_design_id);

  insert into public.tasks (content_row_id, task_type, internal_deadline)
  values (new.id, 'post', v_post_due)
  returning id into v_post_id;

  perform public.auto_assign_task(v_post_id);

  insert into public.activity_log (content_row_id, action, details)
  values (new.id, 'tasks_created',
          jsonb_build_object('design_task_id', v_design_id, 'post_task_id', v_post_id));

  return new;
end;
$$;

-- Recreate trigger (function replaced in-place, but recreate to be safe)
drop trigger if exists content_row_create_tasks on public.content_rows;
create trigger content_row_create_tasks
  after insert on public.content_rows
  for each row execute function public.create_tasks_for_content_row();


-- ---------------------------------------------------------------
-- 4. RPC: create_tasks_for_rows(p_ids BIGINT[])
--    Called by the manager when manually creating tasks for
--    selected imported content rows.
--    Idempotent: skips rows that already have tasks.
-- ---------------------------------------------------------------
create or replace function public.create_tasks_for_rows(p_ids bigint[])
returns table(content_row_id bigint, design_task_id bigint, post_task_id bigint)
language plpgsql
security definer
as $$
declare
  v_row          public.content_rows%rowtype;
  v_design_buffer int;
  v_review_buffer int;
  v_posting_at   timestamptz;
  v_design_due   timestamptz;
  v_post_due     timestamptz;
  v_design_id    bigint;
  v_post_id      bigint;
begin
  foreach v_row.id in array p_ids loop
    select * into v_row from public.content_rows where id = v_row.id;
    if not found then continue; end if;

    -- Skip if tasks already exist for this row
    if exists (select 1 from public.tasks t where t.content_row_id = v_row.id) then
      select t.id into v_design_id from public.tasks t
        where t.content_row_id = v_row.id and t.task_type = 'design' limit 1;
      select t.id into v_post_id from public.tasks t
        where t.content_row_id = v_row.id and t.task_type = 'post' limit 1;
      content_row_id := v_row.id;
      design_task_id := v_design_id;
      post_task_id   := v_post_id;
      return next;
      continue;
    end if;

    select bc.design_buffer_days, bc.review_buffer_days
      into v_design_buffer, v_review_buffer
    from public.buffer_config bc
    where lower(bc.platform) = lower(v_row.platform)
      and lower(bc.content_type) = lower(v_row.content_type)
    limit 1;

    v_design_buffer := coalesce(v_design_buffer, 3);
    v_review_buffer := coalesce(v_review_buffer, 1);

    v_posting_at := (v_row.posting_date + coalesce(v_row.posting_time, '10:00:00'::time))
                    at time zone 'Asia/Kolkata';
    v_design_due := v_posting_at - ((v_design_buffer + v_review_buffer) || ' days')::interval;
    v_post_due   := v_posting_at;

    insert into public.tasks (content_row_id, task_type, internal_deadline)
    values (v_row.id, 'design', v_design_due)
    returning id into v_design_id;

    perform public.auto_assign_task(v_design_id);

    insert into public.tasks (content_row_id, task_type, internal_deadline)
    values (v_row.id, 'post', v_post_due)
    returning id into v_post_id;

    perform public.auto_assign_task(v_post_id);

    -- Mark row as having tasks, so trigger won't double-create if row is ever updated
    update public.content_rows
      set auto_create_tasks = true
    where id = v_row.id;

    insert into public.activity_log (content_row_id, action, details)
    values (v_row.id, 'tasks_created',
            jsonb_build_object('design_task_id', v_design_id, 'post_task_id', v_post_id));

    content_row_id := v_row.id;
    design_task_id := v_design_id;
    post_task_id   := v_post_id;
    return next;
  end loop;
end;
$$;


-- ---------------------------------------------------------------
-- 5. Refresh task_pipeline_health to include design_url and
--    rejection_notes (both added in prior/this migration)
-- ---------------------------------------------------------------
-- Drop all dependent views first (CASCADE handles pipeline_summary and pending_approvals)
drop view if exists public.task_pipeline_health cascade;

create view public.task_pipeline_health as
select
  t.id                    as task_id,
  t.task_type,
  t.status                as task_status,
  t.internal_deadline,
  t.assignee_id,
  t.manually_assigned,
  t.completed_at,
  t.design_url,
  t.rejection_notes,
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
-- 6. Refresh pending_approvals (inherits design_url + rejection_notes
--    from the updated task_pipeline_health view)
-- ---------------------------------------------------------------
create view public.pending_approvals as
select *
from public.task_pipeline_health
where task_status = 'submitted'
order by internal_deadline asc;


-- ---------------------------------------------------------------
-- 7. Recreate pipeline_summary (was dropped by CASCADE above)
-- ---------------------------------------------------------------
create view public.pipeline_summary as
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
