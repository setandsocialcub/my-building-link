
-- Function to generate a unique 6-char alphanumeric (uppercase) code
CREATE OR REPLACE FUNCTION public.generate_building_access_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text;
  i int;
  exists_count int;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    SELECT count(*) INTO exists_count FROM public.buildings WHERE access_code = result;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN result;
END;
$$;

CREATE TABLE public.buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  access_code text NOT NULL UNIQUE DEFAULT public.generate_building_access_code(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buildings TO authenticated;
GRANT SELECT, INSERT ON public.buildings TO anon;
GRANT ALL ON public.buildings TO service_role;

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

-- Public read so residents can validate access codes; admin page also reads list
CREATE POLICY "Anyone can read buildings"
  ON public.buildings FOR SELECT
  USING (true);

-- Open admin for now (per current scope)
CREATE POLICY "Anyone can create buildings"
  ON public.buildings FOR INSERT
  WITH CHECK (true);
