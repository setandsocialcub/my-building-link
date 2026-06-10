ALTER TABLE public.building_branding
  ADD COLUMN IF NOT EXISTS draft jsonb,
  ADD COLUMN IF NOT EXISTS draft_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;