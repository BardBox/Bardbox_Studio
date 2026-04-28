-- =============================================================
-- 11_ai_settings.sql
-- AI provider configuration and custom training knowledge base.
-- Run after 10_developer_role.sql
-- =============================================================

-- ---------------------------------------------------------------
-- 1. AI provider settings (one active row = current config)
-- ---------------------------------------------------------------
create table if not exists public.ai_settings (
  id           serial primary key,
  provider     text    not null default 'gemini'
                 check (provider in ('gemini','ollama','openai')),
  model        text    not null default 'gemini-2.0-flash',
  base_url     text,          -- required for ollama / custom openai
  api_key      text,          -- null = use GEMINI_API_KEY env var
  is_active    boolean not null default true,
  updated_by   uuid    references public.profiles(id) on delete set null,
  updated_at   timestamptz default now()
);

-- Seed default row (uses env var key)
insert into public.ai_settings (provider, model)
values ('gemini', 'gemini-2.0-flash')
on conflict do nothing;

-- ---------------------------------------------------------------
-- 2. Training / knowledge base documents
--    Injected into AI system prompts to "train" the AI on your
--    brand, clients, workflow and creative direction.
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------
alter table public.ai_settings       enable row level security;
alter table public.ai_training_docs  enable row level security;

-- All authenticated users can read (needed for AI routes that run server-side)
create policy "authenticated_read_ai_settings"
  on public.ai_settings for select
  using (auth.role() = 'authenticated');

create policy "authenticated_read_ai_training"
  on public.ai_training_docs for select
  using (auth.role() = 'authenticated');

-- Only admin / manager can write
create policy "admin_write_ai_settings"
  on public.ai_settings for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','manager')
    )
  );

create policy "admin_write_ai_training"
  on public.ai_training_docs for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','manager')
    )
  );
