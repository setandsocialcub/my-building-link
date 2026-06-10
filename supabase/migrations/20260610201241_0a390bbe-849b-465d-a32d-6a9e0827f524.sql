
CREATE POLICY "Branding files viewable by building members"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'branding'
    AND public.has_building_access((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Branding files uploadable by managers/admins"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND (
      public.is_manager_of_building((storage.foldername(name))[1]::uuid)
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Branding files updatable by managers/admins"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'branding'
    AND (
      public.is_manager_of_building((storage.foldername(name))[1]::uuid)
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Branding files deletable by managers/admins"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'branding'
    AND (
      public.is_manager_of_building((storage.foldername(name))[1]::uuid)
      OR public.has_role(auth.uid(), 'admin')
    )
  );
