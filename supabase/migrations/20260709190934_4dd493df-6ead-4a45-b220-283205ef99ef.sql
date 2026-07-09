
-- 1) building_templates: drop the blanket authenticated SELECT
DROP POLICY IF EXISTS "Anyone authenticated can view templates" ON public.building_templates;

-- 2) storage: replace manager read policy with building-scoped check
DROP POLICY IF EXISTS "cv attachments read as manager" ON storage.objects;
CREATE POLICY "cv attachments read as manager"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'community-voice'
  AND EXISTS (
    SELECT 1 FROM public.community_voice_submissions s
    WHERE storage.objects.name = ANY(s.attachment_urls)
      AND public.is_manager_of_building(s.building_id)
  )
);

-- 3) notifications: enforce recipient belongs to same building
DROP POLICY IF EXISTS "Residents create notifications in their building" ON public.notifications;
DROP POLICY IF EXISTS "Managers create notifications in their building" ON public.notifications;

CREATE POLICY "Residents create notifications in their building"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_resident_of_building(building_id)
  AND EXISTS (
    SELECT 1 FROM public.resident_profiles rp
    WHERE rp.id = notifications.recipient_id
      AND rp.building_id = notifications.building_id
  )
);

CREATE POLICY "Managers create notifications in their building"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_manager_of_building(building_id)
  AND EXISTS (
    SELECT 1 FROM public.resident_profiles rp
    WHERE rp.id = notifications.recipient_id
      AND rp.building_id = notifications.building_id
  )
);
