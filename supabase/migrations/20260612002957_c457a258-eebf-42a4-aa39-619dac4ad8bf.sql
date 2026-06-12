
CREATE TABLE public.building_settings_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('override','reset_to_template')),
  setting_key text,
  old_value jsonb,
  new_value jsonb,
  template_id uuid REFERENCES public.building_templates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX building_settings_audit_building_idx
  ON public.building_settings_audit (building_id, created_at DESC);

GRANT SELECT, INSERT ON public.building_settings_audit TO authenticated;
GRANT ALL ON public.building_settings_audit TO service_role;

ALTER TABLE public.building_settings_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins can view building audit"
  ON public.building_settings_audit FOR SELECT
  TO authenticated
  USING (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers and admins can insert building audit"
  ON public.building_settings_audit FOR INSERT
  TO authenticated
  WITH CHECK (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(), 'admin'));

-- Update apply_template_to_building to write an audit row
CREATE OR REPLACE FUNCTION public.apply_template_to_building(_building_id uuid, _template_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.building_settings (building_id) VALUES (_building_id)
  ON CONFLICT (building_id) DO NOTHING;

  UPDATE public.building_settings SET
    enable_circles = false,
    enable_experiences = false,
    enable_concierge = false,
    enable_community_board = false,
    enable_resident_exchange = false,
    enable_conversations = true,
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

  INSERT INTO public.building_settings_audit (building_id, actor_user_id, action, template_id)
  VALUES (_building_id, auth.uid(), 'reset_to_template', _template_id);
END;
$function$;
