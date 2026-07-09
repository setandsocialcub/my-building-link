
CREATE POLICY "cv attachments upload own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'community-voice'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "cv attachments read own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'community-voice'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "cv attachments read as manager"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'community-voice'
  AND EXISTS (
    SELECT 1 FROM public.property_managers pm
    WHERE pm.user_id = auth.uid()
  )
);
