DROP TRIGGER IF EXISTS buildings_create_manager ON public.buildings;

DELETE FROM public.property_managers pm
WHERE NOT EXISTS (SELECT 1 FROM public.buildings b WHERE b.id = pm.building_id);