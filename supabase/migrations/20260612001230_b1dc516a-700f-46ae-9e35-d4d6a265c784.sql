
-- Building Templates table
CREATE TABLE public.building_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  template_description text,
  enabled_features jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_circles jsonb NOT NULL DEFAULT '[]'::jsonb,
  homepage_priority jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.building_templates TO authenticated;
GRANT SELECT ON public.building_templates TO anon;
GRANT ALL ON public.building_templates TO service_role;

ALTER TABLE public.building_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view templates"
  ON public.building_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert templates"
  ON public.building_templates FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update templates"
  ON public.building_templates FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete non-system templates"
  ON public.building_templates FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin') AND is_system = false);

CREATE TRIGGER update_building_templates_updated_at
  BEFORE UPDATE ON public.building_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Buildings: track which template was applied
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.building_templates(id) ON DELETE SET NULL;

-- Helper: apply a template's enabled_features to building_settings
CREATE OR REPLACE FUNCTION public.apply_template_to_building(_building_id uuid, _template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  feature_key text;
  feature_val boolean;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_manager_of_building(_building_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO t FROM public.building_templates WHERE id = _template_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not found'; END IF;

  -- Ensure a settings row exists
  INSERT INTO public.building_settings (building_id) VALUES (_building_id)
  ON CONFLICT (building_id) DO NOTHING;

  -- Start by disabling all known toggles, then enable from template
  UPDATE public.building_settings SET
    enable_circles = false,
    enable_experiences = false,
    enable_concierge = false,
    enable_community_board = false,
    enable_resident_exchange = false,
    enable_conversations = true, -- DMs stay on by default
    enable_introductions = false,
    enable_ai_matching = false,
    enable_resident_ambassadors = false,
    allow_resident_circle_creation = false
  WHERE building_id = _building_id;

  FOR feature_key, feature_val IN
    SELECT key, (value)::text::boolean FROM jsonb_each_text(t.enabled_features)
  LOOP
    EXECUTE format(
      'UPDATE public.building_settings SET %I = $1 WHERE building_id = $2',
      feature_key
    ) USING feature_val, _building_id;
  END LOOP;

  UPDATE public.buildings SET template_id = _template_id WHERE id = _building_id;
END;
$$;

-- Seed the four templates
INSERT INTO public.building_templates (template_name, template_description, enabled_features, recommended_circles, homepage_priority, is_system) VALUES
(
  'Luxury High-Rise',
  'Designed for Class A multifamily communities focused on lifestyle, networking, resident experiences, and hospitality.',
  '{"enable_ai_matching":true,"enable_introductions":true,"enable_experiences":true,"enable_concierge":true,"enable_resident_ambassadors":true,"enable_circles":true,"allow_resident_circle_creation":true,"enable_community_board":true}'::jsonb,
  '["Entrepreneurs","Wellness","Foodies","LGBTQ+","Dog Parents","Young Professionals"]'::jsonb,
  '["Residents You May Enjoy Meeting","Upcoming Experiences","Concierge Recommendations","Community Highlights"]'::jsonb,
  true
),
(
  'Family Community',
  'Designed for family-oriented communities focused on neighborhood engagement, activities, and resident resources.',
  '{"enable_resident_exchange":true,"enable_community_board":true,"enable_circles":true,"enable_experiences":true,"allow_resident_circle_creation":true}'::jsonb,
  '["Parents Circle","Family Activities","Local Recommendations","Pet Families","Community Volunteers"]'::jsonb,
  '["Upcoming Experiences","Family Circles","Community Highlights","Resident Exchange"]'::jsonb,
  true
),
(
  'Active Adult Community',
  'Designed for active adult and 55+ communities focused on connection, wellness, volunteering, and lifestyle enrichment.',
  '{"enable_circles":true,"enable_concierge":true,"enable_experiences":true,"enable_community_board":true,"enable_introductions":true}'::jsonb,
  '["Walking Club","Volunteer Circle","Book Club","Wellness Circle","Community Ambassadors"]'::jsonb,
  '["Upcoming Experiences","Volunteer Opportunities","Walking Clubs","Community Highlights"]'::jsonb,
  true
),
(
  'Lifestyle Community',
  'Designed for luxury multifamily communities focused on hospitality, resident experiences, belonging, and intentional connection.',
  '{"enable_ai_matching":true,"enable_introductions":true,"enable_experiences":true,"enable_concierge":true,"enable_resident_ambassadors":true,"enable_circles":true,"allow_resident_circle_creation":true,"enable_community_board":true}'::jsonb,
  '["Wellness Circle","Foodies Circle","Entrepreneurs Circle","Dog Parents Circle","LGBTQ+ Circle","New Residents Circle"]'::jsonb,
  '["Residents You May Enjoy Meeting","Upcoming Experiences","Your Circles","Community Highlights","Concierge Recommendations"]'::jsonb,
  true
);
