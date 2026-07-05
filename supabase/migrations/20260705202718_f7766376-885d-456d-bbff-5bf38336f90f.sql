
-- Add rich profile fields to resident_profiles
ALTER TABLE public.resident_profiles
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS cover_path text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS professional_skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_local_spots text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pets text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Storage policies for private resident-media bucket.
-- Path convention: {user_id}/{filename}
DROP POLICY IF EXISTS "Residents can read own media" ON storage.objects;
DROP POLICY IF EXISTS "Residents can upload own media" ON storage.objects;
DROP POLICY IF EXISTS "Residents can update own media" ON storage.objects;
DROP POLICY IF EXISTS "Residents can delete own media" ON storage.objects;
DROP POLICY IF EXISTS "Building neighbors can read resident media" ON storage.objects;

CREATE POLICY "Residents can upload own media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resident-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Residents can update own media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resident-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Residents can delete own media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resident-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Residents can read own media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resident-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Neighbors in the same building (or managers/admins) can read each other's media.
CREATE POLICY "Building neighbors can read resident media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'resident-media'
    AND public.user_shares_building_with(((storage.foldername(name))[1])::uuid)
  );
