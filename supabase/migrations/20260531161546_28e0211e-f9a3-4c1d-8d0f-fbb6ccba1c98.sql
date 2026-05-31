CREATE OR REPLACE FUNCTION public.create_default_manager_for_building()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.property_managers (building_id) VALUES (NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS create_default_manager_for_building_trg ON public.buildings;
CREATE TRIGGER create_default_manager_for_building_trg
AFTER INSERT ON public.buildings
FOR EACH ROW EXECUTE FUNCTION public.create_default_manager_for_building();