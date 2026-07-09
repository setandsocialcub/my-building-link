
DO $$ BEGIN
  CREATE TYPE public.industry_type AS ENUM (
    'luxury_residential','multifamily','boutique_hotel','branded_residence',
    'student_housing','senior_living','corporate_housing','private_club','mixed_use'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) Clients table (no policies yet)
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  industry_type public.industry_type NOT NULL DEFAULT 'luxury_residential',
  portfolio_template_id uuid,
  contact_email text,
  logo_url text,
  primary_color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

-- 2) Extend buildings FIRST (so RLS on clients can reference client_id)
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS industry_type public.industry_type NOT NULL DEFAULT 'luxury_residential';

CREATE INDEX IF NOT EXISTS idx_buildings_client_id ON public.buildings(client_id);

-- 3) Now enable RLS + policies on clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage clients" ON public.clients;
CREATE POLICY "Admins manage clients" ON public.clients FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Members view their client" ON public.clients;
CREATE POLICY "Members view their client" ON public.clients FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.buildings b
      WHERE b.client_id = clients.id
        AND (public.is_resident_of_building(b.id) OR public.is_manager_of_building(b.id))
    )
  );

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Extend building_templates
ALTER TABLE public.building_templates
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS industry_type public.industry_type,
  ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS legal_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notification_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_building_templates_client_id ON public.building_templates(client_id);

DO $$ BEGIN
  ALTER TABLE public.clients
    ADD CONSTRAINT clients_portfolio_template_fk
    FOREIGN KEY (portfolio_template_id) REFERENCES public.building_templates(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Extend building_branding
ALTER TABLE public.building_branding
  ADD COLUMN IF NOT EXISTS border_radius text,
  ADD COLUMN IF NOT EXISTS button_style text,
  ADD COLUMN IF NOT EXISTS typography_preset text,
  ADD COLUMN IF NOT EXISTS community_voice text,
  ADD COLUMN IF NOT EXISTS custom_login_button_label text,
  ADD COLUMN IF NOT EXISTS email_sender_name text,
  ADD COLUMN IF NOT EXISTS email_reply_to text,
  ADD COLUMN IF NOT EXISTS email_footer_text text,
  ADD COLUMN IF NOT EXISTS pwa_install_prompt text,
  ADD COLUMN IF NOT EXISTS pwa_description text;

-- 6) Building template SELECT policy for client managers
DO $$ BEGIN
  CREATE POLICY "Managers view their client templates" ON public.building_templates
    FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR client_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.buildings b
        WHERE b.client_id = building_templates.client_id
          AND public.is_manager_of_building(b.id)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7) RPC
CREATE OR REPLACE FUNCTION public.apply_portfolio_template(_building_id uuid, _template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_manager_of_building(_building_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO t FROM public.building_templates WHERE id = _template_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not found'; END IF;

  INSERT INTO public.building_branding (building_id) VALUES (_building_id)
  ON CONFLICT (building_id) DO NOTHING;

  UPDATE public.building_branding bb SET
    primary_color = COALESCE(bb.primary_color, t.branding->>'primary_color'),
    secondary_color = COALESCE(bb.secondary_color, t.branding->>'secondary_color'),
    accent_color = COALESCE(bb.accent_color, t.branding->>'accent_color'),
    logo_url = COALESCE(bb.logo_url, t.branding->>'logo_url'),
    favicon_url = COALESCE(bb.favicon_url, t.branding->>'favicon_url'),
    app_icon_url = COALESCE(bb.app_icon_url, t.branding->>'app_icon_url'),
    community_tagline = COALESCE(bb.community_tagline, t.branding->>'community_tagline'),
    homepage_headline = COALESCE(bb.homepage_headline, t.branding->>'homepage_headline'),
    homepage_subheadline = COALESCE(bb.homepage_subheadline, t.branding->>'homepage_subheadline'),
    typography_preset = COALESCE(bb.typography_preset, t.branding->>'typography_preset'),
    border_radius = COALESCE(bb.border_radius, t.branding->>'border_radius'),
    button_style = COALESCE(bb.button_style, t.branding->>'button_style'),
    community_voice = COALESCE(bb.community_voice, t.branding->>'community_voice'),
    email_sender_name = COALESCE(bb.email_sender_name, t.branding->>'email_sender_name'),
    email_footer_text = COALESCE(bb.email_footer_text, t.branding->>'email_footer_text')
  WHERE bb.building_id = _building_id;

  UPDATE public.buildings SET template_id = _template_id WHERE id = _building_id;
END $$;

REVOKE ALL ON FUNCTION public.apply_portfolio_template(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_portfolio_template(uuid, uuid) TO authenticated;
