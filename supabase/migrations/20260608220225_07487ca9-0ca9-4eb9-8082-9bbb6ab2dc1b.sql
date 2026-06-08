
CREATE TABLE IF NOT EXISTS public.resident_introductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES public.resident_profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.resident_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','expired')),
  message text CHECK (message IS NULL OR char_length(message) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT introductions_distinct CHECK (requester_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_introductions_requester ON public.resident_introductions(requester_id);
CREATE INDEX IF NOT EXISTS idx_introductions_recipient ON public.resident_introductions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_introductions_building ON public.resident_introductions(building_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_introductions_active_pair
  ON public.resident_introductions(requester_id, recipient_id)
  WHERE status IN ('pending','accepted');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resident_introductions TO authenticated;
GRANT ALL ON public.resident_introductions TO service_role;

ALTER TABLE public.resident_introductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own introductions" ON public.resident_introductions
  FOR SELECT TO authenticated
  USING (public.is_my_profile(requester_id) OR public.is_my_profile(recipient_id));

CREATE POLICY "Request introduction in same building" ON public.resident_introductions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_my_profile(requester_id)
    AND requester_id = public.current_resident_id(building_id)
    AND EXISTS (
      SELECT 1 FROM public.resident_profiles rp
      WHERE rp.id = recipient_id AND rp.building_id = building_id
    )
  );

-- Recipient may accept/decline; requester may withdraw via DELETE
CREATE POLICY "Recipient updates introduction" ON public.resident_introductions
  FOR UPDATE TO authenticated
  USING (public.is_my_profile(recipient_id))
  WITH CHECK (public.is_my_profile(recipient_id));

CREATE POLICY "Requester withdraws introduction" ON public.resident_introductions
  FOR DELETE TO authenticated
  USING (public.is_my_profile(requester_id) AND status = 'pending');

CREATE TRIGGER trg_introductions_updated_at
  BEFORE UPDATE ON public.resident_introductions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When accepted, open a conversation (upsert connection in accepted state).
CREATE OR REPLACE FUNCTION public.handle_introduction_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    NEW.responded_at := now();
    INSERT INTO public.connections (building_id, requester_id, addressee_id, status)
    VALUES (NEW.building_id, NEW.requester_id, NEW.recipient_id, 'accepted')
    ON CONFLICT (requester_id, addressee_id)
    DO UPDATE SET status = 'accepted', updated_at = now();
  ELSIF NEW.status IN ('declined','expired') AND OLD.status = 'pending' THEN
    NEW.responded_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_introduction_accept() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_introductions_on_accept
  BEFORE UPDATE ON public.resident_introductions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_introduction_accept();
