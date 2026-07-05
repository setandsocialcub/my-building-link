import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Ban, CheckCircle2, Copy, Shield } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/buildings/$buildingId/managers")({
  head: () => ({ meta: [{ title: "Managers — Building Admin" }] }),
  component: ManagersPage,
});

type Manager = {
  id: string;
  building_id: string;
  user_id: string | null;
  name: string | null;
  manager_code: string | null;
  disabled_at: string | null;
  created_at: string;
};

type Permission = {
  key: string;
  label: string;
  description: string;
};

const PERMISSIONS: Permission[] = [
  { key: "manage_residents", label: "Manage residents", description: "Add, suspend, or remove residents." },
  { key: "manage_events", label: "Manage events", description: "Create and edit building events." },
  { key: "manage_playbook", label: "Manage playbook", description: "Update the Community Playbook." },
  { key: "manage_branding", label: "Manage branding", description: "Edit white-label branding." },
  { key: "manage_settings", label: "Manage settings", description: "Adjust feature toggles." },
  { key: "manage_legal", label: "Manage legal", description: "Update legal documents." },
];

function ManagersPage() {
  const { buildingId } = Route.useParams();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [perms, setPerms] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = async () => {
    const { data: mgrs } = await (supabase as any)
      .from("property_managers")
      .select("*")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false });
    const rows = (mgrs as Manager[]) ?? [];
    setManagers(rows);
    if (rows.length) {
      const { data: pd } = await (supabase as any)
        .from("manager_permissions")
        .select("manager_id, permission")
        .in("manager_id", rows.map((r) => r.id));
      const map = new Map<string, Set<string>>();
      ((pd as { manager_id: string; permission: string }[]) ?? []).forEach((p) => {
        if (!map.has(p.manager_id)) map.set(p.manager_id, new Set());
        map.get(p.manager_id)!.add(p.permission);
      });
      setPerms(map);
    } else {
      setPerms(new Map());
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const createManager = async () => {
    setCreating(true);
    const { data: code } = await (supabase as any).rpc("generate_manager_access_code");
    const { error } = await (supabase as any).from("property_managers").insert({
      building_id: buildingId,
      name: newName.trim() || "Property Manager",
      manager_code: code,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    setNewName("");
    toast.success("Manager invite created");
    await load();
  };

  const toggleDisabled = async (m: Manager) => {
    const { error } = await (supabase as any)
      .from("property_managers")
      .update({ disabled_at: m.disabled_at ? null : new Date().toISOString() })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success(m.disabled_at ? "Manager re-enabled" : "Manager disabled");
    await load();
  };

  const removeManager = async (m: Manager) => {
    if (!confirm(`Remove manager ${m.name ?? m.id}? This cannot be undone.`)) return;
    const { error } = await (supabase as any).from("property_managers").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Manager removed");
    await load();
  };

  const togglePermission = async (managerId: string, key: string, on: boolean) => {
    if (on) {
      await (supabase as any).from("manager_permissions").insert({ manager_id: managerId, permission: key });
    } else {
      await (supabase as any)
        .from("manager_permissions")
        .delete()
        .eq("manager_id", managerId)
        .eq("permission", key);
    }
    await load();
  };

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Managers</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Property managers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite property managers, disable access, and assign per-capability permissions.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">New manager name (optional)</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Sarah Chen" />
          </div>
          <Button onClick={createManager} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate invite code
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Share the invite code with the manager. They sign up and redeem the code to claim access to this building.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : managers.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No managers yet. Generate an invite code above to add one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invite / access code</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map((m) => {
                const set = perms.get(m.id) ?? new Set<string>();
                return (
                  <TableRow key={m.id}>
                    <TableCell className="pl-6 font-medium">
                      {m.name ?? "Manager"}
                      <div className="text-xs text-muted-foreground">
                        {m.user_id ? "Claimed" : "Pending sign-up"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.disabled_at ? (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">Disabled</Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.manager_code ? (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(m.manager_code!);
                            toast.success("Code copied");
                          }}
                          className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-1 font-mono text-xs hover:bg-muted/70"
                        >
                          {m.manager_code}
                          <Copy className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <Shield className="h-3.5 w-3.5" />
                            {set.size === 0 ? "All (default)" : `${set.size} granted`}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <p className="text-xs text-muted-foreground mb-3">
                            Empty = full access. Granting any permission scopes access to only those checked.
                          </p>
                          <div className="space-y-2">
                            {PERMISSIONS.map((p) => (
                              <label key={p.key} className="flex items-start gap-2 cursor-pointer">
                                <Checkbox
                                  checked={set.has(p.key)}
                                  onCheckedChange={(v) => togglePermission(m.id, p.key, Boolean(v))}
                                  className="mt-0.5"
                                />
                                <div>
                                  <div className="text-sm font-medium">{p.label}</div>
                                  <div className="text-xs text-muted-foreground">{p.description}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="pr-6 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleDisabled(m)} className="gap-1.5">
                        {m.disabled_at ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                        {m.disabled_at ? "Enable" : "Disable"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeManager(m)} className="gap-1.5 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
