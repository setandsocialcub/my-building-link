ALTER TABLE public.resident_profiles ADD COLUMN IF NOT EXISTS accepted_terms_version integer;
ALTER TABLE public.resident_profiles ADD COLUMN IF NOT EXISTS accepted_privacy_version integer;