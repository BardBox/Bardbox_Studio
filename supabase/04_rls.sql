-- =============================================================
-- 04_rls.sql
-- Row-Level Security — who can see and modify what.
-- Run after 03_views.sql.
-- =============================================================

-- Helper: current user's role
create or replace function public.current_user_role()
returns text
language sql stable security definer
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_manager()
returns boolean
language sql stable security definer
as $$
  select coalesce((select role in ('manager','admin') from public.profiles where id = auth.uid()), false);
$$;


alter table public.profiles       enable row level security;
alter table public.content_rows   enable row level security;
alter table public.tasks          enable row level security;
alter table public.attachments    enable row level security;
alter table public.activity_log   enable row level security;
alter table public.buffer_config  enable row level security;


-- ---------------- profiles ----------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() is not null);

drop policy if exists profiles_manager_write on public.profiles;
create policy profiles_manager_write on public.profiles
  for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());


-- ---------------- content_rows ----------------
drop policy if exists content_rows_manager_all on public.content_rows;
create policy content_rows_manager_all on public.content_rows
  for all using (public.is_manager()) with check (public.is_manager());

-- team members see only rows where they have a task
drop policy if exists content_rows_team_select on public.content_rows;
create policy content_rows_team_select on public.content_rows
  for select using (
    exists (
      select 1 from public.tasks
      where content_row_id = content_rows.id
        and assignee_id = auth.uid()
    )
  );


-- ---------------- tasks ----------------
drop policy if exists tasks_manager_all on public.tasks;
create policy tasks_manager_all on public.tasks
  for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists tasks_self_select on public.tasks;
create policy tasks_self_select on public.tasks
  for select using (assignee_id = auth.uid());

-- team members can update status + blocked_reason on their own tasks
drop policy if exists tasks_self_update on public.tasks;
create policy tasks_self_update on public.tasks
  for update using (assignee_id = auth.uid())
  with check (assignee_id = auth.uid());


-- ---------------- attachments ----------------
drop policy if exists attachments_manager_all on public.attachments;
create policy attachments_manager_all on public.attachments
  for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists attachments_task_owner on public.attachments;
create policy attachments_task_owner on public.attachments
  for all using (
    exists (select 1 from public.tasks where id = attachments.task_id and assignee_id = auth.uid())
  ) with check (
    exists (select 1 from public.tasks where id = attachments.task_id and assignee_id = auth.uid())
  );


-- ---------------- activity_log ----------------
drop policy if exists activity_log_manager_all on public.activity_log;
create policy activity_log_manager_all on public.activity_log
  for select using (public.is_manager());

drop policy if exists activity_log_self_select on public.activity_log;
create policy activity_log_self_select on public.activity_log
  for select using (
    exists (select 1 from public.tasks where id = activity_log.task_id and assignee_id = auth.uid())
  );

-- inserts come from triggers (security definer) or service role; no direct insert policy needed
drop policy if exists activity_log_insert_block on public.activity_log;
create policy activity_log_insert_block on public.activity_log
  for insert with check (false);


-- ---------------- buffer_config ----------------
drop policy if exists buffer_config_select on public.buffer_config;
create policy buffer_config_select on public.buffer_config
  for select using (auth.uid() is not null);

drop policy if exists buffer_config_manager_write on public.buffer_config;
create policy buffer_config_manager_write on public.buffer_config
  for all using (public.is_manager()) with check (public.is_manager());
