import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Plus, LogOut, Settings, Activity, FileText, Sparkles, LayoutTemplate } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — Buildings" },
      { name: "description", content: "Manage buildings and access codes." },
    ],
  }),
  component: AdminGate,
});

type Building = {
  id: string;
  name: string;
  city: string;
  access_code: string;
  created_at: string;
  template_id?: string | null;
  template_name?: string | null;
  manager_code?: string | null;
  active_residents?: number;
};

type Template = { id: string; template_name: string; template_description: string | null };


type AuthState = "loading" | "not-admin" | "admin";

function AdminGate() {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>("loading");

  const check = async (preloadedUserId?: string | null) => {
    try {
      let userId = preloadedUserId;
      if (userId === undefined) {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user?.id ?? null;
      }
      if (!userId) {
        navigate({ to: "/super-admin-login" });
        return;
      }
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (rErr) {
        console.error("[admin] role check failed", rErr);
        return setState("not-admin");
      }
      setState(roles ? "admin" : "not-admin");
    } catch (e) {
      console.error("[admin] auth check failed", e);
      navigate({ to: "/super-admin-login" });
    }
  };

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await check(data.session?.user?.id ?? null);
      settled = true;
    };
    run();

    const timeout = setTimeout(() => {
      if (!settled && !cancelled) {
        navigate({ to: "/super-admin-login" });
      }
    }, 5000);

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) {
        navigate({ to: "/super-admin-login" });
        return;
      }
      check(session.user.id);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (state === "loading") {
    return <main className="min-h-screen grid place-items-center text-muted-foreground">Loading…</main>;
  }

  if (state === "not-admin") {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-6">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="text-sm text-muted-foreground">This account is not an admin. Only the Super Admin can manage buildings.</p>
          <Button variant="outline" onClick={signOut} className="gap-2"><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      </main>
    );
  }

  return <AdminPage onSignOut={signOut} />;
}

function AdminPage({ onSignOut }: { onSignOut: () => void }) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error: qErr } = await (supabase as any)
      .from("buildings")
      .select("id, name, city, access_code, created_at, template_id")
      .order("created_at", { ascending: false });
    if (qErr || !data) return;

    const buildingIds = (data as any[]).map((b) => b.id);
    const [{ data: managers }, { data: residents }, { data: tpls }] = await Promise.all([
      supabase
        .from("property_managers")
        .select("building_id, manager_code")
        .in(
          "building_id",
          buildingIds.length ? buildingIds : ["00000000-0000-0000-0000-000000000000"],
        ),
      supabase.from("resident_profiles").select("building_id"),
      (supabase as any).from("building_templates").select("id, template_name, template_description").order("is_system", { ascending: false }).order("template_name"),
    ]);

    const managerByBuilding = new Map<string, string>();
    (managers ?? []).forEach((m: any) => {
      if (!managerByBuilding.has(m.building_id)) {
        managerByBuilding.set(m.building_id, m.manager_code);
      }
    });

    const counts = new Map<string, number>();
    (residents ?? []).forEach((r: any) => {
      counts.set(r.building_id, (counts.get(r.building_id) ?? 0) + 1);
    });

    const tplList = (tpls as Template[]) ?? [];
    setTemplates(tplList);
    const tplById = new Map(tplList.map((t) => [t.id, t.template_name]));

    setBuildings(
      (data as any[]).map((b) => ({
        ...b,
        template_name: b.template_id ? tplById.get(b.template_id) ?? null : null,
        manager_code: managerByBuilding.get(b.id) ?? null,
        active_residents: counts.get(b.id) ?? 0,
      })),
    );
  };

  useEffect(() => {
    load();
    const sub = supabase
      .channel("admin-residents")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resident_profiles" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !city.trim()) {
      setError("Building name and city are required.");
      return;
    }
    if (!templateId) {
      setError("Please select a template for this building.");
      return;
    }
    setSaving(true);
    const { data: created, error: insErr } = await (supabase as any)
      .from("buildings")
      .insert({ name: name.trim(), city: city.trim(), template_id: templateId })
      .select("id")
      .single();
    if (insErr) {
      setSaving(false);
      setError(insErr.message);
      return;
    }
    // Apply template features to the new building's settings
    const { error: applyErr } = await (supabase as any).rpc("apply_template_to_building", {
      _building_id: created.id,
      _template_id: templateId,
    });
    setSaving(false);
    if (applyErr) {
      setError(`Building created, but template not applied: ${applyErr.message}`);
    }
    setName("");
    setCity("");
    setTemplateId("");
    load();
  };



  const copy = (code: string) => navigator.clipboard.writeText(code);

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Super Admin
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              Buildings
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create properties and share their access codes with residents.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/admin/templates">
                <LayoutTemplate className="h-4 w-4" /> Templates
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/admin/legal">
                <FileText className="h-4 w-4" /> Legal
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={onSignOut} className="gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm mb-10">
          <h2 className="text-base font-semibold text-foreground mb-1">
            Add a building
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Select a template to apply default features and engagement settings. Managers can customize them later.
          </p>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Building name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="City / Location"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.template_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={saving} className="gap-2">
                <Plus className="h-4 w-4" />
                {saving ? "Creating…" : "Create"}
              </Button>
            </div>
            {templateId && (
              <p className="text-xs text-muted-foreground">
                {templates.find((t) => t.id === templateId)?.template_description}
              </p>
            )}
          </form>
          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Resident Code</TableHead>
                <TableHead>Manager Code</TableHead>
                <TableHead className="text-center">Active Residents</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buildings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-10"
                  >
                    No buildings yet. Create your first one above.
                  </TableCell>
                </TableRow>
              ) : (
                buildings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="pl-6 font-medium">
                      <Link
                        to="/admin/buildings/$buildingId"
                        params={{ buildingId: b.id }}
                        className="hover:text-primary hover:underline"
                      >
                        {b.name}
                      </Link>
                      {b.template_name && (
                        <div className="text-xs text-muted-foreground font-normal mt-0.5">
                          {b.template_name}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>{b.city}</TableCell>
                    <TableCell>
                      <code className="px-2 py-1 rounded-md bg-muted font-mono text-sm tracking-widest">
                        {b.access_code}
                      </code>
                    </TableCell>
                    <TableCell>
                      {b.manager_code ? (
                        <code className="px-2 py-1 rounded-md bg-primary/10 text-primary font-mono text-sm tracking-widest">
                          {b.manager_code}
                        </code>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center min-w-9 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-sm tabular-nums">
                        {b.active_residents ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="pr-6 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copy(b.access_code)}
                        className="gap-1.5"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Resident
                      </Button>
                      {b.manager_code && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copy(b.manager_code!)}
                          className="gap-1.5"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Manager
                        </Button>
                      )}
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <Link to="/pulse/$buildingId" params={{ buildingId: b.id }}>
                          <Activity className="h-3.5 w-3.5" /> Pulse
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <Link
                          to="/admin/buildings/$buildingId/branding"
                          params={{ buildingId: b.id }}
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Branding
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <Link
                          to="/admin/buildings/$buildingId/settings"
                          params={{ buildingId: b.id }}
                        >
                          <Settings className="h-3.5 w-3.5" /> Settings
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </main>
  );
}
