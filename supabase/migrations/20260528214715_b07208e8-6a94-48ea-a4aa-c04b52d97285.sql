-- Admin can read all manager rows (needed for /admin to show manager codes)
CREATE POLICY "Admin reads all managers"
ON public.property_managers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Tighten function exposure: only the ones meant to be RPC-callable stay public
REVOKE EXECUTE ON FUNCTION public.is_resident_of_building(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_manager_of_building(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_building_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_resident_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.channel_building(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;