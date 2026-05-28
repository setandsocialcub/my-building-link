CREATE OR REPLACE FUNCTION public.generate_building_access_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text;
  i int;
  exists_count int;
  attempts int := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    SELECT count(*) INTO exists_count FROM public.buildings WHERE access_code = result;
    EXIT WHEN exists_count = 0;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not generate unique building access code after % attempts', attempts;
    END IF;
  END LOOP;
  RETURN result;
END;
$function$;