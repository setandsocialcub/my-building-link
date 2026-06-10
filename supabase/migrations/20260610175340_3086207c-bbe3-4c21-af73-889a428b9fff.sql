
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL CHECK (slug IN ('privacy','terms','community-standards')),
  version integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  content text NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX legal_documents_current_per_slug
  ON public.legal_documents (slug) WHERE is_current;
CREATE INDEX legal_documents_slug_version ON public.legal_documents (slug, version DESC);

GRANT SELECT ON public.legal_documents TO anon, authenticated;
GRANT INSERT, UPDATE ON public.legal_documents TO authenticated;
GRANT ALL ON public.legal_documents TO service_role;

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read legal documents"
  ON public.legal_documents FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert legal documents"
  ON public.legal_documents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update legal documents"
  ON public.legal_documents FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER legal_documents_set_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.resident_profiles
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_privacy_at timestamptz;

INSERT INTO public.legal_documents (slug, version, title, content) VALUES
('privacy', 1, 'Privacy Policy',
$$# Privacy Policy

**Last updated:** Effective at publication.

Residence ("we", "us") is a private resident community platform. We take your privacy seriously and follow a privacy-first design.

## What we collect
- Account details: email and authentication identifiers.
- Profile details you choose to share: first name, last name, job title, interests, profile photo, and privacy level.
- Building membership: the building you joined and your role.
- Activity within your building: messages, posts, RSVPs, listings, and introductions you create.

## How we use your information
- Operate your building's private community (Circles, Community Match, Introductions, Conversations, Resident Exchange, Community Updates).
- Show your profile to neighbors based on the privacy level you choose.
- Help managers and admins keep your building safe and compliant.

## Your privacy controls
You can change your visibility at any time from Profile Settings:
- Public Within Community
- Introduction Only
- Circle Members Only
- Limited Visibility

Last name and job title are masked from neighbors unless you accept an introduction or your level is Public Within Community.

## Sharing
We do not sell your data. We do not share your profile outside your building, except with platform admins for safety and compliance.

## Retention
Your profile and content remain until you remove them or your account is deleted. Audit records (e.g. acceptance timestamps) are retained as required by law.

## Contact
For privacy requests, contact your building's manager or platform support.$$),
('terms', 1, 'Terms of Use',
$$# Terms of Use

**Last updated:** Effective at publication.

By creating an account on Residence you agree to these Terms of Use.

## Eligibility
You must be a verified resident of a participating building, or an authorized property manager or platform admin.

## Acceptable use
- Treat neighbors with respect. Harassment, hate speech, threats, and illegal content are prohibited.
- Do not impersonate others or misrepresent your identity.
- Do not use the platform for spam, unsolicited commercial messaging, or scraping.
- Marketplace listings must be lawful and accurate.

## Your content
You retain ownership of content you post. You grant Residence and your building a non-exclusive license to host and display your content within your building's community.

## Building access codes
Access codes are confidential. Sharing them outside your building is prohibited and may result in account removal.

## Termination
We may suspend or terminate accounts that violate these terms or the Community Standards.

## Disclaimers
The platform is provided "as is" without warranties. We are not responsible for interactions between residents.

## Changes
We may update these Terms. Material changes will be announced in-app and the version number will be incremented.$$),
('community-standards', 1, 'Community Standards',
$$# Community Standards

**Last updated:** Effective at publication.

Residence is a hospitality-grade community for the people who actually live in your building. These standards keep it warm, safe, and useful for everyone.

## Be a good neighbor
- Lead with kindness. Assume good intent.
- Use real first names. No anonymous accounts.
- Keep conversations relevant to your building.

## Zero tolerance
- Harassment, discrimination, hate speech, or threats.
- Sexual content or solicitation.
- Doxxing, sharing private information about other residents.
- Promoting illegal activity.

## Introductions
- Send introductions thoughtfully. Respect a decline.
- Do not message neighbors who have declined.

## Marketplace & exchange
- Be honest about price and condition.
- No firearms, controlled substances, or restricted items.

## Reporting
Use the flag button on any message or listing to report a violation. Property managers and platform admins review reports promptly.

## Enforcement
Violations may result in warnings, content removal, or account suspension. Severe violations may be reported to building management or law enforcement.$$);
