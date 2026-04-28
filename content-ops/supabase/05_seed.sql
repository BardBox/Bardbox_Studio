-- =============================================================
-- 05_seed.sql
-- Default buffer configurations per platform × content_type.
-- Tweak these numbers as your team learns what's realistic.
-- =============================================================

insert into public.buffer_config (platform, content_type, design_buffer_days, review_buffer_days) values
  ('instagram', 'post',      2, 1),
  ('instagram', 'reel',      4, 1),
  ('instagram', 'story',     1, 0),
  ('instagram', 'carousel',  3, 1),
  ('facebook',  'post',      2, 1),
  ('facebook',  'reel',      4, 1),
  ('linkedin',  'post',      3, 1),
  ('linkedin',  'article',   5, 2),
  ('twitter',   'post',      1, 0),
  ('youtube',   'video',     7, 2),
  ('youtube',   'short',     3, 1)
on conflict (platform, content_type) do nothing;
