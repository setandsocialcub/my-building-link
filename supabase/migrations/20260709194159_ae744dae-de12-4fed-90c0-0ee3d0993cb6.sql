
-- 1) Prevent building_id from being changed on resident_profiles updates (unless admin/manager)
CREATE OR REPLACE FUNCTION public.prevent_resident_building_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.building_id IS DISTINCT FROM OLD.building_id THEN
    IF NOT (public.has_role(auth.uid(), 'admin')
            OR public.is_manager_of_building(OLD.building_id)
            OR public.is_manager_of_building(NEW.building_id)) THEN
      RAISE EXCEPTION 'Changing building_id is not allowed';
    END IF;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Changing user_id is not allowed';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_resident_building_change ON public.resident_profiles;
CREATE TRIGGER trg_prevent_resident_building_change
  BEFORE UPDATE ON public.resident_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_resident_building_change();

-- 2) Replace INSERT policy: only admins/managers can insert directly. Residents
--    must onboard via the SECURITY DEFINER RPC below, which validates the
--    building access code.
DROP POLICY IF EXISTS "Users create their own profile for a known building" ON public.resident_profiles;

CREATE POLICY "Admins and managers create resident profiles"
  ON public.resident_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of_building(building_id)
  );

-- 3) SECURITY DEFINER onboarding RPC — validates access_code before insert.
CREATE OR REPLACE FUNCTION public.join_building_as_resident(
  _access_code text,
  _first_name text,
  _last_name text DEFAULT NULL,
  _job_title text DEFAULT NULL,
  _interest_tags text[] DEFAULT ARRAY[]::text[],
  _privacy_level text DEFAULT 'public',
  _accepted_terms_at timestamptz DEFAULT NULL,
  _accepted_privacy_at timestamptz DEFAULT NULL,
  _accepted_terms_version text DEFAULT NULL,
  _accepted_privacy_version text DEFAULT NULL
)
RETURNS TABLE(profile_id uuid, building_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _building_id uuid;
  _normalized text;
  _existing_id uuid;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;
  IF _first_name IS NULL OR btrim(_first_name) = '' THEN
    RAISE EXCEPTION 'First name is required';
  END IF;

  _normalized := upper(regexp_replace(coalesce(_access_code, ''), '[^A-Za-z0-9]', '', 'g'));
  IF length(_normalized) = 6 THEN
    _normalized := substr(_normalized,1,3) || '-' || substr(_normalized,4,3);
  END IF;

  SELECT b.id INTO _building_id FROM public.buildings b WHERE b.access_code = _normalized LIMIT 1;
  IF _building_id IS NULL THEN
    RAISE EXCEPTION 'Invalid building access code';
  END IF;

  -- If a profile already exists for this user+building, return it (idempotent).
  SELECT rp.id INTO _existing_id
  FROM public.resident_profiles rp
  WHERE rp.user_id = _uid AND rp.building_id = _building_id
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    RETURN QUERY SELECT _existing_id, _building_id;
    RETURN;
  END IF;

  INSERT INTO public.resident_profiles (
    user_id, building_id, first_name, last_name, job_title,
    interest_tags, privacy_level,
    accepted_terms_at, accepted_privacy_at,
    accepted_terms_version, accepted_privacy_version
  ) VALUES (
    _uid, _building_id, btrim(_first_name),
    NULLIF(btrim(coalesce(_last_name,'')), ''),
    NULLIF(btrim(coalesce(_job_title,'')), ''),
    coalesce(_interest_tags, ARRAY[]::text[]),
    coalesce(_privacy_level, 'public'),
    _accepted_terms_at, _accepted_privacy_at,
    _accepted_terms_version, _accepted_privacy_version
  )
  RETURNING id INTO _new_id;

  RETURN QUERY SELECT _new_id, _building_id;
END $$;

REVOKE ALL ON FUNCTION public.join_building_as_resident(text, text, text, text, text[], text, timestamptz, timestamptz, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_building_as_resident(text, text, text, text, text[], text, timestamptz, timestamptz, text, text) TO authenticated;
