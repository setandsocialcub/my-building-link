
ALTER TABLE public.building_branding
  ADD COLUMN IF NOT EXISTS published_version integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.publish_building_branding(_building_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts timestamptz := now();
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_manager_of_building(_building_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.building_branding (building_id) VALUES (_building_id)
  ON CONFLICT (building_id) DO NOTHING;

  UPDATE public.building_branding
     SET published_at = ts,
         published_version = COALESCE(published_version, 0) + 1,
         updated_at = ts
   WHERE building_id = _building_id;

  RETURN ts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_building_branding(uuid) TO authenticated;
