-- Migration 36: Make video_editor a proper first-class role.
-- The profiles.role check constraint previously excluded it, causing silent
-- conversion to 'designer' on every save. This migration adds it properly.

-- 1. Extend the check constraint to include video_editor
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('designer','smo','manager','admin','ceo','hr','developer','video_editor'));
