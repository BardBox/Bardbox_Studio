-- Migration 37: Add capability flags to roles table so code never
-- needs to hardcode role names. Any new role gets these flags set
-- via the admin UI and everything works automatically.

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS is_designer_type  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_privileged     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_redistribute  boolean NOT NULL DEFAULT false;

-- designer-type: does design tasks, appears in designer pools
UPDATE public.roles SET is_designer_type = true  WHERE key IN ('designer', 'video_editor');

-- privileged: can view/import content calendar, see all tasks
UPDATE public.roles SET is_privileged = true     WHERE key IN ('admin', 'manager', 'smo', 'ceo');

-- can_redistribute: can bulk-redistribute tasks across the month
UPDATE public.roles SET can_redistribute = true  WHERE key IN ('admin', 'manager', 'ceo');

-- View: profiles joined with their role flags
CREATE OR REPLACE VIEW public.profile_with_flags AS
SELECT
  p.*,
  COALESCE(r.is_designer_type,  false) AS is_designer_type,
  COALESCE(r.is_privileged,     false) AS is_privileged,
  COALESCE(r.can_redistribute,  false) AS can_redistribute
FROM public.profiles p
LEFT JOIN public.roles r ON r.key = p.role;
