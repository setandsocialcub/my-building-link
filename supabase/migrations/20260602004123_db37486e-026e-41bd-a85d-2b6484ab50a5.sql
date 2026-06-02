
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

ALTER TABLE public.resident_profiles
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

DROP VIEW IF EXISTS public.resident_public_profiles;
CREATE VIEW public.resident_public_profiles AS
SELECT id, building_id, first_name, job_title, interest_tags, is_visible, created_at
FROM public.resident_profiles;
GRANT SELECT ON public.resident_public_profiles TO authenticated;

CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES public.resident_profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.resident_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT connections_distinct CHECK (requester_id <> addressee_id),
  CONSTRAINT connections_unique_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX idx_connections_addressee ON public.connections(addressee_id);
CREATE INDEX idx_connections_requester ON public.connections(requester_id);
CREATE INDEX idx_connections_building ON public.connections(building_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_my_profile(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.resident_profiles WHERE id = _profile_id AND user_id = auth.uid())
$$;

CREATE POLICY "Users read own connections"
ON public.connections FOR SELECT TO authenticated
USING (public.is_my_profile(requester_id) OR public.is_my_profile(addressee_id));

CREATE POLICY "Users request connections in their building"
ON public.connections FOR INSERT TO authenticated
WITH CHECK (
  public.is_my_profile(requester_id)
  AND requester_id = public.current_resident_id(building_id)
);

CREATE POLICY "Addressee or requester can update connection"
ON public.connections FOR UPDATE TO authenticated
USING (public.is_my_profile(requester_id) OR public.is_my_profile(addressee_id))
WITH CHECK (public.is_my_profile(requester_id) OR public.is_my_profile(addressee_id));

CREATE POLICY "Users delete own connections"
ON public.connections FOR DELETE TO authenticated
USING (public.is_my_profile(requester_id) OR public.is_my_profile(addressee_id));

CREATE TRIGGER trg_connections_updated_at
BEFORE UPDATE ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
