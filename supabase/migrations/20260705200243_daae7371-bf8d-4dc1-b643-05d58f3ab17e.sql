-- 1. Extend groups (Circles)
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS moderator_id uuid REFERENCES public.resident_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS join_requirement text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'groups_join_requirement_check'
  ) THEN
    ALTER TABLE public.groups
      ADD CONSTRAINT groups_join_requirement_check
      CHECK (join_requirement IN ('open','approval','invite'));
  END IF;
END $$;

-- 2. Broaden manager delete policy (was limited to resident-created)
DROP POLICY IF EXISTS "Managers delete resident groups in their building" ON public.groups;
CREATE POLICY "Managers delete circles in their building"
  ON public.groups FOR DELETE
  TO authenticated
  USING (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(), 'admin'));

-- 3. Circle join requests
CREATE TABLE IF NOT EXISTS public.circle_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  message text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  UNIQUE (circle_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_join_requests TO authenticated;
GRANT ALL ON public.circle_join_requests TO service_role;

ALTER TABLE public.circle_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own requests or manager views all"
  ON public.circle_join_requests FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_manager_of_building(public.group_building_id(circle_id))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Residents request to join a circle in their building"
  ON public.circle_join_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_resident_of_building(public.group_building_id(circle_id))
  );

CREATE POLICY "Owner cancels own request"
  ON public.circle_join_requests FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status IN ('pending','cancelled'));

CREATE POLICY "Managers decide requests in their building"
  ON public.circle_join_requests FOR UPDATE
  TO authenticated
  USING (
    public.is_manager_of_building(public.group_building_id(circle_id))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_manager_of_building(public.group_building_id(circle_id))
    OR public.has_role(auth.uid(), 'admin')
  );

-- 4. Approval function used by the management center
CREATE OR REPLACE FUNCTION public.approve_circle_join(_request_id uuid, _decision text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF _decision NOT IN ('approved','declined') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;
  SELECT * INTO r FROM public.circle_join_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF NOT (public.is_manager_of_building(public.group_building_id(r.circle_id))
          OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.circle_join_requests
     SET status = _decision, decided_at = now(), decided_by = auth.uid()
   WHERE id = _request_id;

  IF _decision = 'approved' THEN
    INSERT INTO public.group_members (group_id, user_id)
    VALUES (r.circle_id, r.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.approve_circle_join(uuid, text) TO authenticated;