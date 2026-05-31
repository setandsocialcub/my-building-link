-- Allow building managers to delete (deactivate) resident profiles in their building
CREATE POLICY "Building managers deactivate residents"
ON public.resident_profiles
FOR DELETE
TO authenticated
USING (public.is_manager_of_building(building_id));
