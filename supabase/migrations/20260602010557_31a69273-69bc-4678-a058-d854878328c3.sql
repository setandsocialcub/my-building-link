-- Events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  location text CHECK (location IS NULL OR char_length(location) <= 200),
  starts_at timestamptz NOT NULL,
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  cover_emoji text NOT NULL DEFAULT '🏢',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read published; author/manager read all"
  ON public.events FOR SELECT TO authenticated
  USING (
    public.has_building_access(building_id)
    AND (
      status = 'published'
      OR created_by = public.current_resident_id(building_id)
      OR public.is_manager_of_building(building_id)
    )
  );

CREATE POLICY "Residents create events in their building"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    public.is_resident_of_building(building_id)
    AND created_by = public.current_resident_id(building_id)
  );

CREATE POLICY "Managers update events; author edits own pending"
  ON public.events FOR UPDATE TO authenticated
  USING (
    public.is_manager_of_building(building_id)
    OR (created_by = public.current_resident_id(building_id) AND status = 'pending')
  )
  WITH CHECK (
    public.is_manager_of_building(building_id)
    OR (created_by = public.current_resident_id(building_id) AND status = 'pending')
  );

CREATE POLICY "Managers or author delete events"
  ON public.events FOR DELETE TO authenticated
  USING (
    public.is_manager_of_building(building_id)
    OR created_by = public.current_resident_id(building_id)
  );

CREATE INDEX idx_events_building_starts ON public.events(building_id, starts_at);

-- Auto-publish events created by a building manager
CREATE OR REPLACE FUNCTION public.auto_publish_manager_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_manager_of_building(NEW.building_id) THEN
    NEW.status := 'published';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_auto_publish
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.auto_publish_manager_event();

CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RSVPs
CREATE TABLE public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  building_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('going','maybe','not_going')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Building members read RSVPs"
  ON public.event_rsvps FOR SELECT TO authenticated
  USING (public.has_building_access(building_id));

CREATE POLICY "Residents create own RSVP"
  ON public.event_rsvps FOR INSERT TO authenticated
  WITH CHECK (
    public.is_resident_of_building(building_id)
    AND profile_id = public.current_resident_id(building_id)
  );

CREATE POLICY "Residents update own RSVP"
  ON public.event_rsvps FOR UPDATE TO authenticated
  USING (profile_id = public.current_resident_id(building_id))
  WITH CHECK (profile_id = public.current_resident_id(building_id));

CREATE POLICY "Residents delete own RSVP"
  ON public.event_rsvps FOR DELETE TO authenticated
  USING (profile_id = public.current_resident_id(building_id));

CREATE TRIGGER event_rsvps_set_updated_at
  BEFORE UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_event_rsvps_event ON public.event_rsvps(event_id);