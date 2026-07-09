
-- Update trigger to also generate a manager access code
CREATE OR REPLACE FUNCTION public.create_default_manager_for_building()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.property_managers (building_id, manager_code)
  VALUES (NEW.id, public.generate_manager_access_code());
  RETURN NEW;
END;
$function$;

-- Backfill: ensure every building has at least one property_managers row with a manager_code
INSERT INTO public.property_managers (building_id, manager_code)
SELECT b.id, public.generate_manager_access_code()
FROM public.buildings b
WHERE NOT EXISTS (
  SELECT 1 FROM public.property_managers pm WHERE pm.building_id = b.id
);

-- Fill in missing manager_code values on existing property_managers rows
UPDATE public.property_managers
SET manager_code = public.generate_manager_access_code()
WHERE manager_code IS NULL;
