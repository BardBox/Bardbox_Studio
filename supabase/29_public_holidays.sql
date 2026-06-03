-- =============================================================
-- 29_public_holidays.sql
-- Public holidays table + updated exclusion logic
-- =============================================================

CREATE TABLE IF NOT EXISTS public.public_holidays (
  id          serial PRIMARY KEY,
  holiday_date date NOT NULL UNIQUE,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read holidays"
  ON public.public_holidays FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin manage holidays"
  ON public.public_holidays FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Updated exclusion function — now also checks public_holidays table
-- Changed from IMMUTABLE to STABLE since it queries the DB
CREATE OR REPLACE FUNCTION public.is_excluded_posting_day(p_date date)
RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
BEGIN
  -- Weekly off: all Sundays
  IF EXTRACT(DOW FROM p_date) = 0 THEN RETURN true; END IF;
  -- 1st Saturday
  IF EXTRACT(DOW FROM p_date) = 6 AND EXTRACT(DAY FROM p_date) BETWEEN 1  AND 7  THEN RETURN true; END IF;
  -- 3rd Saturday
  IF EXTRACT(DOW FROM p_date) = 6 AND EXTRACT(DAY FROM p_date) BETWEEN 15 AND 21 THEN RETURN true; END IF;
  -- Public holiday
  IF EXISTS (SELECT 1 FROM public.public_holidays WHERE holiday_date = p_date) THEN RETURN true; END IF;
  RETURN false;
END;
$$;

-- Grant access to role
GRANT SELECT ON public.public_holidays TO authenticated;
GRANT ALL ON public.public_holidays TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.public_holidays_id_seq TO authenticated;

-- Add /admin/holidays to role_permissions
INSERT INTO public.role_permissions (role, route, enabled) VALUES
  ('admin',    '/admin/holidays', true),
  ('manager',  '/admin/holidays', true),
  ('ceo',      '/admin/holidays', false),
  ('designer', '/admin/holidays', false),
  ('smo',      '/admin/holidays', false),
  ('hr',       '/admin/holidays', false),
  ('developer','/admin/holidays', false)
ON CONFLICT (role, route) DO UPDATE SET enabled = EXCLUDED.enabled;
