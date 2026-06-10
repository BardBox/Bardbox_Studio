-- Migration 39: Ensure every system role has a row in the roles table
-- with correct capability flags.
--
-- Without these rows, getRoleFlags() returns all-false for admin/manager/ceo,
-- which hides the Calendar tab and blocks admins from seeing any content.
--
-- Safe to re-run: ON CONFLICT DO UPDATE keeps flags current.

INSERT INTO public.roles (key, label, is_designer_type, is_video_type, is_privileged, can_redistribute)
VALUES
  ('designer',     'Designer',         true,  false, false, false),
  ('video_editor', 'Video Editor',     false, true,  false, false),
  ('smo',          'Social Media Ops', false, false, true,  false),
  ('manager',      'Manager',          false, false, true,  true),
  ('admin',        'Admin',            false, false, true,  true),
  ('ceo',          'CEO',              false, false, true,  true),
  ('hr',           'HR',               false, false, false, false),
  ('developer',    'Developer',        false, false, false, false)
ON CONFLICT (key) DO UPDATE SET
  is_designer_type = EXCLUDED.is_designer_type,
  is_video_type    = EXCLUDED.is_video_type,
  is_privileged    = EXCLUDED.is_privileged,
  can_redistribute = EXCLUDED.can_redistribute;
