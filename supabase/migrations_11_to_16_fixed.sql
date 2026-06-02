-- ============================================================
-- migrations_11_to_16_fixed.sql
-- Run this — migrations 08-10 already applied.
-- DROP POLICY IF EXISTS added before each CREATE POLICY.
-- ============================================================


-- ============================================================
-- 11_ai_settings.sql
-- ============================================================
create table if not exists public.ai_settings (
  id           serial primary key,
  provider     text    not null default 'gemini'
                 check (provider in ('gemini','ollama','openai')),
  model        text    not null default 'gemini-2.0-flash',
  base_url     text,
  api_key      text,
  is_active    boolean not null default true,
  updated_by   uuid    references public.profiles(id) on delete set null,
  updated_at   timestamptz default now()
);

insert into public.ai_settings (provider, model)
values ('gemini', 'gemini-2.0-flash')
on conflict do nothing;

create table if not exists public.ai_training_docs (
  id         serial primary key,
  title      text    not null,
  category   text    not null default 'general'
               check (category in ('brand_guidelines','client_info','workflow','creative_direction','general')),
  content    text    not null,
  is_active  boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ai_settings       enable row level security;
alter table public.ai_training_docs  enable row level security;

drop policy if exists "authenticated_read_ai_settings" on public.ai_settings;
create policy "authenticated_read_ai_settings"
  on public.ai_settings for select
  using (auth.role() = 'authenticated');

drop policy if exists "authenticated_read_ai_training" on public.ai_training_docs;
create policy "authenticated_read_ai_training"
  on public.ai_training_docs for select
  using (auth.role() = 'authenticated');

drop policy if exists "admin_write_ai_settings" on public.ai_settings;
create policy "admin_write_ai_settings"
  on public.ai_settings for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','manager')
    )
  );

drop policy if exists "admin_write_ai_training" on public.ai_training_docs;
create policy "admin_write_ai_training"
  on public.ai_training_docs for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','manager')
    )
  );


-- ============================================================
-- 12_role_permissions.sql
-- ============================================================
create table if not exists role_permissions (
  role    text    not null,
  route   text    not null,
  enabled boolean not null default true,
  primary key (role, route)
);

alter table role_permissions enable row level security;

drop policy if exists "admin full access" on role_permissions;
create policy "admin full access"
  on role_permissions for all
  using  (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "authenticated read" on role_permissions;
create policy "authenticated read"
  on role_permissions for select
  using (auth.role() = 'authenticated');

insert into role_permissions (role, route, enabled) values
  ('manager', '/manager',          true),
  ('manager', '/manager/tasks',    true),
  ('manager', '/manager/requests', true),
  ('manager', '/manager/clients',  true),
  ('manager', '/request-task',     true),
  ('manager', '/content',          true),
  ('manager', '/admin/team',       true),
  ('manager', '/hr',               true),
  ('manager', '/smo',              false),
  ('manager', '/designer',         false),
  ('manager', '/ceo',              false),
  ('manager', '/ceo/approvals',    false),
  ('manager', '/admin/roles',      false),
  ('manager', '/admin/settings',   false),
  ('manager', '/admin/permissions',false),
  ('admin', '/manager',          true),
  ('admin', '/manager/tasks',    true),
  ('admin', '/manager/requests', true),
  ('admin', '/manager/clients',  true),
  ('admin', '/request-task',     true),
  ('admin', '/content',          true),
  ('admin', '/smo',              true),
  ('admin', '/designer',         true),
  ('admin', '/ceo',              false),
  ('admin', '/ceo/approvals',    false),
  ('admin', '/admin/team',       true),
  ('admin', '/hr',               true),
  ('admin', '/admin/roles',      true),
  ('admin', '/admin/settings',   true),
  ('admin', '/admin/permissions',true),
  ('ceo', '/manager',           false),
  ('ceo', '/manager/tasks',     false),
  ('ceo', '/manager/requests',  false),
  ('ceo', '/manager/clients',   false),
  ('ceo', '/request-task',      false),
  ('ceo', '/content',           true),
  ('ceo', '/smo',               false),
  ('ceo', '/designer',          false),
  ('ceo', '/ceo',               true),
  ('ceo', '/ceo/approvals',     true),
  ('ceo', '/admin/team',        true),
  ('ceo', '/hr',                false),
  ('ceo', '/admin/roles',       false),
  ('ceo', '/admin/settings',    false),
  ('ceo', '/admin/permissions', false),
  ('smo', '/manager',           false),
  ('smo', '/manager/tasks',     false),
  ('smo', '/manager/requests',  false),
  ('smo', '/manager/clients',   false),
  ('smo', '/request-task',      true),
  ('smo', '/content',           true),
  ('smo', '/smo',               true),
  ('smo', '/designer',          false),
  ('smo', '/ceo',               false),
  ('smo', '/ceo/approvals',     false),
  ('smo', '/admin/team',        false),
  ('smo', '/hr',                false),
  ('smo', '/admin/roles',       false),
  ('smo', '/admin/settings',    false),
  ('smo', '/admin/permissions', false),
  ('designer', '/manager',           false),
  ('designer', '/manager/tasks',     false),
  ('designer', '/manager/requests',  false),
  ('designer', '/manager/clients',   false),
  ('designer', '/request-task',      true),
  ('designer', '/content',           true),
  ('designer', '/smo',               false),
  ('designer', '/designer',          true),
  ('designer', '/ceo',               false),
  ('designer', '/ceo/approvals',     false),
  ('designer', '/admin/team',        false),
  ('designer', '/hr',                false),
  ('designer', '/admin/roles',       false),
  ('designer', '/admin/settings',    false),
  ('designer', '/admin/permissions', false),
  ('hr', '/manager',           false),
  ('hr', '/manager/tasks',     false),
  ('hr', '/manager/requests',  false),
  ('hr', '/manager/clients',   false),
  ('hr', '/request-task',      false),
  ('hr', '/content',           false),
  ('hr', '/smo',               false),
  ('hr', '/designer',          false),
  ('hr', '/ceo',               false),
  ('hr', '/ceo/approvals',     false),
  ('hr', '/admin/team',        true),
  ('hr', '/hr',                true),
  ('hr', '/admin/roles',       false),
  ('hr', '/admin/settings',    false),
  ('hr', '/admin/permissions', false),
  ('developer', '/manager',           true),
  ('developer', '/manager/tasks',     true),
  ('developer', '/manager/requests',  false),
  ('developer', '/manager/clients',   false),
  ('developer', '/request-task',      true),
  ('developer', '/content',           false),
  ('developer', '/smo',               false),
  ('developer', '/designer',          false),
  ('developer', '/ceo',               false),
  ('developer', '/ceo/approvals',     false),
  ('developer', '/admin/team',        false),
  ('developer', '/hr',                false),
  ('developer', '/admin/roles',       true),
  ('developer', '/admin/settings',    true),
  ('developer', '/admin/permissions', false)
on conflict (role, route) do nothing;


-- ============================================================
-- 13_cloudinary_urls.sql
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS logo_url   TEXT;


-- ============================================================
-- 14_employee_fields.sql
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS designation       TEXT,
  ADD COLUMN IF NOT EXISTS date_of_joining   DATE,
  ADD COLUMN IF NOT EXISTS employment_type   TEXT CHECK (employment_type IN ('full-time','part-time','freelance','intern')),
  ADD COLUMN IF NOT EXISTS date_of_birth     DATE,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT;


-- ============================================================
-- 15_leave_conflicts.sql
-- ============================================================

-- Drop constraint first, rename rows, then re-add with new values
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

UPDATE public.tasks SET status = 'working_on_it' WHERE status = 'in_progress';

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'todo', 'assigned', 'working_on_it', 'on_hold',
    'submitted', 'approved', 'done', 'blocked',
    'adjusted_before', 'adjusted_after'
  ));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS original_deadline timestamptz;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS adjustment_reason text;

CREATE TABLE IF NOT EXISTS public.leave_conflict_tasks (
  id               bigserial PRIMARY KEY,
  leave_request_id bigint NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  task_id          bigint NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  ai_suggestion    text CHECK (ai_suggestion IN ('before', 'after', 'reassign')),
  ai_reasoning     text,
  resolution       text NOT NULL DEFAULT 'pending'
                   CHECK (resolution IN ('pending', 'before', 'after', 'reassign')),
  resolved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(leave_request_id, task_id)
);

CREATE INDEX IF NOT EXISTS leave_conflict_leave_idx
  ON public.leave_conflict_tasks(leave_request_id);

CREATE INDEX IF NOT EXISTS leave_conflict_pending_idx
  ON public.leave_conflict_tasks(resolution)
  WHERE resolution = 'pending';

CREATE OR REPLACE VIEW public.pending_approvals AS
SELECT *
FROM public.task_pipeline_health
WHERE task_status = 'submitted'
ORDER BY internal_deadline ASC;


-- ============================================================
-- 16_ai_providers_extended.sql
-- ============================================================
ALTER TABLE public.ai_settings
  DROP CONSTRAINT IF EXISTS ai_settings_provider_check;

ALTER TABLE public.ai_settings
  ADD CONSTRAINT ai_settings_provider_check
  CHECK (provider IN ('gemini', 'groq', 'anthropic', 'openai', 'ollama'));