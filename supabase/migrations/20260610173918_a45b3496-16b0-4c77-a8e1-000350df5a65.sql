
-- 1. Enum + column
DO $$ BEGIN
  CREATE TYPE public.privacy_level AS ENUM ('public','introduction_only','circle_only','limited');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.resident_profiles
  ADD COLUMN IF NOT EXISTS privacy_level public.privacy_level NOT NULL DEFAULT 'public';

-- 2. Helper: viewer and target share an accepted intro OR connection
CREATE OR REPLACE FUNCTION public.has_accepted_intro_with(_target_profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resident_introductions ri
    JOIN public.resident_profiles me ON me.user_id = auth.uid()
    WHERE ri.status = 'accepted'
      AND ((ri.requester_id = me.id AND ri.recipient_id = _target_profile)
        OR (ri.recipient_id = me.id AND ri.requester_id = _target_profile))
  ) OR EXISTS (
    SELECT 1
    FROM public.connections c
    JOIN public.resident_profiles me ON me.user_id = auth.uid()
    WHERE c.status = 'accepted'
      AND ((c.requester_id = me.id AND c.addressee_id = _target_profile)
        OR (c.addressee_id = me.id AND c.requester_id = _target_profile))
  );
$$;

-- 3. Helper: viewer and target share at least one circle
CREATE OR REPLACE FUNCTION public.shares_circle_with_profile(_target_profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm_me
    JOIN public.group_members gm_them ON gm_me.group_id = gm_them.group_id
    JOIN public.resident_profiles tp ON tp.user_id = gm_them.user_id
    WHERE gm_me.user_id = auth.uid()
      AND tp.id = _target_profile
  );
$$;

-- 4. Visibility resolver: 'self' | 'full' | 'limited' | 'discover' | 'hidden'
CREATE OR REPLACE FUNCTION public.profile_visibility(_profile_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  SELECT id, user_id, building_id, privacy_level, is_visible
    INTO p FROM public.resident_profiles WHERE id = _profile_id;
  IF NOT FOUND THEN RETURN 'hidden'; END IF;

  IF auth.uid() IS NULL THEN RETURN 'hidden'; END IF;
  IF p.user_id = auth.uid() THEN RETURN 'self'; END IF;

  -- Managers of the building and platform admins always get full access
  IF public.is_manager_of_building(p.building_id) OR public.has_role(auth.uid(), 'admin') THEN
    RETURN 'full';
  END IF;

  -- Must be a co-resident of the same building
  IF NOT public.is_resident_of_building(p.building_id) THEN RETURN 'hidden'; END IF;

  -- Owner has deactivated themselves
  IF NOT p.is_visible THEN RETURN 'hidden'; END IF;

  -- Accepted introduction or accepted connection ALWAYS unlocks full
  IF public.has_accepted_intro_with(p.id) THEN RETURN 'full'; END IF;

  CASE p.privacy_level
    WHEN 'public'            THEN RETURN 'full';
    WHEN 'limited'           THEN RETURN 'limited';
    WHEN 'introduction_only' THEN RETURN 'discover';
    WHEN 'circle_only' THEN
      IF public.shares_circle_with_profile(p.id) THEN
        RETURN 'full';
      ELSE
        RETURN 'hidden';
      END IF;
  END CASE;

  RETURN 'hidden';
END $$;

GRANT EXECUTE ON FUNCTION public.profile_visibility(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_accepted_intro_with(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_circle_with_profile(uuid) TO authenticated;

-- 5. Replace the broad SELECT policy with a visibility-aware one
DROP POLICY IF EXISTS "Residents/managers can read same-building profiles" ON public.resident_profiles;
CREATE POLICY "Profiles readable per privacy"
ON public.resident_profiles
FOR SELECT
USING (public.profile_visibility(id) <> 'hidden');

-- 6. Masking view: strips last_name and job_title unless viewer is entitled
CREATE OR REPLACE VIEW public.resident_profiles_safe
WITH (security_invoker = on) AS
SELECT
  rp.id,
  rp.building_id,
  rp.user_id,
  rp.first_name,
  CASE WHEN public.profile_visibility(rp.id) IN ('self','full')
       THEN rp.last_name ELSE NULL END AS last_name,
  CASE WHEN public.profile_visibility(rp.id) IN ('self','full')
       THEN rp.job_title ELSE NULL END AS job_title,
  rp.interest_tags,
  rp.is_visible,
  rp.created_at,
  rp.last_active_at,
  rp.privacy_level,
  public.profile_visibility(rp.id) AS visibility
FROM public.resident_profiles rp;

GRANT SELECT ON public.resident_profiles_safe TO authenticated;
