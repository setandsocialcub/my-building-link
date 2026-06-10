DROP POLICY IF EXISTS "Request introduction in same building" ON public.resident_introductions;
CREATE POLICY "Request introduction in same building"
ON public.resident_introductions
FOR INSERT
WITH CHECK (
  is_my_profile(requester_id)
  AND requester_id = current_resident_id(building_id)
  AND EXISTS (
    SELECT 1 FROM public.resident_profiles rp
    WHERE rp.id = resident_introductions.recipient_id
      AND rp.building_id = resident_introductions.building_id
  )
);