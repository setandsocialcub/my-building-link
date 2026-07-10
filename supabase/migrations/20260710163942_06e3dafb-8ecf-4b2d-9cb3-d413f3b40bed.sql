
-- Community Concierge™ Phase 1 — Foundation
-- Extend neighborhood_places into a full concierge recommendations table.

ALTER TABLE public.neighborhood_places
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manager',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.resident_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS price_level int,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS collections text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_perk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perk_description text,
  ADD COLUMN IF NOT EXISTS reservation_url text,
  ADD COLUMN IF NOT EXISTS directions_url text,
  ADD COLUMN IF NOT EXISTS distance_note text,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz,
  ADD COLUMN IF NOT EXISTS resident_recommendation_note text;

-- Validation via trigger (CHECK constraints on enum-like text)
CREATE OR REPLACE FUNCTION public.validate_neighborhood_place()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source NOT IN ('manager','resident','ai') THEN
    RAISE EXCEPTION 'Invalid source: %', NEW.source;
  END IF;
  IF NEW.status NOT IN ('pending','approved','hidden') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_neighborhood_place ON public.neighborhood_places;
CREATE TRIGGER trg_validate_neighborhood_place
  BEFORE INSERT OR UPDATE ON public.neighborhood_places
  FOR EACH ROW EXECUTE FUNCTION public.validate_neighborhood_place();

-- Auto-approve manager-authored, keep resident submissions pending
CREATE OR REPLACE FUNCTION public.default_place_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'resident' AND NEW.status = 'approved' THEN
    -- Residents cannot self-approve unless manager/admin
    IF NOT (public.is_manager_of_building(NEW.building_id) OR public.has_role(auth.uid(),'admin')) THEN
      NEW.status := 'pending';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_default_place_status ON public.neighborhood_places;
CREATE TRIGGER trg_default_place_status
  BEFORE INSERT ON public.neighborhood_places
  FOR EACH ROW EXECUTE FUNCTION public.default_place_status();

-- Widen RLS: residents may read approved places in their building, and submit new ones (pending)
DROP POLICY IF EXISTS "Residents read approved places" ON public.neighborhood_places;
CREATE POLICY "Residents read approved places"
  ON public.neighborhood_places FOR SELECT
  TO authenticated
  USING (
    public.has_building_access(building_id)
    AND (
      status = 'approved'
      OR public.is_manager_of_building(building_id)
      OR public.has_role(auth.uid(),'admin')
      OR submitted_by = public.current_resident_id(building_id)
    )
  );

DROP POLICY IF EXISTS "Residents submit recommendations" ON public.neighborhood_places;
CREATE POLICY "Residents submit recommendations"
  ON public.neighborhood_places FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_building_access(building_id)
    AND (
      public.is_manager_of_building(building_id)
      OR public.has_role(auth.uid(),'admin')
      OR (source = 'resident' AND submitted_by = public.current_resident_id(building_id))
    )
  );

-- Concierge favorites
CREATE TABLE IF NOT EXISTS public.concierge_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.neighborhood_places(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);

GRANT SELECT, INSERT, DELETE ON public.concierge_favorites TO authenticated;
GRANT ALL ON public.concierge_favorites TO service_role;

ALTER TABLE public.concierge_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites"
  ON public.concierge_favorites FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_neighborhood_places_status ON public.neighborhood_places (building_id, status);
CREATE INDEX IF NOT EXISTS idx_neighborhood_places_category ON public.neighborhood_places (building_id, category);
