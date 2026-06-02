
-- Bypass buildings RLS when verifying the target building exists during signup.
CREATE OR REPLACE FUNCTION public.building_exists(_building_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.buildings WHERE id = _building_id)
$$;

DROP POLICY IF EXISTS "Users create their own profile for a known building" ON public.resident_profiles;

CREATE POLICY "Users create their own profile for a known building"
ON public.resident_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.building_exists(building_id)
);
