ALTER TABLE public.building_branding
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS login_screen_image_url text,
  ADD COLUMN IF NOT EXISTS playbook_cover_image_url text,
  ADD COLUMN IF NOT EXISTS email_logo_url text,
  ADD COLUMN IF NOT EXISTS email_primary_color text,
  ADD COLUMN IF NOT EXISTS email_accent_color text;