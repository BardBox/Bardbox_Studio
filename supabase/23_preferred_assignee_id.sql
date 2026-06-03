ALTER TABLE public.content_rows
  ADD COLUMN IF NOT EXISTS preferred_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
