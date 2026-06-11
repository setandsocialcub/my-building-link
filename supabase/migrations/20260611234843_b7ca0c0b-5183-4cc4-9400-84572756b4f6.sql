
ALTER TABLE public.building_branding
  ADD COLUMN IF NOT EXISTS community_tagline TEXT,
  ADD COLUMN IF NOT EXISTS community_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS homepage_headline TEXT,
  ADD COLUMN IF NOT EXISTS homepage_subheadline TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS enable_powered_by_footer BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS app_name TEXT,
  ADD COLUMN IF NOT EXISTS app_short_name TEXT,
  ADD COLUMN IF NOT EXISTS splash_screen_image_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS building_branding_custom_domain_idx
  ON public.building_branding (lower(custom_domain))
  WHERE custom_domain IS NOT NULL;
