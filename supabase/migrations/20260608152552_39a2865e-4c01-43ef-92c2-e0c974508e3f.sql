DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', r.sig);
  END LOOP;
END $$;

-- Re-grant only what the app needs to call from client (with anon/authenticated bearer)
GRANT EXECUTE ON FUNCTION public.lookup_building_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_building_info(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_manager_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_building_access_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_building_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_resident_of_building(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_of_building(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.channel_building(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_resident_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.building_exists(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_shares_building_with(uuid) TO authenticated;