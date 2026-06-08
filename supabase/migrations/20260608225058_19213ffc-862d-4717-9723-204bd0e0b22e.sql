CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.group_building_id(_group_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT building_id FROM public.groups WHERE id = _group_id;
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.group_building_id(uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "View circles for accessible buildings" ON public.groups;
CREATE POLICY "View circles for accessible buildings" ON public.groups FOR SELECT TO authenticated
USING (
  has_building_access(building_id) AND (
    visibility = 'public'
    OR is_manager_of_building(building_id)
    OR public.is_group_member(id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.circle_invites ci WHERE ci.circle_id = groups.id AND ci.invited_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "View members of accessible groups" ON public.group_members;
CREATE POLICY "View members of accessible groups" ON public.group_members FOR SELECT TO authenticated
USING (has_building_access(public.group_building_id(group_id)));