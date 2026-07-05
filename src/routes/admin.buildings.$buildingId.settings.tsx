import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Save,
  LayoutTemplate,
  RotateCcw,
  History,
  Settings as SettingsIcon,
  Users2,
  UserCog,
  Bell,
  Palette,
  BookOpen,
  Activity,
  FileText,
  ShieldCheck,
  Plug,
  Smartphone,
  Sparkles,
  Building2,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SETTINGS,
  type BuildingSettings,
} from "@/hooks/use-building-settings";

export const Route = createFileRoute("/admin/buildings/$buildingId/settings")({
  head: () => ({
    meta: [
      { title: "Settings Center — Super Admin" },
      { name: "description", content: "Configure every aspect of this building." },
    ],
  }),
  component: SettingsPage,
});

type SectionKey =
  | "general"
  | "community"
  | "residents"
  | "managers"
  | "notifications"
  | "branding"
  | "playbook"
  | "pulse"
  | "legal"
  | "security"
  | "integrations"
  | "pwa"
  | "ai";

const SECTIONS: Array<{ key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = [
  { key: "general", label: "General", icon: SettingsIcon, hint: "Building profile" },
  { key: "community", label: "Community", icon: Building2, hint: "Features & governance" },
  { key: "residents", label: "Residents", icon: Users2, hint: "Directory policies" },
  { key: "managers", label: "Managers", icon: UserCog, hint: "Access & roles" },
  { key: "notifications", label: "Notifications", icon: Bell, hint: "Delivery preferences" },
  { key: "branding", label: "Branding", icon: Palette, hint: "White label identity" },
  { key: "playbook", label: "Community Playbook™", icon: BookOpen, hint: "Launch checklist" },
  { key: "pulse", label: "Community Pulse", icon: Activity, hint: "Circles & health" },
  { key: "legal", label: "Legal", icon: FileText, hint: "Terms & policies" },
  { key: "security", label: "Security", icon: ShieldCheck, hint: "Auth & data" },
  { key: "integrations", label: "Integrations", icon: Plug, hint: "External services" },
  { key: "pwa", label: "PWA", icon: Smartphone, hint: "Installable app" },
  { key: "ai", label: "Future AI", icon: Sparkles, hint: "Intelligence layer" },
];

const FEATURE_TOGGLES: Array<{ key: keyof typeof DEFAULT_SETTINGS; label: string; description: string }> = [
  { key: "enable_circles", label: "Circles", description: "Resident interest groups and chat channels." },
  { key: "enable_experiences", label: "Experiences", description: "Building events and RSVPs." },
  { key: "enable_concierge", label: "Concierge", description: "Resident requests and assistance." },
  { key: "enable_community_board", label: "Community Board", description: "Forum threads and discussions." },
  { key: "enable_resident_exchange", label: "Resident Exchange", description: "Peer-to-peer marketplace." },
  { key: "enable_conversations", label: "Conversations", description: "Direct messages between residents." },
  { key: "enable_introductions", label: "Introductions", description: "Resident connections." },
  { key: "enable_ai_matching", label: "AI Matching", description: "Community Match recommendations." },
  { key: "enable_resident_ambassadors", label: "Resident Ambassadors", description: "Elevated trusted residents." },
];

const GOVERNANCE_TOGGLES: Array<{ key: keyof typeof DEFAULT_SETTINGS; label: string; description: string }> = [
  { key: "allow_resident_circle_creation", label: "Allow Residents to Create Circles", description: "Otherwise only managers can create new circles." },
  { key: "require_circle_approval", label: "Require Approval for New Circles", description: "Manager must approve resident-created circles." },
  { key: "limit_circle_visibility", label: "Limit Circle Visibility", description: "Block residents from creating private (invite-only) circles." },
];

type Template = {
  id: string;
  template_name: string;
  enabled_features: Record<string, boolean>;
};

type AuditEntry = {
  id: string;
  building_id: string;
  actor_user_id: string | null;
  action: "override" | "reset_to_template";
  setting_key: string | null;
  old_value: unknown;
  new_value: unknown;
  template_id: string | null;
  created_at: string;
};

function SettingsPage() {
  const { buildingId } = Route.useParams();
  const [section, setSection] = useState<SectionKey>("general");
  const [building, setBuilding] = useState<{ name: string; city: string; template_id: string | null } | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [settings, setSettings] = useState<BuildingSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<BuildingSettings | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [lastReset, setLastReset] = useState<AuditEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    const [{ data: b }, { data: s }] = await Promise.all([
      (supabase as any).from("buildings").select("name, city, template_id").eq("id", buildingId).maybeSingle(),
      (supabase as any).from("building_settings").select("*").eq("building_id", buildingId).maybeSingle(),
    ]);
    setBuilding((b as any) ?? null);
    let row = s as BuildingSettings | null;
    if (!row) {
      const { data: inserted } = await (supabase as any)
        .from("building_settings")
        .insert({ building_id: buildingId })
        .select("*")
        .maybeSingle();
      row = inserted as BuildingSettings | null;
    }
    setSettings(row);
    setOriginalSettings(row ? { ...row } : null);
    const tplId = (b as any)?.template_id as string | null;
    if (tplId) {
      const { data: t } = await (supabase as any)
        .from("building_templates")
        .select("id, template_name, enabled_features")
        .eq("id", tplId)
        .maybeSingle();
      setTemplate((t as Template | null) ?? null);
    } else {
      setTemplate(null);
    }
    const { data: audit } = await (supabase as any)
      .from("building_settings_audit")
      .select("*")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (audit as AuditEntry[] | null) ?? [];
    setAuditEntries(rows);
    setLastReset(rows.find((r) => r.action === "reset_to_template") ?? null);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadAll();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const update = (patch: Partial<BuildingSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, building_id, ...rest } = settings;
    void id;
    void building_id;
    const { error } = await (supabase as any)
      .from("building_settings")
      .update(rest)
      .eq("building_id", buildingId);
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    const ALL_KEYS = [...FEATURE_TOGGLES, ...GOVERNANCE_TOGGLES].map((t) => t.key);
    const auditRows: Array<{
      building_id: string;
      action: "override";
      setting_key: string;
      old_value: boolean;
      new_value: boolean;
      template_id: string | null;
    }> = [];
    for (const key of ALL_KEYS) {
      const before = originalSettings ? Boolean(originalSettings[key as keyof BuildingSettings]) : null;
      const after = Boolean(settings[key as keyof BuildingSettings]);
      if (before === null || before === after) continue;
      auditRows.push({
        building_id: buildingId,
        action: "override",
        setting_key: key as string,
        old_value: before,
        new_value: after,
        template_id: template?.id ?? null,
      });
    }
    if (auditRows.length > 0) {
      await (supabase as any).from("building_settings_audit").insert(auditRows);
    }

    setOriginalSettings({ ...settings });
    setSaving(false);
    toast.success("Settings saved");
    const { data: audit } = await (supabase as any)
      .from("building_settings_audit")
      .select("*")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (audit as AuditEntry[] | null) ?? [];
    setAuditEntries(rows);
    setLastReset(rows.find((r) => r.action === "reset_to_template") ?? null);
  };

  const resetToTemplate = async () => {
    if (!template) return;
    if (!confirm(`Reset feature toggles to match the "${template.template_name}" template?`)) return;
    setResetting(true);
    const { error } = await (supabase as any).rpc("apply_template_to_building", {
      _building_id: buildingId,
      _template_id: template.id,
    });
    if (error) {
      setResetting(false);
      toast.error(error.message);
      return;
    }
    await loadAll();
    setResetting(false);
    toast.success("Settings reset to template");
  };

  const expectedFromTemplate = (key: keyof typeof DEFAULT_SETTINGS): boolean | null => {
    if (!template) return null;
    const features = template.enabled_features ?? {};
    if (Object.prototype.hasOwnProperty.call(features, key)) {
      return Boolean(features[key]);
    }
    const FEATURE_KEYS = new Set([
      "enable_circles", "enable_experiences", "enable_concierge", "enable_community_board",
      "enable_resident_exchange", "enable_introductions", "enable_ai_matching",
      "enable_resident_ambassadors", "allow_resident_circle_creation",
    ]);
    if (FEATURE_KEYS.has(key as string)) return false;
    if (key === "enable_conversations") return true;
    return null;
  };

  const overrideCount = useMemo(() => {
    if (!settings) return 0;
    return [...FEATURE_TOGGLES, ...GOVERNANCE_TOGGLES].filter((t) => {
      const expected = expectedFromTemplate(t.key);
      if (expected === null) return false;
      return Boolean(settings[t.key]) !== expected;
    }).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, template]);

  if (loading || !settings) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px]">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Settings Center</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Everything about {building?.name ?? "this building"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          One command center for the entire resident experience — from features and governance to branding, notifications, and future AI.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <nav className="lg:sticky lg:top-20 self-start rounded-2xl border border-border bg-card p-2 shadow-sm">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left transition-colors",
                  active
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-6">
          {section === "general" && (
            <GeneralPanel buildingId={buildingId} />
          )}

          {section === "community" && (
            <>
              <TemplateBanner
                template={template}
                overrideCount={overrideCount}
                lastReset={lastReset}
                resetting={resetting}
                onReset={resetToTemplate}
              />
              <Card title="Features" subtitle="Toggle resident-facing modules for this building.">
                <div className="divide-y divide-border">
                  {FEATURE_TOGGLES.map((t) => (
                    <ToggleRow
                      key={t.key}
                      label={t.label}
                      description={t.description}
                      checked={settings[t.key] as boolean}
                      expected={expectedFromTemplate(t.key)}
                      onChange={(v) => update({ [t.key]: v } as Partial<BuildingSettings>)}
                      onReset={() => {
                        const e = expectedFromTemplate(t.key);
                        if (e !== null) update({ [t.key]: e } as Partial<BuildingSettings>);
                      }}
                    />
                  ))}
                </div>
              </Card>
              <Card title="Governance" subtitle="Control how circles are created and approved.">
                <div className="divide-y divide-border">
                  {GOVERNANCE_TOGGLES.map((t) => (
                    <ToggleRow
                      key={t.key}
                      label={t.label}
                      description={t.description}
                      checked={settings[t.key] as boolean}
                      expected={expectedFromTemplate(t.key)}
                      onChange={(v) => update({ [t.key]: v } as Partial<BuildingSettings>)}
                      onReset={() => {
                        const e = expectedFromTemplate(t.key);
                        if (e !== null) update({ [t.key]: e } as Partial<BuildingSettings>);
                      }}
                    />
                  ))}
                </div>
              </Card>
              <Card title="Presentation" subtitle="Community style and theme presets.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Theme</Label>
                    <Select value={settings.theme} onValueChange={(v) => update({ theme: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hospitality">Hospitality (default)</SelectItem>
                        <SelectItem value="modern">Modern</SelectItem>
                        <SelectItem value="classic">Classic</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Community Style</Label>
                    <Select value={settings.community_style} onValueChange={(v) => update({ community_style: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="luxury">Luxury</SelectItem>
                        <SelectItem value="boutique">Boutique</SelectItem>
                        <SelectItem value="family">Family</SelectItem>
                        <SelectItem value="urban">Urban</SelectItem>
                        <SelectItem value="wellness">Wellness</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Custom theme key</Label>
                    <Input
                      value={settings.theme}
                      onChange={(e) => update({ theme: e.target.value })}
                      placeholder="hospitality"
                    />
                    <p className="text-xs text-muted-foreground">
                      Reserved for future white-label themes loaded at runtime.
                    </p>
                  </div>
                </div>
              </Card>
              <div className="flex justify-end">
                <Button onClick={save} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save changes
                </Button>
              </div>
              <AuditLog entries={auditEntries} />
            </>
          )}

          {section === "residents" && (
            <ModuleLink
              icon={Users2}
              title="Resident directory & policies"
              description="Review resident profiles, manage suspensions, and configure invitation flows."
              to="/admin/buildings/$buildingId/residents"
              buildingId={buildingId}
              cta="Open resident manager"
            />
          )}

          {section === "managers" && (
            <ModuleLink
              icon={UserCog}
              title="Managers & permissions"
              description="Grant manager access, configure granular permissions, and rotate access codes."
              to="/admin/buildings/$buildingId/managers"
              buildingId={buildingId}
              cta="Open manager settings"
            />
          )}

          {section === "notifications" && (
            <NotificationsPanel />
          )}

          {section === "branding" && (
            <ModuleLink
              icon={Palette}
              title="White label branding"
              description="Configure logos, colors, splash screens, email branding, and every visual touchpoint for residents of this building."
              to="/admin/buildings/$buildingId/branding"
              buildingId={buildingId}
              cta="Open branding studio"
            />
          )}

          {section === "playbook" && (
            <ModuleLink
              icon={BookOpen}
              title="Community Playbook™"
              description="Interactive launch checklist to shepherd this building from onboarding to a thriving community."
              to="/admin/buildings/$buildingId/playbook"
              buildingId={buildingId}
              cta="Open Playbook"
            />
          )}

          {section === "pulse" && (
            <ModuleLink
              icon={Activity}
              title="Community Pulse"
              description="Create and moderate circles, approve members, and monitor engagement across the building."
              to="/admin/buildings/$buildingId/pulse"
              buildingId={buildingId}
              cta="Open Pulse Management"
            />
          )}

          {section === "legal" && (
            <ModuleLink
              icon={FileText}
              title="Legal documents"
              description="Terms, privacy, and community standards — versioned centrally so residents always accept the current text."
              to="/admin/buildings/$buildingId/legal"
              buildingId={buildingId}
              cta="Open legal library"
            />
          )}

          {section === "security" && <SecurityPanel />}
          {section === "integrations" && <IntegrationsPanel />}
          {section === "pwa" && <PwaPanel buildingId={buildingId} />}
          {section === "ai" && (
            <AIPanel
              enabled={settings.enable_ai_matching}
              onToggle={(v) => update({ enable_ai_matching: v })}
              onSave={save}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-serif text-xl font-semibold mb-1">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mb-5">{subtitle}</p>}
      {children}
    </section>
  );
}

function GeneralPanel({ buildingId }: { buildingId: string }) {
  return (
    <Card title="General" subtitle="Core information about this building lives on the Information tab.">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Building name, city, address, unit count, amenities, and community intro.
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
          <Link to="/admin/buildings/$buildingId" params={{ buildingId }}>
            Open information <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function ModuleLink({
  icon: Icon,
  title,
  description,
  to,
  buildingId,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  to: string;
  buildingId: string;
  cta: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-primary/10 text-primary p-3">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <Button asChild className="gap-2 shrink-0">
          <Link to={to} params={{ buildingId }}>
            {cta} <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function NotificationsPanel() {
  const [state, setState] = useState({
    email_digest: true,
    event_reminders: true,
    announcements: true,
    circle_activity: false,
    weekly_manager_report: true,
  });
  const rows: Array<{ key: keyof typeof state; label: string; description: string }> = [
    { key: "email_digest", label: "Resident email digest", description: "Weekly recap of activity delivered to residents." },
    { key: "event_reminders", label: "Event reminders", description: "Push and email reminders before RSVPed events." },
    { key: "announcements", label: "Announcement notifications", description: "Notify residents when managers post announcements." },
    { key: "circle_activity", label: "Circle activity", description: "Notify members of new posts in their circles." },
    { key: "weekly_manager_report", label: "Weekly manager report", description: "Email a Community Health™ summary to managers." },
  ];
  return (
    <Card title="Notifications" subtitle="Delivery preferences for this building. Applies to residents and managers.">
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <div className="font-medium text-sm">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.description}</div>
            </div>
            <Switch
              checked={state[r.key]}
              onCheckedChange={(v) => setState((s) => ({ ...s, [r.key]: v }))}
            />
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={() => toast.success("Notification preferences saved")} className="gap-2">
          <Save className="h-4 w-4" /> Save preferences
        </Button>
      </div>
    </Card>
  );
}

function SecurityPanel() {
  return (
    <div className="space-y-4">
      <Card title="Authentication" subtitle="How residents and managers sign in to this building.">
        <div className="divide-y divide-border">
          <StaticRow label="Email + password" value="Enabled" tone="ok" />
          <StaticRow label="Google sign-in" value="Enabled" tone="ok" />
          <StaticRow label="Two-factor authentication" value="Coming soon" tone="pending" />
          <StaticRow label="SSO / SAML" value="Contact sales" tone="pending" />
        </div>
      </Card>
      <Card title="Data protection" subtitle="Row-Level Security guarantees each building's data stays isolated.">
        <div className="divide-y divide-border">
          <StaticRow label="Row-Level Security" value="Enforced on all resident tables" tone="ok" />
          <StaticRow label="Building isolation" value="Residents only see their own building" tone="ok" />
          <StaticRow label="Audit log" value="Manager overrides tracked per building" tone="ok" />
        </div>
      </Card>
    </div>
  );
}

function IntegrationsPanel() {
  const items = [
    { name: "Stripe", description: "Collect rent, deposits, and marketplace payments.", status: "Available" },
    { name: "Slack", description: "Route flagged content and alerts into a management channel.", status: "Coming soon" },
    { name: "Google Calendar", description: "Sync building experiences to resident calendars.", status: "Coming soon" },
    { name: "Zapier", description: "Trigger workflows from resident events.", status: "Coming soon" },
    { name: "Webhooks", description: "Send building events to any HTTPS endpoint.", status: "Coming soon" },
  ];
  return (
    <Card title="Integrations" subtitle="Connect this building to the external tools your team already uses.">
      <div className="divide-y divide-border">
        {items.map((i) => (
          <div key={i.name} className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <div className="font-medium text-sm">{i.name}</div>
              <div className="text-xs text-muted-foreground">{i.description}</div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                i.status === "Available"
                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                  : "text-muted-foreground",
              )}
            >
              {i.status}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PwaPanel({ buildingId }: { buildingId: string }) {
  const manifestUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/manifest/${buildingId}` : "";
  return (
    <div className="space-y-4">
      <Card title="Progressive Web App" subtitle="Residents can install this building as a native-feeling app on any device.">
        <div className="divide-y divide-border">
          <StaticRow label="Installable" value="Enabled" tone="ok" />
          <StaticRow label="Offline shell" value="Not enabled" tone="pending" />
          <StaticRow label="Push notifications" value="Coming soon" tone="pending" />
        </div>
      </Card>
      <Card title="Manifest" subtitle="Per-building manifest served with white-label branding.">
        <div className="flex items-center gap-2">
          <Input readOnly value={manifestUrl} onFocus={(e) => e.currentTarget.select()} />
          <Button
            variant="outline"
            onClick={() => {
              if (!manifestUrl) return;
              navigator.clipboard.writeText(manifestUrl);
              toast.success("Manifest URL copied");
            }}
          >
            Copy
          </Button>
        </div>
      </Card>
    </div>
  );
}

function AIPanel({
  enabled,
  onToggle,
  onSave,
  saving,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card title="Community Match™" subtitle="AI-powered neighbor recommendations based on shared interests.">
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="min-w-0">
            <div className="font-medium text-sm">Enable AI matching</div>
            <div className="text-xs text-muted-foreground">Suggest circles, neighbors, and events tailored to each resident.</div>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
      </Card>
      <Card title="Future intelligence" subtitle="Roadmap capabilities that will roll into this building automatically.">
        <div className="divide-y divide-border">
          <StaticRow label="AI Concierge" value="Coming soon" tone="pending" />
          <StaticRow label="Auto-moderation" value="Coming soon" tone="pending" />
          <StaticRow label="Community Health forecasts" value="Coming soon" tone="pending" />
          <StaticRow label="Belonging Score™ explanations" value="Coming soon" tone="pending" />
        </div>
      </Card>
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save AI settings
        </Button>
      </div>
    </div>
  );
}

function StaticRow({ label, value, tone }: { label: string; value: string; tone: "ok" | "pending" }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="text-sm">{label}</div>
      <Badge
        variant="outline"
        className={cn(
          tone === "ok"
            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            : "text-muted-foreground",
        )}
      >
        {value}
      </Badge>
    </div>
  );
}

function TemplateBanner({
  template,
  overrideCount,
  lastReset,
  resetting,
  onReset,
}: {
  template: Template | null;
  overrideCount: number;
  lastReset: AuditEntry | null;
  resetting: boolean;
  onReset: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 text-primary p-2">
          <LayoutTemplate className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Template</span>
            {template ? (
              <Badge variant="secondary" className="font-medium">{template.template_name}</Badge>
            ) : (
              <Badge variant="outline" className="font-normal text-muted-foreground">None assigned</Badge>
            )}
            {template && (
              overrideCount > 0 ? (
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                  {overrideCount} manager override{overrideCount === 1 ? "" : "s"}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                  Inheriting template
                </Badge>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Toggles differing from the template are marked “Overridden”. Reset any time to return to template defaults.
          </p>
          {lastReset && (
            <p className="text-xs text-muted-foreground mt-1">
              Last reset to template {formatDistanceToNow(new Date(lastReset.created_at), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>
      {template && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={resetting || overrideCount === 0}
          className="gap-2"
        >
          {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Reset to template
        </Button>
      )}
    </section>
  );
}

function AuditLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-serif text-xl font-semibold">Audit Log</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Recent manager overrides and template resets for this building.
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No changes recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                {entry.action === "reset_to_template" ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                      Reset to template
                    </Badge>
                    <span className="text-sm text-muted-foreground">All toggles restored to template defaults</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                      Override
                    </Badge>
                    <span className="text-sm font-medium">{entry.setting_key}</span>
                    <span className="text-xs text-muted-foreground">
                      {String(entry.old_value)} → <span className="font-medium text-foreground">{String(entry.new_value)}</span>
                    </span>
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(entry.created_at).toLocaleString()}>
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  expected,
  onChange,
  onReset,
}: {
  label: string;
  description: string;
  checked: boolean;
  expected: boolean | null;
  onChange: (v: boolean) => void;
  onReset: () => void;
}) {
  const overridden = expected !== null && checked !== expected;
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{label}</span>
          {overridden && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition-colors"
              title={`Template default: ${expected ? "On" : "Off"} — click to reset`}
            >
              <RotateCcw className="h-3 w-3" /> Overridden
            </button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{description}</div>
        {overridden && (
          <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-1">
            Template default: <span className="font-medium">{expected ? "On" : "Off"}</span>
          </div>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
