-- =============================================================
-- 07_task_requests_clients.sql
-- Clients table + task-request approval flow
-- Run after 06_roles_leave.sql
-- =============================================================


-- ---------------------------------------------------------------
-- 1. Clients — canonical list of client names
-- ---------------------------------------------------------------
create table if not exists public.clients (
  id         bigserial primary key,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clients_name_unique
  on public.clients(lower(trim(name)));

drop trigger if exists touch_clients on public.clients;
create trigger touch_clients
  before update on public.clients
  for each row execute function public.touch_updated_at();

alter table public.clients enable row level security;

drop policy if exists clients_all_read  on public.clients;
drop policy if exists clients_mgr_write on public.clients;

create policy clients_all_read on public.clients
  for select using (auth.role() = 'authenticated');

create policy clients_mgr_write on public.clients
  for all
  using  (public.is_manager())
  with check (public.is_manager());

-- Seed existing client names from content_rows
insert into public.clients (name)
select distinct trim(client_name)
from public.content_rows
where client_name is not null and trim(client_name) <> ''
on conflict do nothing;


-- ---------------------------------------------------------------
-- 2. Task requests — any user can submit; manager approves/rejects
-- ---------------------------------------------------------------
create table if not exists public.task_requests (
  id           bigserial primary key,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  client_name  text not null,
  platform     text not null,
  content_type text not null,
  posting_date date not null,
  caption      text,
  notes        text,
  status       text not null default 'pending'
               check (status in ('pending','approved','rejected')),
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  review_notes text,
  task_id      bigint references public.tasks(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists task_requests_status_idx    on public.task_requests(status);
create index if not exists task_requests_requester_idx on public.task_requests(requested_by);

drop trigger if exists touch_task_requests on public.task_requests;
create trigger touch_task_requests
  before update on public.task_requests
  for each row execute function public.touch_updated_at();

alter table public.task_requests enable row level security;

drop policy if exists task_requests_mgr_all   on public.task_requests;
drop policy if exists task_requests_self_read on public.task_requests;
drop policy if exists task_requests_self_ins  on public.task_requests;

-- Manager/CEO/Admin: full access to all requests
create policy task_requests_mgr_all on public.task_requests
  for all using (public.is_manager()) with check (public.is_manager());

-- Any user: read their own requests
create policy task_requests_self_read on public.task_requests
  for select using (requested_by = auth.uid());

-- Any user: submit requests for themselves only
create policy task_requests_self_ins on public.task_requests
  for insert with check (requested_by = auth.uid());


-- ---------------------------------------------------------------
-- 3. approve_task_request RPC
--    Creates content_row (which triggers task creation + auto-assign)
--    and marks the request approved.
-- ---------------------------------------------------------------
create or replace function public.approve_task_request(
  p_request_id bigint,
  p_actor_id   uuid default null
)
returns bigint
language plpgsql
security definer
as $$
declare
  v_req     record;
  v_row_id  bigint;
  v_task_id bigint;
begin
  select * into v_req
  from public.task_requests
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'Task request % not found or already processed', p_request_id;
  end if;

  -- Insert content_row — trigger create_tasks_for_content_row fires automatically
  insert into public.content_rows (
    client_name, platform, content_type, posting_date, caption, source, created_by
  ) values (
    v_req.client_name,
    lower(trim(v_req.platform)),
    lower(trim(v_req.content_type)),
    v_req.posting_date,
    v_req.caption,
    'in_app',
    v_req.requested_by
  )
  returning id into v_row_id;

  -- Grab the first auto-created task id
  select id into v_task_id
  from public.tasks
  where content_row_id = v_row_id
  order by id
  limit 1;

  update public.task_requests
  set status      = 'approved',
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      task_id     = v_task_id,
      updated_at  = now()
  where id = p_request_id;

  insert into public.activity_log (task_id, actor_id, action, details)
  values (v_task_id, p_actor_id, 'request_approved',
          jsonb_build_object('request_id', p_request_id));

  return v_task_id;
end;
$$;
