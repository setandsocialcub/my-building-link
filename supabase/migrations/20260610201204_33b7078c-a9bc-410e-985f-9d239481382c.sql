
CREATE TABLE public.building_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL UNIQUE REFERENCES public.buildings(id) ON DELETE CASCADE,
  community_name text,
  logo_url text,
  hero_image_url text,
  app_icon_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  welcome_message text,
  custom_tagline text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_branding TO authenticated;
GRANT ALL ON public.building_branding TO service_role;

ALTER TABLE public.building_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branding viewable by those with building access"
  ON public.building_branding FOR SELECT TO authenticated
  USING (public.has_building_access(building_id));

CREATE POLICY "Managers and admins can insert branding"
  ON public.building_branding FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers and admins can update branding"
  ON public.building_branding FOR UPDATE TO authenticated
  USING (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete branding"
  ON public.building_branding FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_building_branding_updated_at
  BEFORE UPDATE ON public.building_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_default_building_branding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.building_branding (building_id) VALUES (NEW.id)
  ON CONFLICT (building_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_building_branding
  AFTER INSERT ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.create_default_building_branding();

-- Backfill for existing buildings
INSERT INTO public.building_branding (building_id)
SELECT id FROM public.buildings
ON CONFLICT (building_id) DO NOTHING;
