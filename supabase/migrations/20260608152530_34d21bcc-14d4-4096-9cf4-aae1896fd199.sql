DROP VIEW IF EXISTS public.resident_public_profiles;
CREATE VIEW public.resident_public_profiles
WITH (security_invoker = true) AS
  SELECT id, building_id, first_name, job_title, interest_tags, is_visible, created_at
  FROM public.resident_profiles;
GRANT SELECT ON public.resident_public_profiles TO authenticated;

REVOKE EXECUTE ON FUNCTION public.auto_publish_manager_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_forum_reply_count() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_group_member_count() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_manager_for_building() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_marketplace_listing() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_residents_of_announcement() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_default_groups(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_seed_default_groups() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.building_exists(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.channel_building(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_resident_id(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_building_info(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_building_access(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_manager_of_building(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_my_profile(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_resident_of_building(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_manager_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.regenerate_building_access_code(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lookup_building_by_code(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.building_exists(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.channel_building(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_resident_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_building_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_building_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_of_building(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_resident_of_building(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_manager_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_building_access_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_building_by_code(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_manager_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  SELECT * INTO m FROM public.property_managers WHERE manager_code = _code LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid manager code';
  END IF;
  IF m.user_id IS NOT NULL AND m.user_id <> auth.uid() THEN
    INSERT INTO public.property_managers (building_id, user_id, name)
    VALUES (m.building_id, auth.uid(), 'Property Manager')
    ON CONFLICT (user_id, building_id) DO NOTHING;
  ELSE
    UPDATE public.property_managers
       SET user_id = auth.uid(), manager_code = NULL
     WHERE id = m.id;
  END IF;
  RETURN m.building_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_shares_building_with(_other_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resident_profiles rp1
    JOIN public.resident_profiles rp2 ON rp2.building_id = rp1.building_id
    WHERE rp1.user_id = auth.uid() AND rp2.user_id = _other_uid
  ) OR EXISTS (
    SELECT 1
    FROM public.property_managers pm
    JOIN public.resident_profiles rp ON rp.building_id = pm.building_id
    WHERE pm.user_id = auth.uid() AND rp.user_id = _other_uid
  );
$$;
REVOKE EXECUTE ON FUNCTION public.user_shares_building_with(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_shares_building_with(uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated read marketplace images" ON storage.objects;
CREATE POLICY "Building members read marketplace images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'marketplace'
  AND public.user_shares_building_with(((storage.foldername(name))[1])::uuid)
);