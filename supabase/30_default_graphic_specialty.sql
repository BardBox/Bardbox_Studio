-- =============================================================
-- 30_default_graphic_specialty.sql
-- Designers with no specialty set default to graphic_designer.
-- Video editors must be set explicitly; without a specialty,
-- a designer is assumed to handle graphic/static/carousel work.
-- =============================================================

-- Fix existing designers with NULL specialty
UPDATE public.profiles
SET specialty = 'graphic_designer'
WHERE role = 'designer'
  AND is_active = true
  AND specialty IS NULL;

-- Update the seed trigger so new designers also default to graphic_designer
CREATE OR REPLACE FUNCTION public.seed_user_content_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Default new designers to graphic_designer if not explicitly set
  IF NEW.role = 'designer' AND NEW.specialty IS NULL THEN
    UPDATE public.profiles SET specialty = 'graphic_designer' WHERE id = NEW.id;
    NEW.specialty := 'graphic_designer';
  END IF;

  IF NEW.role IN ('designer', 'smo') THEN
    INSERT INTO public.user_content_capacity (user_id, content_type, task_type, daily_cap)
    SELECT
      NEW.id,
      uct.content_type,
      uct.task_type,
      uct.default_cap
    FROM public.user_content_capacity_template uct
    ON CONFLICT (user_id, content_type, task_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
