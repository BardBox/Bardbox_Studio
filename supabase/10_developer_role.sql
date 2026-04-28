-- =============================================================
-- 10_developer_role.sql
-- Add 'developer' to allowed roles.
-- Run before creating Aadil's account.
-- =============================================================

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('designer','smo','manager','admin','ceo','hr','developer'));
