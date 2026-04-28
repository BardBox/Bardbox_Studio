-- =============================================================
-- 06_roles_leave.sql
-- Phase 3: CEO/HR roles, leave management, in-app content creation,
-- task approval flow, updated auto-assign with leave awareness.
-- Run after 05_seed.sql.
-- =============================================================


-- ---------------------------------------------------------------
-- 1. Extend profiles role constraint to include ceo + hr
-- ---------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('designer','smo','manager','admin','ceo','hr'));


-- ---------------------------------------------------------------
-- 2. Update content_rows to support in-app / imported rows
-- ---------------------------------------------------------------

-- Allow null sheet_row_id (in-app created rows have no sheet row)
alter table public.content_rows
  alter column sheet_row_id drop not null;

-- Drop the simple unique constraint; replace with partial index (ignores nulls)
alter table public.content_rows
  drop constraint if exists content_rows_sheet_row_id_key;

create unique index if not exists content_rows_sheet_row_id_unique
  on public.content_rows(sheet_row_id)
  where sheet_row_id is not null;

-- Track where this row came from
alter table public.content_rows
  add column if not exists source text not null default 'sheets'
  check (source in ('sheets','in_app','import'));

-- Who created it (null = auto-created via webhook/trigger)
alter table public.content_rows
  add column if not exists created_by uuid references public.profiles(id) on delete set null;


-- ---------------------------------------------------------------
-- 3. Add rejection notes to tasks (for CEO/Manager reject flow)
-- ---------------------------------------------------------------
alter table public.tasks
  add column if not exists rejection_notes text;


-- ---------------------------------------------------------------
-- 4. Leave requests table
-- ---------------------------------------------------------------
create table if not exists public.leave_requests (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  reason       text,
  status       text not null default 'pending'
               check (status in ('pending','approved','denied')),
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  review_notes text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint leave_dates_valid check (end_date >= start_date)
);

create index if not exists leave_requests_user_idx      on public.leave_requests(user_id);
create index if not exists leave_requests_status_idx    on public.leave_requests(status);
create index if not exists leave_requests_date_range_idx on public.leave_requests(start_date, end_date);

drop trigger if exists touch_leave_requests on public.leave_requests;
create trigger touch_leave_requests
  before update on public.leave_requests
  for each row execute function public.touch_updated_at();

alter table public.leave_requests enable row level security;


-- ---------------------------------------------------------------
-- 5. RLS helper functions (updated to include ceo/hr)
-- ---------------------------------------------------------------

-- is_manager: manager | admin | ceo (all can manage tasks + content)
create or replace function public.is_manager()
returns boolean
language sql stable security definer
as $$
  select coalesce(
    (select role in ('manager','admin','ceo')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- is_hr: hr | admin (manage people + leave)
create or replace function public.is_hr()
returns boolean
language sql stable security definer
as $$
  select coalesce(
    (select role in ('hr','admin')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- is_privileged: any management role (for broad read access)
create or replace function public.is_privileged()
returns boolean
language sql stable security definer
as $$
  select coalesce(
    (select role in ('manager','admin','ceo','hr')
     from public.profiles where id = auth.uid()),
    false
  );
$$;


-- ---------------------------------------------------------------
-- 6. RLS policies for leave_requests
-- ---------------------------------------------------------------
drop policy if exists leave_hr_all           on public.leave_requests;
drop policy if exists leave_self_select      on public.leave_requests;
drop policy if exists leave_self_insert      on public.leave_requests;
drop policy if exists leave_manager_select   on public.leave_requests;

-- HR/admin: full control
create policy leave_hr_all on public.leave_requests
  for all using (public.is_hr()) with check (public.is_hr());

-- Manager/CEO: read-only view (to know who is unavailable)
create policy leave_manager_select on public.leave_requests
  for select using (public.is_manager());

-- Any authenticated user: see their own requests
create policy leave_self_select on public.leave_requests
  for select using (user_id = auth.uid());

-- Any authenticated user: submit new requests for themselves only
create policy leave_self_insert on public.leave_requests
  for insert with check (user_id = auth.uid());


-- ---------------------------------------------------------------
-- 7. Update profiles RLS to include HR for people management
-- ---------------------------------------------------------------
drop policy if exists profiles_manager_write on public.profiles;
create policy profiles_manager_write on public.profiles
  for all
  using  (public.is_manager() or public.is_hr())
  with check (public.is_manager() or public.is_hr());


-- ---------------------------------------------------------------
-- 8. Update auto_assign_task to skip users on approved leave
-- ---------------------------------------------------------------
create or replace function public.auto_assign_task(p_task_id bigint)
returns uuid
language plpgsql
security definer
as $$
declare
  v_task_type    text;
  v_is_manual    boolean;
  v_deadline     timestamptz;
  v_target_role  text;
  v_assignee     uuid;
begin
  select task_type, manually_assigned, internal_deadline
    into v_task_type, v_is_manual, v_deadline
  from public.tasks
  where id = p_task_id;

  if v_is_manual then
    return null;
  end if;

  v_target_role := case when v_task_type = 'design' then 'designer' else 'smo' end;

  -- Pick active profile with fewest open tasks, skipping anyone on approved leave
  -- that overlaps with the task deadline date.
  select p.id
    into v_assignee
  from public.profiles p
  left join public.tasks t
    on t.assignee_id = p.id
   and t.status not in ('done','approved')
  where p.role = v_target_role
    and p.is_active = true
    and not exists (
      select 1 from public.leave_requests lr
      where lr.user_id = p.id
        and lr.status = 'approved'
        and v_deadline::date between lr.start_date and lr.end_date
    )
  group by p.id, p.max_concurrent_tasks
  having count(t.id) < coalesce(p.max_concurrent_tasks, 10)
  order by count(t.id) asc, random()
  limit 1;

  -- Fallback: if everyone is on leave or over cap, assign least-loaded ignoring leave
  if v_assignee is null then
    select p.id
      into v_assignee
    from public.profiles p
    left join public.tasks t
      on t.assignee_id = p.id
     and t.status not in ('done','approved')
    where p.role = v_target_role
      and p.is_active = true
    group by p.id
    order by count(t.id) asc, random()
    limit 1;
  end if;

  update public.tasks
    set assignee_id = v_assignee,
        updated_at  = now()
  where id = p_task_id;

  insert into public.activity_log (task_id, actor_id, action, details)
  values (p_task_id, null, 'auto_assigned',
          jsonb_build_object('assignee_id', v_assignee));

  return v_assignee;
end;
$$;


-- ---------------------------------------------------------------
-- 9. approve_task RPC (called by CEO/Manager)
-- Moves status: submitted → approved
-- ---------------------------------------------------------------
create or replace function public.approve_task(
  p_task_id  bigint,
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public.tasks
    set status     = 'approved',
        updated_at = now()
  where id = p_task_id
    and status = 'submitted';

  insert into public.activity_log (task_id, actor_id, action)
  values (p_task_id, p_actor_id, 'task_approved');
end;
$$;


-- ---------------------------------------------------------------
-- 10. reject_task RPC (called by CEO/Manager)
-- Moves status: submitted → in_progress + stores notes
-- ---------------------------------------------------------------
create or replace function public.reject_task(
  p_task_id      bigint,
  p_notes        text,
  p_actor_id     uuid default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public.tasks
    set status          = 'in_progress',
        rejection_notes = p_notes,
        updated_at      = now()
  where id = p_task_id
    and status = 'submitted';

  insert into public.activity_log (task_id, actor_id, action, details)
  values (p_task_id, p_actor_id, 'task_rejected',
          jsonb_build_object('notes', p_notes));
end;
$$;


-- ---------------------------------------------------------------
-- 11. New views
-- ---------------------------------------------------------------

-- pending_approvals: submitted tasks awaiting CEO/Manager review
create or replace view public.pending_approvals as
select *
from public.task_pipeline_health
where task_status = 'submitted'
order by internal_deadline asc;


-- team_availability: current + upcoming approved leave per person
create or replace view public.team_availability as
select
  p.id           as user_id,
  p.full_name,
  p.role,
  p.is_active,
  lr.id          as leave_id,
  lr.start_date,
  lr.end_date,
  lr.reason,
  lr.status      as leave_status,
  (current_date between lr.start_date and lr.end_date) as is_on_leave_today
from public.profiles p
left join public.leave_requests lr
  on lr.user_id = p.id
 and lr.status = 'approved'
 and lr.end_date >= current_date
where p.is_active = true
order by p.role, p.full_name, lr.start_date;


-- client_health: per-client task stats for CEO overview
create or replace view public.client_health as
select
  cr.client_name,
  count(*)                                                        as total_tasks,
  count(*) filter (where t.status = 'done')                       as done,
  count(*) filter (where t.status in ('todo','in_progress'))      as in_flight,
  count(*) filter (where t.status = 'submitted')                  as pending_review,
  count(*) filter (
    where t.internal_deadline < now()
      and t.status not in ('done','approved')
  )                                                               as overdue,
  round(
    100.0 * count(*) filter (where t.status = 'done')
    / nullif(count(*), 0)
  )                                                               as completion_pct
from public.tasks t
join public.content_rows cr on cr.id = t.content_row_id
group by cr.client_name
order by overdue desc, total_tasks desc;
