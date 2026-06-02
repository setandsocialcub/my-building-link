
-- Allow managers to create events directly
ALTER TABLE public.events ALTER COLUMN created_by DROP NOT NULL;

CREATE POLICY "Managers create events in their building"
ON public.events FOR INSERT TO authenticated
WITH CHECK (is_manager_of_building(building_id));

-- Allow managers to create notifications in their building
CREATE POLICY "Managers create notifications in their building"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (is_manager_of_building(building_id));

-- Add last_active_at to resident_profiles
ALTER TABLE public.resident_profiles
  ADD COLUMN last_active_at timestamptz NOT NULL DEFAULT now();
