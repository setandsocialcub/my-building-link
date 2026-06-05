
CREATE TABLE public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.resident_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  image_url text,
  category text,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_listings TO authenticated;
GRANT ALL ON public.marketplace_listings TO service_role;

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Building members view listings"
ON public.marketplace_listings FOR SELECT TO authenticated
USING (public.has_building_access(building_id));

CREATE POLICY "Residents create their listings"
ON public.marketplace_listings FOR INSERT TO authenticated
WITH CHECK (
  public.is_resident_of_building(building_id)
  AND seller_id = public.current_resident_id(building_id)
);

CREATE POLICY "Sellers update their listings"
ON public.marketplace_listings FOR UPDATE TO authenticated
USING (seller_id = public.current_resident_id(building_id))
WITH CHECK (seller_id = public.current_resident_id(building_id));

CREATE POLICY "Sellers delete their listings"
ON public.marketplace_listings FOR DELETE TO authenticated
USING (seller_id = public.current_resident_id(building_id));

CREATE TRIGGER trg_marketplace_listings_updated
BEFORE UPDATE ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-post to General channel when a new listing is created
CREATE OR REPLACE FUNCTION public.notify_marketplace_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  general_channel_id uuid;
  price_text text;
BEGIN
  SELECT id INTO general_channel_id
  FROM public.channels
  WHERE building_id = NEW.building_id AND lower(name) = 'general'
  LIMIT 1;

  IF general_channel_id IS NOT NULL THEN
    price_text := CASE WHEN NEW.is_free THEN 'Free' ELSE '$' || NEW.price::text END;
    INSERT INTO public.channel_messages (channel_id, sender_id, body)
    VALUES (general_channel_id, NEW.seller_id,
      '🛍️ New listing: ' || NEW.title || ' — ' || price_text);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_marketplace_listing_announce
AFTER INSERT ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.notify_marketplace_listing();
