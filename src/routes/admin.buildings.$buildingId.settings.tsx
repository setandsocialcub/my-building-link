import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save, LogOut, LayoutTemplate, RotateCcw, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DEFAULT_SETTINGS,
  type BuildingSettings,
} from "@/hooks/use-building-settings";

export const Route = createFileRoute("/admin/buildings/$buildingId/settings")({
  head: () => ({
    meta: [
      { title: "Building Settings — Super Admin" },
      { name: "description", content: "Configure features for this building." },
    ],
  }),
  component: BuildingSettingsGate,
});

type AuthState = "loading" | "not-admin" | "admin";

function BuildingSettingsGate() {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user?.id;
      if (!uid) {
        navigate({ to: "/super-admin-login" });
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      setState(role ? "admin" : "not-admin");
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (state === "loading") {
    return <main className="min-h-screen grid place-items-center text-muted-foreground">Loading…</main>;
  }
  if (state === "not-admin") {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-6">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="text-sm text-muted-foreground">Only super admins can manage building settings.</p>
          <Button variant="outline" onClick={() => supabase.auth.signOut()} className="gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </main>
    );
  }
  return <SettingsPage />;
}

const FEATURE_TOGGLES: Array<{
  key: keyof typeof DEFAULT_SETTINGS;
  label: string;
  description: string;
}> = [
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

const GOVERNANCE_TOGGLES: Array<{
  key: keyof typeof DEFAULT_SETTINGS;
  label: string;
  description: string;
}> = [
  { key: "allow_resident_circle_creation", label: "Allow Residents to Create Circles", description: "Otherwise only managers can create new circles." },
  { key: "require_circle_approval", label: "Require Approval for New Circles", description: "Manager must approve resident-created circles." },
  { key: "limit_circle_visibility", label: "Limit Circle Visibility", description: "Block residents from creating private (invite-only) circles." },
];

type Template = {
  id: string;
  template_name: string;
  enabled_features: Record<string, boolean>;
};

function SettingsPage() {
  const { buildingId } = Route.useParams();
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
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Settings saved");
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

  if (loading || !settings) {
    return (
      <main className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }

  // Compute the expected value from the template for any toggle.
  // Returns null when the template has no opinion (e.g. governance toggles).
  const expectedFromTemplate = (key: keyof typeof DEFAULT_SETTINGS): boolean | null => {
    if (!template) return null;
    const features = template.enabled_features ?? {};
    if (Object.prototype.hasOwnProperty.call(features, key)) {
      return Boolean(features[key]);
    }
    // The apply RPC turns off everything not listed (except conversations, which stays on)
    // for the feature-toggle set. Mirror that so "off" toggles still show parity.
    const FEATURE_KEYS = new Set([
      "enable_circles", "enable_experiences", "enable_concierge", "enable_community_board",
      "enable_resident_exchange", "enable_introductions", "enable_ai_matching",
      "enable_resident_ambassadors", "allow_resident_circle_creation",
    ]);
    if (FEATURE_KEYS.has(key as string)) return false;
    if (key === "enable_conversations") return true;
    return null;
  };

  const overrideCount = [...FEATURE_TOGGLES, ...GOVERNANCE_TOGGLES].filter((t) => {
    const expected = expectedFromTemplate(t.key);
    if (expected === null) return false;
    return Boolean(settings[t.key]) !== expected;
  }).length;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Buildings
        </Link>

        <header className="mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Building Settings</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
            {building?.name ?? "Building"}
          </h1>
          {building?.city && (
            <p className="text-sm text-muted-foreground mt-1">{building.city}</p>
          )}
        </header>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm mb-6 flex items-start justify-between gap-4 flex-wrap">
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
            </div>
          </div>
          {template && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetToTemplate}
              disabled={resetting || overrideCount === 0}
              className="gap-2"
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Reset to template
            </Button>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm mb-6">
          <h2 className="font-serif text-xl font-semibold mb-1">Features</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Toggle resident-facing features for this building.
          </p>
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
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm mb-6">
          <h2 className="font-serif text-xl font-semibold mb-1">Governance</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Control how circles are created and approved.
          </p>
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
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm mb-6">
          <h2 className="font-serif text-xl font-semibold mb-1">Branding</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Visual identity for this building. Prepares for future white-labeling.
          </p>
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
        </section>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>
    </main>
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

