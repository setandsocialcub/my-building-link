## Sprint 2 — Super Admin Building Administration

Turn each building into a full workspace. Building name becomes a link to a new **Building Administration** page with a left sidebar and 12 sections, styled like Linear/Notion/Stripe (dense, neutral surfaces, subtle borders, mono/sans pairing, keyboard-friendly).

### Route architecture

New nested route tree under `_authenticated` (admin-gated at page level, matching the existing `admin.tsx` role check pattern):

```
src/routes/
  admin.buildings.$buildingId.tsx              → layout: sidebar + <Outlet/>
  admin.buildings.$buildingId.index.tsx        → Building Information (default)
  admin.buildings.$buildingId.branding.tsx     → (exists — keep)
  admin.buildings.$buildingId.settings.tsx     → (exists — keep, moved into sidebar)
  admin.buildings.$buildingId.playbook.tsx     → Community Playbook™
  admin.buildings.$buildingId.pulse.tsx        → embeds /pulse view
  admin.buildings.$buildingId.managers.tsx
  admin.buildings.$buildingId.residents.tsx
  admin.buildings.$buildingId.events.tsx
  admin.buildings.$buildingId.analytics.tsx
  admin.buildings.$buildingId.neighborhood.tsx
  admin.buildings.$buildingId.legal.tsx
  admin.buildings.$buildingId.danger.tsx       → Delete / Archive
```

In `admin.tsx`, make the building name a `<Link to="/admin/buildings/$buildingId">`.

### Database (single migration)

Extend `buildings` with the info fields (all nullable, safe defaults):
`address text, description text, property_type text, unit_count int, floor_count int, amenities text[], contact_email text, contact_phone text, website text, community_intro text, archived_at timestamptz, status text default 'active'`.

New tables:
- `manager_permissions` (manager_id, permission text) — permission enum: `manage_residents`, `manage_events`, `manage_playbook`, `manage_branding`, `manage_settings`, `manage_legal`. Managers get all by default via seeding.
- `resident_suspensions` (resident_id, reason, suspended_by, suspended_at, lifted_at)
- `resident_invites` (building_id, email, invite_code, invited_by, accepted_at, expires_at)
- `neighborhood_places` (building_id, name, category, address, notes, url, lat, lng, order_index)

Adds `disabled_at timestamptz` to `property_managers`. All new tables: full GRANT block, RLS enabled, policies scoped to `has_role('admin')` OR `is_manager_of_building()` where appropriate.

### Building Administration layout

```text
┌─ Header: ← Buildings   ·   {Building name}   {status badge}   Sign out
├─ Sidebar (240px)                       Main
│  Information                           <Outlet/>
│  Branding
│  Community Playbook
│  Community Pulse
│  Managers
│  Residents
│  Events
│  Analytics
│  Neighborhood Guide
│  Legal Documents
│  Settings
│  ───
│  Danger zone
```

Enterprise chrome: `bg-background`, sidebar `bg-card border-r`, active row `bg-muted text-foreground`, section headers `text-xs uppercase tracking-wider text-muted-foreground`, dense tables, quiet secondary buttons.

### Section scope (each is one route file)

- **Information** — form for every field listed in the brief; amenities as tag input; save via single `update buildings`.
- **Branding** — reuse existing `BrandingEditor`.
- **Community Playbook™** — checklist of onboarding milestones per building (uses existing template + editable overrides); ship the UI scaffold + completion percentage read-out.
- **Community Pulse** — embed the existing `/pulse/$buildingId` component.
- **Managers** — table of managers with Add (issues invite code), Disable/Enable, Remove, Permissions dropdown (checkbox list writing `manager_permissions`).
- **Residents** — searchable/filterable table; row actions: view profile, suspend (writes `resident_suspensions`), remove (delete profile); "Invite residents" panel that generates `resident_invites` rows with codes.
- **Events** — list events for the building with status filter; create/edit/cancel actions using existing `events` table.
- **Analytics** — cards for Residents, Events, Circle Activity, Playbook Completion, Pulse average, Engagement (7d active), Belonging Score™, Community Health™ (composite formulas defined in `src/lib/pulse-analytics.ts` extension). Uses `supabase--read_query`-style client queries.
- **Neighborhood Guide** — CRUD list of places for the building.
- **Legal Documents** — per-building overrides of `legal_documents` (reuses existing admin legal UI, scoped to building).
- **Settings** — reuse existing settings page.
- **Danger zone** — Archive (sets `status='archived'`, `archived_at=now()`) and Delete (hard delete with double-confirm typing building name).

### Technical notes

- All data access via the browser `supabase` client under RLS (admin role passes `has_role`).
- Belonging Score™ = weighted composite of accepted introductions per resident, circle memberships, event RSVP rate, message activity — computed client-side from existing tables; formula documented inline.
- Community Health™ = 0–100 rollup of Belonging + Pulse + 30d engagement.
- Keep changes UI-first: no edge functions, no new server fns.

### Out of scope (call out to user)

- Real-time collab cursors, bulk CSV import/export, and email delivery for invites — invites generate codes only in this sprint.
