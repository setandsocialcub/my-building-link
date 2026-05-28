CREATE TABLE public.resident_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  job_title text,
  interest_tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_resident_profiles_building ON public.resident_profiles(building_id);

GRANT SELECT, INSERT ON public.resident_profiles TO anon, authenticated;
GRANT ALL ON public.resident_profiles TO service_role;

ALTER TABLE public.resident_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create resident profiles"
ON public.resident_profiles FOR INSERT
TO public WITH CHECK (true);

CREATE POLICY "Anyone can read resident profiles"
ON public.resident_profiles FOR SELECT
TO public USING (true);

-- Public view that hides last_name for community/building views
CREATE VIEW public.resident_public_profiles
WITH (security_invoker = true) AS
SELECT id, building_id, first_name, job_title, interest_tags, created_at
FROM public.resident_profiles;

GRANT SELECT ON public.resident_public_profiles TO anon, authenticated;