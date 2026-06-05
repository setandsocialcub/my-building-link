
CREATE POLICY "Authenticated read marketplace images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'marketplace');

CREATE POLICY "Authenticated upload marketplace images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners update their marketplace images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete their marketplace images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);
