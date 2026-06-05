
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '👥',
  category text NOT NULL CHECK (category IN ('system','sport','lifestyle','resident')),
  interest_tag text,
  is_pinned boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  member_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.resident_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, name)
);
CREATE INDEX idx_groups_building ON public.groups(building_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View groups for accessible buildings"
  ON public.groups FOR SELECT TO authenticated
  USING (public.has_building_access(building_id));

CREATE POLICY "Residents create groups in their building"
  ON public.groups FOR INSERT TO authenticated
  WITH CHECK (public.is_resident_of_building(building_id) AND category = 'resident');

CREATE POLICY "Managers update groups in their building"
  ON public.groups FOR UPDATE TO authenticated
  USING (public.is_manager_of_building(building_id));

CREATE POLICY "Managers delete resident groups in their building"
  ON public.groups FOR DELETE TO authenticated
  USING (public.is_manager_of_building(building_id) AND category = 'resident');

CREATE TRIGGER trg_groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON public.group_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View members of accessible groups"
  ON public.group_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND public.has_building_access(g.building_id)));

CREATE POLICY "Residents join groups in their building"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND public.is_resident_of_building(g.building_id))
  );

CREATE POLICY "Users leave their own memberships"
  ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- maintain member_count
CREATE OR REPLACE FUNCTION public.bump_group_member_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_group_members_count
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.bump_group_member_count();

-- Seed defaults for a building
CREATE OR REPLACE FUNCTION public.seed_default_groups(_building_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.groups (building_id, name, emoji, category, interest_tag, is_pinned, is_default) VALUES
    (_building_id, 'General',       '💬', 'system', null,           true,  true),
    (_building_id, 'Announcements', '📣', 'system', null,           true,  true),
    (_building_id, 'Marketplace',   '🛍️', 'system', 'marketplace',  false, true),
    (_building_id, 'Run Club',      '🏃', 'sport',  'running',      false, true),
    (_building_id, 'Basketball',    '🏀', 'sport',  'basketball',   false, true),
    (_building_id, 'Volleyball',    '🏐', 'sport',  'volleyball',   false, true),
    (_building_id, 'Tennis',        '🎾', 'sport',  'tennis',       false, true),
    (_building_id, 'Boxing',        '🥊', 'sport',  'boxing',       false, true),
    (_building_id, 'Yoga',          '🧘', 'sport',  'yoga',         false, true),
    (_building_id, 'Food & Beverage','🍽️','lifestyle','food',       false, true),
    (_building_id, 'Pet Owners',    '🐾', 'lifestyle','pets',       false, true),
    (_building_id, 'Remote Workers','💻', 'lifestyle','remote',     false, true),
    (_building_id, 'Parents & Kids','👨‍👩‍👧','lifestyle','parenting',false, true),
    (_building_id, 'Book Club',     '📚', 'lifestyle','books',      false, true)
  ON CONFLICT (building_id, name) DO NOTHING;
END $$;

-- Seed for all existing buildings
DO $$
DECLARE b record;
BEGIN
  FOR b IN SELECT id FROM public.buildings LOOP
    PERFORM public.seed_default_groups(b.id);
  END LOOP;
END $$;

-- Auto-seed for new buildings
CREATE OR REPLACE FUNCTION public.tg_seed_default_groups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_default_groups(NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_buildings_seed_groups
  AFTER INSERT ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_default_groups();
