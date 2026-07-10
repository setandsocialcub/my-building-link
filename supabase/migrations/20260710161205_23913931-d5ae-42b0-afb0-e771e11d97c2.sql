
CREATE TABLE public.network_search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  query text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.network_search_events TO authenticated;
GRANT ALL ON public.network_search_events TO service_role;

ALTER TABLE public.network_search_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents can log searches in their building"
  ON public.network_search_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_resident_of_building(building_id));

CREATE POLICY "Managers and admins can read search events"
  ON public.network_search_events
  FOR SELECT TO authenticated
  USING (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_network_search_events_building_time
  ON public.network_search_events (building_id, created_at DESC);
