
CREATE TABLE public.building_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL UNIQUE REFERENCES public.buildings(id) ON DELETE CASCADE,
  enable_circles boolean NOT NULL DEFAULT true,
  enable_experiences boolean NOT NULL DEFAULT true,
  enable_concierge boolean NOT NULL DEFAULT true,
  enable_community_board boolean NOT NULL DEFAULT true,
  enable_resident_exchange boolean NOT NULL DEFAULT true,
  enable_conversations boolean NOT NULL DEFAULT true,
  enable_introductions boolean NOT NULL DEFAULT true,
  enable_ai_matching boolean NOT NULL DEFAULT true,
  enable_resident_ambassadors boolean NOT NULL DEFAULT true,
  allow_resident_circle_creation boolean NOT NULL DEFAULT true,
  require_circle_approval boolean NOT NULL DEFAULT false,
  theme text NOT NULL DEFAULT 'hospitality',
  community_style text NOT NULL DEFAULT 'luxury',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_settings TO authenticated;
GRANT ALL ON public.building_settings TO service_role;

ALTER TABLE public.building_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Building members read settings"
ON public.building_settings FOR SELECT TO authenticated
USING (public.has_building_access(building_id));

CREATE POLICY "Admins or managers update settings"
ON public.building_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_manager_of_building(building_id))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_manager_of_building(building_id));

CREATE POLICY "Admins insert settings"
ON public.building_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete settings"
ON public.building_settings FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_building_settings_updated_at
BEFORE UPDATE ON public.building_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create settings row whenever a new building is created.
CREATE OR REPLACE FUNCTION public.create_default_building_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.building_settings (building_id) VALUES (NEW.id)
  ON CONFLICT (building_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_building_settings
AFTER INSERT ON public.buildings
FOR EACH ROW EXECUTE FUNCTION public.create_default_building_settings();

-- Backfill existing buildings.
INSERT INTO public.building_settings (building_id)
SELECT id FROM public.buildings
ON CONFLICT (building_id) DO NOTHING;
