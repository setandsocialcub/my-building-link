-- ============================================================
-- 1. Add user_id ownership columns
-- ============================================================
ALTER TABLE public.resident_profiles
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ADD CONSTRAINT resident_profiles_user_building_unique UNIQUE (user_id, building_id);

ALTER TABLE public.property_managers
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT property_managers_user_building_unique UNIQUE (user_id, building_id);

-- ============================================================
-- 2. Security definer helpers (bypass RLS to avoid recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_resident_of_building(_building_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resident_profiles
    WHERE user_id = auth.uid() AND building_id = _building_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of_building(_building_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.property_managers
    WHERE user_id = auth.uid() AND building_id = _building_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_building_access(_building_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_resident_of_building(_building_id)
      OR public.is_manager_of_building(_building_id)
      OR public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.current_resident_id(_building_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.resident_profiles
  WHERE user_id = auth.uid() AND building_id = _building_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_channel_member(_channel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channel_members cm
    JOIN public.resident_profiles rp ON rp.id = cm.profile_id
    WHERE cm.channel_id = _channel_id AND rp.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.channel_building(_channel_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT building_id FROM public.channels WHERE id = _channel_id
$$;

-- Claim flow: a signed-in user attaches themselves to a building via manager_code
CREATE OR REPLACE FUNCTION public.claim_manager_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT * INTO m FROM public.property_managers WHERE manager_code = _code LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid manager code';
  END IF;

  -- Already claimed by someone else?
  IF m.user_id IS NOT NULL AND m.user_id <> auth.uid() THEN
    -- Allow a second manager row for the same building under this user
    INSERT INTO public.property_managers (building_id, user_id, name)
    VALUES (m.building_id, auth.uid(), 'Property Manager')
    ON CONFLICT (user_id, building_id) DO NOTHING;
  ELSE
    UPDATE public.property_managers SET user_id = auth.uid() WHERE id = m.id;
  END IF;

  RETURN m.building_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_manager_code(text) TO authenticated;

-- ============================================================
-- 3. RESIDENT_PROFILES policies
-- ============================================================
DROP POLICY IF EXISTS "Anyone can create resident profiles" ON public.resident_profiles;
DROP POLICY IF EXISTS "Anyone can read resident profiles" ON public.resident_profiles;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resident_profiles TO authenticated;

CREATE POLICY "Residents/managers can read same-building profiles"
ON public.resident_profiles FOR SELECT TO authenticated
USING (public.has_building_access(building_id));

CREATE POLICY "Users create their own profile for a known building"
ON public.resident_profiles FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.buildings WHERE id = building_id)
);

CREATE POLICY "Users update their own profile"
ON public.resident_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 4. CHANNELS policies
-- ============================================================
DROP POLICY IF EXISTS "Public read channels" ON public.channels;
DROP POLICY IF EXISTS "Public create channels" ON public.channels;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;

CREATE POLICY "Building members read channels"
ON public.channels FOR SELECT TO authenticated
USING (public.has_building_access(building_id));

CREATE POLICY "Residents create channels in their building"
ON public.channels FOR INSERT TO authenticated
WITH CHECK (
  public.is_resident_of_building(building_id)
  AND created_by = public.current_resident_id(building_id)
);

-- ============================================================
-- 5. CHANNEL_MEMBERS policies
-- ============================================================
DROP POLICY IF EXISTS "Public read members" ON public.channel_members;
DROP POLICY IF EXISTS "Public add members" ON public.channel_members;
DROP POLICY IF EXISTS "Public remove members" ON public.channel_members;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_members TO authenticated;

CREATE POLICY "Building members read channel membership"
ON public.channel_members FOR SELECT TO authenticated
USING (public.has_building_access(public.channel_building(channel_id)));

CREATE POLICY "Residents join/add members in their building"
ON public.channel_members FOR INSERT TO authenticated
WITH CHECK (public.is_resident_of_building(public.channel_building(channel_id)));

CREATE POLICY "Residents leave channels"
ON public.channel_members FOR DELETE TO authenticated
USING (
  profile_id = public.current_resident_id(public.channel_building(channel_id))
  OR public.is_manager_of_building(public.channel_building(channel_id))
);

-- ============================================================
-- 6. CHANNEL_MESSAGES policies
-- ============================================================
DROP POLICY IF EXISTS "Public read messages" ON public.channel_messages;
DROP POLICY IF EXISTS "Public send messages" ON public.channel_messages;
DROP POLICY IF EXISTS "Public delete messages" ON public.channel_messages;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_messages TO authenticated;

CREATE POLICY "Channel members read messages"
ON public.channel_messages FOR SELECT TO authenticated
USING (
  public.is_channel_member(channel_id)
  OR public.is_manager_of_building(public.channel_building(channel_id))
);

CREATE POLICY "Channel members send messages"
ON public.channel_messages FOR INSERT TO authenticated
WITH CHECK (
  public.is_channel_member(channel_id)
  AND sender_id = public.current_resident_id(public.channel_building(channel_id))
  AND char_length(body) BETWEEN 1 AND 2000
);

CREATE POLICY "Sender or building manager can delete messages"
ON public.channel_messages FOR DELETE TO authenticated
USING (
  sender_id = public.current_resident_id(public.channel_building(channel_id))
  OR public.is_manager_of_building(public.channel_building(channel_id))
);

-- ============================================================
-- 7. NOTIFICATIONS policies
-- ============================================================
DROP POLICY IF EXISTS "Public read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Public create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Public update notifications" ON public.notifications;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

CREATE POLICY "Users read their own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (recipient_id = public.current_resident_id(building_id));

CREATE POLICY "Residents create notifications in their building"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.is_resident_of_building(building_id));

CREATE POLICY "Users update their own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (recipient_id = public.current_resident_id(building_id))
WITH CHECK (recipient_id = public.current_resident_id(building_id));

-- ============================================================
-- 8. MESSAGE_FLAGS policies
-- ============================================================
DROP POLICY IF EXISTS "Public read flags" ON public.message_flags;
DROP POLICY IF EXISTS "Public create flags" ON public.message_flags;
DROP POLICY IF EXISTS "Public update flags" ON public.message_flags;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_flags TO authenticated;

CREATE POLICY "Building managers read flags"
ON public.message_flags FOR SELECT TO authenticated
USING (public.is_manager_of_building(building_id));

CREATE POLICY "Residents create flags in their building"
ON public.message_flags FOR INSERT TO authenticated
WITH CHECK (
  public.is_resident_of_building(building_id)
  AND reporter_id = public.current_resident_id(building_id)
);

CREATE POLICY "Building managers resolve flags"
ON public.message_flags FOR UPDATE TO authenticated
USING (public.is_manager_of_building(building_id))
WITH CHECK (public.is_manager_of_building(building_id));

-- ============================================================
-- 9. ANNOUNCEMENTS policies
-- ============================================================
DROP POLICY IF EXISTS "Public read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Public create announcements" ON public.announcements;
DROP POLICY IF EXISTS "Public delete announcements" ON public.announcements;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;

CREATE POLICY "Building members read announcements"
ON public.announcements FOR SELECT TO authenticated
USING (public.has_building_access(building_id));

CREATE POLICY "Building managers post announcements"
ON public.announcements FOR INSERT TO authenticated
WITH CHECK (public.is_manager_of_building(building_id));

CREATE POLICY "Building managers delete announcements"
ON public.announcements FOR DELETE TO authenticated
USING (public.is_manager_of_building(building_id));

-- ============================================================
-- 10. PROPERTY_MANAGERS policies
-- ============================================================
DROP POLICY IF EXISTS "Public read managers" ON public.property_managers;
DROP POLICY IF EXISTS "Public create managers" ON public.property_managers;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_managers TO authenticated;
-- Admin still needs to see manager codes in /admin
GRANT SELECT ON public.property_managers TO service_role;

CREATE POLICY "Managers read their own row"
ON public.property_managers FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- No public INSERT/UPDATE — handled by trigger (auto-create on building) and claim_manager_code function.

-- ============================================================
-- 11. BUILDINGS - tighten SELECT for /admin only; keep code-lookup via RPC
-- ============================================================
-- Public read is currently used by the landing page to validate the access code.
-- Replace with an RPC that returns only id when code matches, so anon cannot enumerate all buildings.

CREATE OR REPLACE FUNCTION public.lookup_building_by_code(_code text)
RETURNS TABLE (id uuid, name text, city text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, city FROM public.buildings WHERE access_code = upper(_code) LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.lookup_building_by_code(text) TO anon, authenticated;

-- Also expose a safe building-info lookup for signed-in members
CREATE OR REPLACE FUNCTION public.get_building_info(_building_id uuid)
RETURNS TABLE (id uuid, name text, city text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, city FROM public.buildings
  WHERE id = _building_id
    AND (public.has_building_access(_building_id))
$$;

GRANT EXECUTE ON FUNCTION public.get_building_info(uuid) TO authenticated;

DROP POLICY IF EXISTS "Anyone can read buildings" ON public.buildings;

CREATE POLICY "Admins read all buildings"
ON public.buildings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members read their own building"
ON public.buildings FOR SELECT TO authenticated
USING (public.has_building_access(id));