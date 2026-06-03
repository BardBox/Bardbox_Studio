-- =============================================================
-- 21_preferred_designer.sql
-- Adds preferred_designer_name to content_rows so that
-- when tasks are created from an imported template, the
-- named designer is automatically assigned to the design task.
-- =============================================================

ALTER TABLE public.content_rows
  ADD COLUMN IF NOT EXISTS preferred_assignee_name text;
