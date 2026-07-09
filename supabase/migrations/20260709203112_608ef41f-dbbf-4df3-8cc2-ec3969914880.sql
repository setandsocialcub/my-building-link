CREATE OR REPLACE FUNCTION public.join_building_as_resident(
  _access_code text,
  _first_name text,
  _last_name text DEFAULT NULL,
  _job_title text DEFAULT NULL,
  _interest_tags text[] DEFAULT ARRAY[]::text[],
  _privacy_level text DEFAULT 'public',
  _accepted_terms_at timestamptz DEFAULT NULL,
  _accepted_privacy_at timestamptz DEFAULT NULL,
  _accepted_terms_version integer DEFAULT NULL,
  _accepted_privacy_version integer DEFAULT NULL
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
  _pl public.privacy_level;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;
  IF _first_name IS NULL OR btrim(_first_name) = '' THEN
    RAISE EXCEPTION 'First name is required';
  END IF;

  BEGIN
    _pl := coalesce(_privacy_level, 'public')::public.privacy_level;
  EXCEPTION WHEN invalid_text_representation THEN
    _pl := 'public'::public.privacy_level;
  END;

  _normalized := upper(regexp_replace(coalesce(_access_code, ''), '[^A-Za-z0-9]', '', 'g'));
  IF length(_normalized) = 6 THEN
    _normalized := substr(_normalized,1,3) || '-' || substr(_normalized,4,3);
  END IF;

  SELECT b.id INTO _building_id FROM public.buildings b WHERE b.access_code = _normalized LIMIT 1;
  IF _building_id IS NULL THEN
    RAISE EXCEPTION 'Invalid building access code';
  END IF;

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
    _pl,
    _accepted_terms_at, _accepted_privacy_at,
    _accepted_terms_version, _accepted_privacy_version
  )
  RETURNING id INTO _new_id;

  RETURN QUERY SELECT _new_id, _building_id;
END $$;