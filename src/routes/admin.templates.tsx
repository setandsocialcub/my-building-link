import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/templates")({
  head: () => ({
    meta: [
      { title: "Building Templates — Super Admin" },
      { name: "description", content: "Manage building templates." },
    ],
  }),
  component: TemplatesGate,
});

type Template = {
  id: string;
  template_name: string;
  template_description: string | null;
  enabled_features: Record<string, boolean>;
  recommended_circles: string[];
  homepage_priority: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export const FEATURE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "enable_ai_matching", label: "Community Match" },
  { key: "enable_introductions", label: "Introductions" },
  { key: "enable_experiences", label: "Experiences" },
  { key: "enable_concierge", label: "Resident Concierge" },
  { key: "enable_resident_ambassadors", label: "Resident Ambassadors" },
  { key: "enable_circles", label: "Circles" },
  { key: "allow_resident_circle_creation", label: "Resident-Created Circles" },
  { key: "enable_community_board", label: "Community Board / Updates" },
  { key: "enable_resident_exchange", label: "Resident Exchange" },
  { key: "enable_conversations", label: "Conversations (DMs)" },
];

function TemplatesGate() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "not-admin" | "admin">("loading");

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
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="text-sm text-muted-foreground">Only super admins can manage templates.</p>
        </div>
      </main>
    );
  }
  return <TemplatesPage />;
}

function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("building_templates")
      .select("*")
      .order("is_system", { ascending: false })
      .order("template_name");
    setTemplates((data as Template[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onDuplicate = async (t: Template) => {
    const { error } = await (supabase as any).from("building_templates").insert({
      template_name: `${t.template_name} (Copy)`,
      template_description: t.template_description,
      enabled_features: t.enabled_features,
      recommended_circles: t.recommended_circles,
      homepage_priority: t.homepage_priority,
      is_system: false,
    });
    if (error) return toast.error(error.message);
    toast.success("Template duplicated");
    load();
  };

  const onDelete = async (t: Template) => {
    if (t.is_system) return toast.error("System templates cannot be deleted");
    if (!confirm(`Delete template "${t.template_name}"?`)) return;
    const { error } = await (supabase as any).from("building_templates").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Template deleted");
    load();
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <Button asChild variant="ghost" size="sm" className="gap-2 mb-2 -ml-2">
              <Link to="/admin"><ArrowLeft className="h-4 w-4" /> Buildings</Link>
            </Button>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Super Admin</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Building Templates</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Predefined resident engagement configurations applied when a building is created.
            </p>
          </div>
          <Button onClick={() => setCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </header>

        {loading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {templates.map((t) => (
              <article key={t.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">{t.template_name}</h2>
                    {t.is_system && <Badge variant="secondary" className="mt-1.5">System</Badge>}
                  </div>
                </div>
                {t.template_description && (
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{t.template_description}</p>
                )}
                <div className="mt-4 space-y-3 text-sm flex-1">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Enabled features</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FEATURE_OPTIONS.filter((f) => t.enabled_features?.[f.key]).map((f) => (
                        <Badge key={f.key} variant="outline" className="font-normal">{f.label}</Badge>
                      ))}
                    </div>
                  </div>
                  {t.recommended_circles?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Recommended circles</p>
                      <p className="text-foreground/80">{t.recommended_circles.join(" · ")}</p>
                    </div>
                  )}
                  {t.homepage_priority?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Homepage priority</p>
                      <ol className="list-decimal list-inside text-foreground/80 space-y-0.5">
                        {t.homepage_priority.map((p, i) => <li key={i}>{p}</li>)}
                      </ol>
                    </div>
                  )}
                </div>
                <div className="mt-5 pt-4 border-t border-border/60 flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(t)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onDuplicate(t)}>
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </Button>
                  {!t.is_system && (
                    <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => onDelete(t)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {(editing || creating) && (
          <TemplateEditor
            template={editing}
            onClose={() => { setEditing(null); setCreating(false); }}
            onSaved={() => { setEditing(null); setCreating(false); load(); }}
          />
        )}
      </div>
    </main>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.template_name ?? "");
  const [description, setDescription] = useState(template?.template_description ?? "");
  const [features, setFeatures] = useState<Record<string, boolean>>(template?.enabled_features ?? {});
  const [circles, setCircles] = useState((template?.recommended_circles ?? []).join("\n"));
  const [priority, setPriority] = useState((template?.homepage_priority ?? []).join("\n"));
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!name.trim()) return toast.error("Template name required");
    setSaving(true);
    const payload = {
      template_name: name.trim(),
      template_description: description.trim() || null,
      enabled_features: features,
      recommended_circles: circles.split("\n").map((s) => s.trim()).filter(Boolean),
      homepage_priority: priority.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    const q = template
      ? (supabase as any).from("building_templates").update(payload).eq("id", template.id)
      : (supabase as any).from("building_templates").insert({ ...payload, is_system: false });
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(template ? "Template updated" : "Template created");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
          <h2 className="text-lg font-semibold">{template ? "Edit template" : "New template"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </header>
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Template name</Label>
            <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2.5">
            <Label>Enabled features</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FEATURE_OPTIONS.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-background">
                  <span className="text-sm">{f.label}</span>
                  <Switch
                    checked={!!features[f.key]}
                    onCheckedChange={(v) => setFeatures((s) => ({ ...s, [f.key]: v }))}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-circles">Recommended circles (one per line)</Label>
            <Textarea id="t-circles" value={circles} onChange={(e) => setCircles(e.target.value)} rows={5} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-priority">Suggested homepage priority (one per line)</Label>
            <Textarea id="t-priority" value={priority} onChange={(e) => setPriority(e.target.value)} rows={4} />
          </div>
        </div>
        <footer className="p-6 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save template
          </Button>
        </footer>
      </div>
    </div>
  );
}
