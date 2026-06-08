
-- Expand groups (Circles) with circle_type, visibility, description; expand categories
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_category_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_category_check CHECK (
  category IN ('system','sport','lifestyle','resident',
    'wellness','fitness','entrepreneurs','dog_parents','lgbtq','foodies',
    'book_club','new_residents','volunteer','custom')
);

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS circle_type text NOT NULL DEFAULT 'building_sponsored',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_circle_type_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_circle_type_check
  CHECK (circle_type IN ('resident_created','building_sponsored'));
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_visibility_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_visibility_check
  CHECK (visibility IN ('public','private'));

UPDATE public.groups SET circle_type = 'resident_created' WHERE category = 'resident' AND circle_type = 'building_sponsored';

-- New building setting: limit circle visibility (block residents from creating private circles)
ALTER TABLE public.building_settings
  ADD COLUMN IF NOT EXISTS limit_circle_visibility boolean NOT NULL DEFAULT false;

-- Circle invites (used by private circles)
CREATE TABLE IF NOT EXISTS public.circle_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, invited_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.circle_invites TO authenticated;
GRANT ALL ON public.circle_invites TO service_role;
ALTER TABLE public.circle_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members invite to their circles" ON public.circle_invites;
CREATE POLICY "Members invite to their circles" ON public.circle_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = circle_id AND gm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = circle_id AND public.is_manager_of_building(g.building_id))
  );
DROP POLICY IF EXISTS "View own invites" ON public.circle_invites;
CREATE POLICY "View own invites" ON public.circle_invites
  FOR SELECT TO authenticated
  USING (
    invited_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = circle_id AND gm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Inviter or invitee deletes invite" ON public.circle_invites;
CREATE POLICY "Inviter or invitee deletes invite" ON public.circle_invites
  FOR DELETE TO authenticated
  USING (invited_user_id = auth.uid() OR invited_by = auth.uid());

-- Update groups SELECT to hide private circles from non-members
DROP POLICY IF EXISTS "View groups for accessible buildings" ON public.groups;
CREATE POLICY "View circles for accessible buildings" ON public.groups
  FOR SELECT TO authenticated
  USING (
    has_building_access(building_id) AND (
      visibility = 'public'
      OR is_manager_of_building(building_id)
      OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = groups.id AND gm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.circle_invites ci WHERE ci.circle_id = groups.id AND ci.invited_user_id = auth.uid())
    )
  );

-- Update INSERT: managers always; residents only if allowed, and only resident_created circles; enforce visibility limit
DROP POLICY IF EXISTS "Residents create groups in their building" ON public.groups;
CREATE POLICY "Create circles in building" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (
    is_manager_of_building(building_id)
    OR (
      is_resident_of_building(building_id)
      AND circle_type = 'resident_created'
      AND EXISTS (
        SELECT 1 FROM public.building_settings bs
        WHERE bs.building_id = groups.building_id
          AND bs.allow_resident_circle_creation = true
      )
      AND (
        visibility = 'public'
        OR NOT EXISTS (
          SELECT 1 FROM public.building_settings bs
          WHERE bs.building_id = groups.building_id
            AND bs.limit_circle_visibility = true
        )
      )
    )
  );
