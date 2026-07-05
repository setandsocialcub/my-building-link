
-- 1. community_id generator
CREATE OR REPLACE FUNCTION public.generate_community_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
  exists_count int;
  attempts int := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    result := 'C-';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    SELECT count(*) INTO exists_count FROM public.buildings WHERE community_id = result;
    EXIT WHEN exists_count = 0;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not generate unique community id';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- 2. community_id column
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS community_id text UNIQUE;

-- Backfill existing rows
UPDATE public.buildings SET community_id = public.generate_community_id() WHERE community_id IS NULL;

ALTER TABLE public.buildings
  ALTER COLUMN community_id SET NOT NULL,
  ALTER COLUMN community_id SET DEFAULT public.generate_community_id();

-- 3. Attach triggers to auto-provision manager, branding, settings on new building
DROP TRIGGER IF EXISTS trg_building_default_manager ON public.buildings;
CREATE TRIGGER trg_building_default_manager
AFTER INSERT ON public.buildings
FOR EACH ROW EXECUTE FUNCTION public.create_default_manager_for_building();

DROP TRIGGER IF EXISTS trg_building_default_branding ON public.buildings;
CREATE TRIGGER trg_building_default_branding
AFTER INSERT ON public.buildings
FOR EACH ROW EXECUTE FUNCTION public.create_default_building_branding();

DROP TRIGGER IF EXISTS trg_building_default_settings ON public.buildings;
CREATE TRIGGER trg_building_default_settings
AFTER INSERT ON public.buildings
FOR EACH ROW EXECUTE FUNCTION public.create_default_building_settings();

DROP TRIGGER IF EXISTS trg_building_seed_groups ON public.buildings;
CREATE TRIGGER trg_building_seed_groups
AFTER INSERT ON public.buildings
FOR EACH ROW EXECUTE FUNCTION public.tg_seed_default_groups();

-- 4. Backfill: ensure every building has at least one manager row with a code
INSERT INTO public.property_managers (building_id, manager_code)
SELECT b.id, public.generate_manager_access_code()
FROM public.buildings b
WHERE NOT EXISTS (SELECT 1 FROM public.property_managers pm WHERE pm.building_id = b.id);

-- Ensure every building has branding + settings rows
INSERT INTO public.building_branding (building_id)
SELECT b.id FROM public.buildings b
WHERE NOT EXISTS (SELECT 1 FROM public.building_branding bb WHERE bb.building_id = b.id);

INSERT INTO public.building_settings (building_id)
SELECT b.id FROM public.buildings b
WHERE NOT EXISTS (SELECT 1 FROM public.building_settings bs WHERE bs.building_id = b.id);

-- 5. Improved claim_manager_code: idempotent, keeps code visible
CREATE OR REPLACE FUNCTION public.claim_manager_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
  m record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to claim a manager code';
  END IF;

  normalized := upper(regexp_replace(coalesce(_code, ''), '[^A-Za-z0-9]', '', 'g'));
  IF normalized = '' THEN
    RAISE EXCEPTION 'Please enter a manager code';
  END IF;

  SELECT * INTO m
  FROM public.property_managers
  WHERE manager_code = normalized
  LIMIT 1;

  IF NOT FOUND THEN
    -- Maybe the code was already claimed by this user previously (code is null now);
    -- accept if they already manage a building whose original code matches nothing here.
    -- Otherwise, treat as invalid.
    RAISE EXCEPTION 'Invalid manager code. Double-check the code from your Super Admin.';
  END IF;

  -- Already claimed by someone else → give this user their own manager seat for the same building
  IF m.user_id IS NOT NULL AND m.user_id <> auth.uid() THEN
    INSERT INTO public.property_managers (building_id, user_id, name)
    VALUES (m.building_id, auth.uid(), 'Property Manager')
    ON CONFLICT DO NOTHING;
    RETURN m.building_id;
  END IF;

  -- Unclaimed or claimed by this user → claim/refresh, KEEP the code so it stays visible
  UPDATE public.property_managers
     SET user_id = auth.uid()
   WHERE id = m.id;

  RETURN m.building_id;
END;
$$;

-- 6. Allow same user to appear multiple times only once per building
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_managers_user_building_unique'
  ) THEN
    ALTER TABLE public.property_managers
      ADD CONSTRAINT property_managers_user_building_unique UNIQUE (user_id, building_id);
  END IF;
END $$;
