import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
];

function SettingsPage() {
  const { buildingId } = Route.useParams();
  const [building, setBuilding] = useState<{ name: string; city: string } | null>(null);
  const [settings, setSettings] = useState<BuildingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: b }, { data: s }] = await Promise.all([
        supabase.from("buildings").select("name, city").eq("id", buildingId).maybeSingle(),
        (supabase as any).from("building_settings").select("*").eq("building_id", buildingId).maybeSingle(),
      ]);
      if (cancelled) return;
      setBuilding((b as { name: string; city: string } | null) ?? null);
      if (s) {
        setSettings(s as BuildingSettings);
      } else {
        // Ensure a row exists.
        const { data: inserted } = await (supabase as any)
          .from("building_settings")
          .insert({ building_id: buildingId })
          .select("*")
          .maybeSingle();
        if (!cancelled && inserted) setSettings(inserted as BuildingSettings);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
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

  if (loading || !settings) {
    return (
      <main className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Buildings
        </Link>

        <header className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Building Settings</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
            {building?.name ?? "Building"}
          </h1>
          {building?.city && (
            <p className="text-sm text-muted-foreground mt-1">{building.city}</p>
          )}
        </header>

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
                onChange={(v) => update({ [t.key]: v } as Partial<BuildingSettings>)}
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
                onChange={(v) => update({ [t.key]: v } as Partial<BuildingSettings>)}
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
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
