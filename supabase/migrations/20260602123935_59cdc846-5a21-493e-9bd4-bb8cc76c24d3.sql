
-- Update access code generator to produce AAA-NNN format
CREATE OR REPLACE FUNCTION public.generate_building_access_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  digits  text := '0123456789';
  result  text;
  i int;
  exists_count int;
  attempts int := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    result := '';
    FOR i IN 1..3 LOOP
      result := result || substr(letters, 1 + floor(random() * length(letters))::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..3 LOOP
      result := result || substr(digits, 1 + floor(random() * length(digits))::int, 1);
    END LOOP;
    SELECT count(*) INTO exists_count FROM public.buildings WHERE access_code = result;
    EXIT WHEN exists_count = 0;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not generate unique building access code after % attempts', attempts;
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- Migrate existing buildings whose codes don't match the new format
UPDATE public.buildings
SET access_code = public.generate_building_access_code()
WHERE access_code !~ '^[A-Z]{3}-[0-9]{3}$';

-- RPC for a manager to regenerate their building's code
CREATE OR REPLACE FUNCTION public.regenerate_building_access_code(_building_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code text;
BEGIN
  IF NOT public.is_manager_of_building(_building_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  new_code := public.generate_building_access_code();
  UPDATE public.buildings SET access_code = new_code WHERE id = _building_id;
  RETURN new_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_building_access_code(uuid) TO authenticated;
