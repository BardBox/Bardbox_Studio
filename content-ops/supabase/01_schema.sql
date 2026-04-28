-- =============================================================
-- 01_schema.sql
-- Core tables for ContentOps
-- Run this first.
-- =============================================================

-- Profiles extend auth.users with role + agency data
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('designer', 'smo', 'manager', 'admin')),
  whatsapp_number text,
  email text,
  is_active boolean not null default true,
  max_concurrent_tasks int default 10,  -- used by auto-assign to cap load
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_active_idx
  on public.profiles(role, is_active) where is_active = true;


-- Buffer config: how many days BEFORE posting the creative must be done
-- Keyed by platform + content_type so you can tune per format.
create table if not exists public.buffer_config (
  id bigserial primary key,
  platform text not null,
  content_type text not null,
  design_buffer_days int not null default 3,   -- creative must be ready by posting − N days
  review_buffer_days int not null default 1,   -- extra review window on top
  created_at timestamptz not null default now(),
  unique(platform, content_type)
);


-- Content rows: a row per Google Sheet row
-- Inserts/updates here come from the /api/sheets/webhook endpoint.
create table if not exists public.content_rows (
  id bigserial primary key,
  sheet_row_id text unique not null,           -- stable UUID from the Sheet's _id column
  client_name text,
  platform text not null,
  content_type text not null,
  brief text,
  caption text,
  hashtags text,
  reference_urls text[] default '{}',
  posting_date date not null,
  posting_time time default '10:00:00',
  status text not null default 'draft'
    check (status in ('draft','in_design','in_review','approved','scheduled','posted','cancelled')),
  sheet_last_updated timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_rows_posting_date_idx on public.content_rows(posting_date);
create index if not exists content_rows_status_idx on public.content_rows(status);


-- Tasks: one design + one post per content row (enforced by unique constraint)
create table if not exists public.tasks (
  id bigserial primary key,
  content_row_id bigint not null references public.content_rows(id) on delete cascade,
  task_type text not null check (task_type in ('design', 'post')),
  assignee_id uuid references public.profiles(id) on delete set null,
  manually_assigned boolean not null default false,   -- locks out auto-reassign
  internal_deadline timestamptz not null,
  status text not null default 'todo'
    check (status in ('todo','in_progress','submitted','approved','done','blocked')),
  blocked_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(content_row_id, task_type)
);

create index if not exists tasks_assignee_status_idx on public.tasks(assignee_id, status);
create index if not exists tasks_deadline_idx on public.tasks(internal_deadline) where status not in ('done','approved');
create index if not exists tasks_content_row_idx on public.tasks(content_row_id);


-- Attachments: creatives, references, revisions — will be expanded in Phase 3 (Supabase Storage)
create table if not exists public.attachments (
  id bigserial primary key,
  task_id bigint not null references public.tasks(id) on delete cascade,
  file_url text not null,
  file_name text,
  file_type text check (file_type in ('creative','reference','revision','final')),
  uploaded_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);


-- Activity log for audit + future notifications
create table if not exists public.activity_log (
  id bigserial primary key,
  task_id bigint references public.tasks(id) on delete cascade,
  content_row_id bigint references public.content_rows(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,       -- e.g. 'task_created','status_changed','reassigned'
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_task_idx on public.activity_log(task_id, created_at desc);


-- Generic updated_at trigger
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_content_rows on public.content_rows;
create trigger touch_content_rows before update on public.content_rows
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_tasks on public.tasks;
create trigger touch_tasks before update on public.tasks
  for each row execute function public.touch_updated_at();
