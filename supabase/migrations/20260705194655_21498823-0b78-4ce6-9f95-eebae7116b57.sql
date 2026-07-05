
-- 1. Extend buildings
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS unit_count integer,
  ADD COLUMN IF NOT EXISTS floor_count integer,
  ADD COLUMN IF NOT EXISTS amenities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS community_intro text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2. property_managers: disabled_at
ALTER TABLE public.property_managers
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

-- 3. manager_permissions
CREATE TABLE IF NOT EXISTS public.manager_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES public.property_managers(id) ON DELETE CASCADE,
  permission text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_permissions TO authenticated;
GRANT ALL ON public.manager_permissions TO service_role;
ALTER TABLE public.manager_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage all manager permissions"
  ON public.manager_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers can read their own permissions"
  ON public.manager_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.property_managers pm
      WHERE pm.id = manager_id AND pm.user_id = auth.uid()
    )
  );

-- 4. resident_suspensions
CREATE TABLE IF NOT EXISTS public.resident_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.resident_profiles(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  reason text,
  suspended_by uuid REFERENCES auth.users(id),
  suspended_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resident_suspensions TO authenticated;
GRANT ALL ON public.resident_suspensions TO service_role;
ALTER TABLE public.resident_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers manage suspensions"
  ON public.resident_suspensions FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of_building(building_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of_building(building_id)
  );

-- 5. resident_invites
CREATE TABLE IF NOT EXISTS public.resident_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  email text,
  invite_code text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resident_invites TO authenticated;
GRANT ALL ON public.resident_invites TO service_role;
ALTER TABLE public.resident_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers manage invites"
  ON public.resident_invites FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of_building(building_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of_building(building_id)
  );

-- 6. neighborhood_places
CREATE TABLE IF NOT EXISTS public.neighborhood_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  address text,
  notes text,
  url text,
  lat double precision,
  lng double precision,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.neighborhood_places TO authenticated;
GRANT ALL ON public.neighborhood_places TO service_role;
ALTER TABLE public.neighborhood_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Building members can read neighborhood"
  ON public.neighborhood_places FOR SELECT
  USING (public.has_building_access(building_id));
CREATE POLICY "Admins and managers manage neighborhood"
  ON public.neighborhood_places FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of_building(building_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of_building(building_id)
  );

-- 7. building_playbook_items
CREATE TABLE IF NOT EXISTS public.building_playbook_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  order_index integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_playbook_items TO authenticated;
GRANT ALL ON public.building_playbook_items TO service_role;
ALTER TABLE public.building_playbook_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Building members can read playbook"
  ON public.building_playbook_items FOR SELECT
  USING (public.has_building_access(building_id));
CREATE POLICY "Admins and managers manage playbook"
  ON public.building_playbook_items FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of_building(building_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of_building(building_id)
  );

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_neighborhood_places_updated_at ON public.neighborhood_places;
CREATE TRIGGER trg_neighborhood_places_updated_at
  BEFORE UPDATE ON public.neighborhood_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_building_playbook_items_updated_at ON public.building_playbook_items;
CREATE TRIGGER trg_building_playbook_items_updated_at
  BEFORE UPDATE ON public.building_playbook_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
