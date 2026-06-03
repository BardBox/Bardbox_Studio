-- =============================================================
-- 20_content_types.sql
-- Admin-managed content type registry
-- =============================================================

CREATE TABLE IF NOT EXISTS public.content_types (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key          text NOT NULL UNIQUE,
  label        text NOT NULL,
  for_designer boolean NOT NULL DEFAULT true,
  for_smo      boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_content_types" ON public.content_types;
CREATE POLICY "admin_manage_content_types" ON public.content_types
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'ceo'));

DROP POLICY IF EXISTS "all_read_content_types" ON public.content_types;
CREATE POLICY "all_read_content_types" ON public.content_types
  FOR SELECT TO authenticated
  USING (true);

-- Seed from existing hardcoded values
INSERT INTO public.content_types (key, label, for_designer, for_smo, sort_order) VALUES
  ('carousel',    'Carousel',    true,  true,  1),
  ('static',      'Static',      true,  true,  2),
  ('story',       'Story',       true,  true,  3),
  ('infographic', 'Infographic', true,  false, 4),
  ('thumbnail',   'Thumbnail',   true,  true,  5),
  ('flyer',       'Flyer',       true,  false, 6),
  ('logo',        'Logo',        true,  false, 7),
  ('reel_cover',  'Reel Cover',  true,  false, 8),
  ('reel',        'Reel',        true,  true,  9),
  ('youtube',     'YouTube',     true,  true,  10),
  ('thread',      'Thread',      false, true,  11),
  ('linkedin',    'LinkedIn',    false, true,  12)
ON CONFLICT (key) DO NOTHING;
