
-- Property managers: one per building, with a unique 6-char access code (similar to building code)
CREATE OR REPLACE FUNCTION public.generate_manager_access_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text;
  i int;
  exists_count int;
BEGIN
  LOOP
    result := 'M';
    FOR i IN 1..5 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    SELECT count(*) INTO exists_count FROM public.property_managers WHERE manager_code = result;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN result;
END;
$$;

CREATE TABLE public.property_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL UNIQUE REFERENCES public.buildings(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Property Manager',
  manager_code text NOT NULL UNIQUE DEFAULT public.generate_manager_access_code(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_managers TO anon, authenticated;
GRANT ALL ON public.property_managers TO service_role;
ALTER TABLE public.property_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read managers" ON public.property_managers FOR SELECT USING (true);
CREATE POLICY "Public create managers" ON public.property_managers FOR INSERT WITH CHECK (true);

-- Auto-create a manager whenever a building is created
CREATE OR REPLACE FUNCTION public.create_default_manager_for_building()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.property_managers (building_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER buildings_create_manager
AFTER INSERT ON public.buildings
FOR EACH ROW EXECUTE FUNCTION public.create_default_manager_for_building();

-- Backfill managers for any pre-existing buildings
INSERT INTO public.property_managers (building_id)
SELECT b.id FROM public.buildings b
LEFT JOIN public.property_managers pm ON pm.building_id = b.id
WHERE pm.id IS NULL;

-- Announcements: one-way broadcast posted by the property manager
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES public.property_managers(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_building ON public.announcements(building_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Public create announcements" ON public.announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete announcements" ON public.announcements FOR DELETE USING (true);

-- Message flags queue
CREATE TABLE public.message_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.channel_messages(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.resident_profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dismissed','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE(message_id, reporter_id)
);
CREATE INDEX idx_flags_building_status ON public.message_flags(building_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_flags TO anon, authenticated;
GRANT ALL ON public.message_flags TO service_role;
ALTER TABLE public.message_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read flags" ON public.message_flags FOR SELECT USING (true);
CREATE POLICY "Public create flags" ON public.message_flags FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update flags" ON public.message_flags FOR UPDATE USING (true) WITH CHECK (true);

-- Allow manager to delete chat messages
CREATE POLICY "Public delete messages" ON public.channel_messages FOR DELETE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_flags;
