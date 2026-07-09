
# OONAH 2.0 — Hospitality OS Foundation

This is a major release. Rather than ship all four workstreams shallowly, I'll deliver them in a coordinated Phase 1 that gets the core architecture, the visible White Label Studio, and the enterprise hierarchy in place — with clear stubs where deeper work (email templating pipelines, live CDN cache-busting, custom-domain SSL orchestration) is handed off to platform primitives (Lovable Cloud, DNS UI, existing email-domain tools) instead of reinvented.

## What ships in Phase 1

### 1. Fix the broken buttons (Day-1 unblocker)
The Branding and Settings buttons on the admin buildings list don't navigate. Root cause: shadcn `Button asChild` wraps the TanStack `<Link>` in a Radix `Slot`, and on some renders the Slot merges refs but the underlying anchor's `onClick` short-circuits. Replacement: render the anchor natively via `<Link>` with `buttonVariants({ variant, size })` classes — same look, real anchor, works with cmd-click and preload. Applied everywhere `Button asChild` wraps a `Link` in `admin.tsx` and any other admin surfaces with the same pattern.

### 2. Data model — Clients + Industry + Portfolio Templates
One migration:
- New `public.clients` table: organization above buildings (id, name, slug, industry_type, portfolio_template_id, created_at). `buildings.client_id` FK added (nullable — existing rows stay independent).
- New enum `public.industry_type`: `luxury_residential | multifamily | boutique_hotel | branded_residence | student_housing | senior_living | corporate_housing | private_club | mixed_use`. Added to `buildings.industry_type` (default `luxury_residential`) and `clients.industry_type`.
- Extend existing `public.building_templates` into portfolio templates: adds `client_id`, `branding` JSONB (colors/logos/typography defaults), `legal_defaults` JSONB, `notification_defaults` JSONB. Existing `enabled_features` behavior preserved.
- New RPC `public.apply_portfolio_template(_building_id, _template_id)`: copies template branding into `building_branding` only for fields the building hasn't overridden (null-preserving merge), calls existing `apply_template_to_building` for feature flags.
- RLS: clients readable by admins + managers of any building in the client; portfolio templates readable inside the client scope. Full GRANTs on every new table.

### 3. Industry Mode terminology
New `src/lib/industry.ts` — pure function map keyed by `industry_type`:
```ts
terminology(industry): { resident, residents, community, manager, dashboard, welcomeVerb }
```
New `useIndustryTerms()` hook reads the current building's industry from `BrandingProvider` context (extended to fetch industry alongside branding). Swap hardcoded "Resident" / "Community" strings in the highest-visibility surfaces (nav labels, welcome headline, discover empty state, manager dashboard header) to the term map. Not a full string audit — targeted to the ~20 user-visible strings that matter.

### 4. White Label Studio (rebuild `BrandingEditor.tsx`)
Turn the current 967-line single-panel form into a tabbed studio matching the Shopify/Webflow shape:

```text
┌─────────────────────────────────────────────────────────┐
│  White Label Studio            [Preview ▾]  [Publish]   │
├──────────┬──────────────────────────────────────────────┤
│ Identity │  Panel content (form)     │ Live Preview     │
│ Appear.  │                           │ ┌──────────────┐ │
│ Login    │                           │ │  Device      │ │
│ Emails   │                           │ │  simulator   │ │
│ PWA      │                           │ │  (desktop /  │ │
│ Legal    │                           │ │   tablet /   │ │
│ Voice    │                           │ │   mobile)    │ │
│ Domain   │                           │ └──────────────┘ │
└──────────┴──────────────────────────────────────────────┘
```

Tabs:
- **Identity** — Company / Community / Building name, tagline, welcome headline, description, logo/secondary/icon/favicon/splash/mobile-app-icon uploads (all existing branding fields already stored — this reorganizes UI).
- **Appearance** — primary/secondary/accent, border radius, button style (rounded/sharp/pill), typography preset (Serif Editorial / Sans Modern / Humanist), light/dark toggle. Radius/typography/button-style are new columns on `building_branding` (adds 4 fields).
- **Login** — resident/manager/admin login image, welcome copy, custom button label (new field), forgot-password copy.
- **Emails** — sender name, reply-to, from-address preview, footer text, signature. Storage only in Phase 1; wiring into actual email templates deferred to Phase 2 (needs `email_domain--setup_email_infra`).
- **PWA** — app name, short name, theme color, install prompt copy, description. Feeds existing `/api/public/manifest/:buildingId` route.
- **Legal** — links to existing building_legal_documents editor (not rebuilt).
- **Voice** — tone dropdown (Luxury/Professional/Warm/Boutique/Playful/Corporate/Family/Hospitality). Stored as `community_voice` — used later to seed notification/email copy.
- **Domain** — DNS instruction card that opens Lovable's Project Settings → Domains flow (does NOT reimplement DNS/SSL).

**Live Preview panel** — right-side iframe-style card that renders a scaled miniature of the resident home using the current draft branding (via existing `setPreviewDraft` in BrandingProvider). Device toggle switches container width (390 / 820 / 1280). No new iframe — a scaled div with pointer-events:none is enough and avoids cross-frame branding sync.

**Publish Brand** button — writes draft → published columns (existing `published_at` timestamp), triggers `window.dispatchEvent(new Event("branding:changed"))` (BrandingProvider already listens), regenerates manifest URL (already dynamic), shows success toast. Cache-busting/CDN refresh is a no-op comment — Lovable serves fresh HTML with revalidation headers.

### 5. Super Admin — Clients hierarchy UI (minimum viable)
- `/admin` gets a "Clients" section above buildings: list clients with building counts, "New client" dialog (name + industry).
- Building create flow gains an optional "Belongs to client" dropdown + "Apply portfolio template" action.
- Portfolio template editor at `/admin/clients/$clientId/template` — reuses BrandingEditor UI in "template mode" (writes to `building_templates.branding` JSON instead of `building_branding`).

## What's explicitly deferred to Phase 2

- Email template pipeline wired to `email_domain--scaffold_transactional_email` (needs domain first).
- SMS branding (no SMS provider connected).
- Push notification white-labeling in installed PWAs beyond manifest name.
- Full string audit for terminology (Phase 1 covers headers/nav/welcome only).
- Manager-facing brand studio (Phase 1 exposes it to admins; managers see the existing simpler editor).
- Custom domain automation beyond linking to Lovable's DNS flow.

## Technical notes

- All new/modified `public` tables get GRANTs in the same migration.
- `BrandingProvider` extended once to also load `client` and `industry_type`; no other providers added.
- No new npm packages required. Existing shadcn Tabs + form primitives cover the studio UI.
- Route additions: `/admin/clients`, `/admin/clients/$clientId`, `/admin/clients/$clientId/template`. Existing branding route reused.
- Server functions: `applyPortfolioTemplate` (createServerFn + requireSupabaseAuth + admin-role check) wraps the RPC.

## Order of work in this pass
1. Migration (clients, industry_type, portfolio template extension, new branding fields, RPC).
2. Fix broken buttons.
3. `src/lib/industry.ts` + `useIndustryTerms` + swap high-visibility strings.
4. Rebuild BrandingEditor as tabbed studio with live preview + Publish.
5. `/admin/clients` routes and building↔client assignment.

Ship, then follow up on Phase 2 (emails, deeper terminology, manager studio).
