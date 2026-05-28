DROP VIEW IF EXISTS public.resident_public_profiles;
CREATE VIEW public.resident_public_profiles
WITH (security_invoker = on) AS
  SELECT id, building_id, first_name, job_title, interest_tags, created_at
  FROM public.resident_profiles;

GRANT SELECT ON public.resident_public_profiles TO authenticated;