-- =============================================================
-- 26_test_seed.sql
-- Test content rows for specialty-based auto-assign verification
-- NO preferred_assignee_id — let auto_assign_with_daily_cap decide
--
-- Expected routing after "Create Tasks":
--   content_type = reel    → video_editor  (Jignesh)
--   content_type = carousel
--               = static   → graphic_designer (Dhairya)
-- =============================================================

INSERT INTO public.content_rows
  (client_name, platform, content_type, brief, caption, hashtags,
   reference_urls, posting_date, posting_time, status, source)
VALUES
  -- Reel #1 → video_editor
  ('Demo Client', 'Instagram', 'reel',
   'Hook idea for this reel',
   'Your caption goes here...',
   '#brand #social',
   '{}', '2026-06-08', '10:00:00', 'pending', 'in_app'),

  -- Carousel → graphic_designer
  ('Demo Client', 'Instagram', 'carousel',
   'Topic for the carousel slides',
   NULL, NULL,
   '{}', '2026-06-10', '09:00:00', 'pending', 'in_app'),

  -- Static Post (same posting day as carousel) → graphic_designer
  ('Demo Client', 'Instagram', 'static',
   'Quote post — same day',
   NULL, NULL,
   '{}', '2026-06-10', '14:00:00', 'pending', 'in_app'),

  -- Reel #2 → video_editor
  ('Demo Client', 'Instagram', 'reel',
   'Another reel idea',
   'Caption goes here...',
   NULL,
   '{}', '2026-06-12', '10:00:00', 'pending', 'in_app'),

  -- Static Post → graphic_designer
  ('Demo Client', 'Instagram', 'static',
   'Brand awareness static',
   NULL,
   '#branding',
   '{}', '2026-06-15', '11:00:00', 'pending', 'in_app');

-- ── How to test ──────────────────────────────────────────────
-- 1. Run migration 25 first (if not already done) to set specialties
-- 2. Run this file in Supabase SQL Editor
-- 3. Go to Manager → Content tab → filter client = "Demo Client"
-- 4. Select all 5 rows → click "Create Tasks"
-- 5. Check AllTasksTable:
--    reel rows    → assigned to Jignesh  (🎬 Video Editor badge)
--    carousel/static → assigned to Dhairya (🎨 Graphic badge)
