
ALTER TABLE public.resident_profiles
  ADD COLUMN IF NOT EXISTS network_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS network_audience text NOT NULL DEFAULT 'building',
  ADD COLUMN IF NOT EXISTS professional_title text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS professional_category text,
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS service_bio text,
  ADD COLUMN IF NOT EXISTS services_offered text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS community_goals text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS expert_badges text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS portfolio_url text,
  ADD COLUMN IF NOT EXISTS calendly_url text,
  ADD COLUMN IF NOT EXISTS business_email text,
  ADD COLUMN IF NOT EXISTS business_phone text,
  ADD COLUMN IF NOT EXISTS business_logo_path text;

ALTER TABLE public.resident_profiles
  ADD CONSTRAINT resident_profiles_network_audience_check
  CHECK (network_audience IN ('everyone','building','circles','searchable_only','hidden'));

CREATE INDEX IF NOT EXISTS idx_resident_profiles_network
  ON public.resident_profiles (building_id, network_visible)
  WHERE network_visible = true;

CREATE INDEX IF NOT EXISTS idx_resident_profiles_category
  ON public.resident_profiles (building_id, professional_category)
  WHERE network_visible = true;
