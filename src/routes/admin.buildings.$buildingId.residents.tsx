import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Ban, CheckCircle2, Trash2, Plus, Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/buildings/$buildingId/residents")({
  head: () => ({ meta: [{ title: "Residents — Building Admin" }] }),
  component: ResidentsPage,
});

type Resident = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  interest_tags: string[] | null;
  last_active_at: string | null;
  created_at: string;
  is_visible: boolean;
};

type Suspension = { resident_id: string; reason: string | null; suspended_at: string; lifted_at: string | null };
type Invite = { id: string; email: string | null; invite_code: string; created_at: string; accepted_at: string | null };

function ResidentsPage() {
  const { buildingId } = Route.useParams();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");

  const load = async () => {
    const [{ data: res }, { data: sus }, { data: inv }] = await Promise.all([
      (supabase as any)
        .from("resident_profiles")
        .select("id, user_id, first_name, last_name, job_title, interest_tags, last_active_at, created_at, is_visible")
        .eq("building_id", buildingId)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("resident_suspensions")
        .select("resident_id, reason, suspended_at, lifted_at")
        .eq("building_id", buildingId)
        .is("lifted_at", null),
      (supabase as any)
        .from("resident_invites")
        .select("id, email, invite_code, created_at, accepted_at")
        .eq("building_id", buildingId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setResidents((res as Resident[]) ?? []);
    setSuspensions((sus as Suspension[]) ?? []);
    setInvites((inv as Invite[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const suspendedIds = useMemo(() => new Set(suspensions.map((s) => s.resident_id)), [suspensions]);
  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    if (!term) return residents;
    return residents.filter((r) => {
      const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.toLowerCase();
      const tags = (r.interest_tags ?? []).join(" ").toLowerCase();
      return name.includes(term) || (r.job_title ?? "").toLowerCase().includes(term) || tags.includes(term);
    });
  }, [q, residents]);

  const suspend = async (r: Resident) => {
    const reason = prompt(`Suspend ${r.first_name ?? "resident"}? Reason (optional):`);
    if (reason === null) return;
    const { data: sess } = await supabase.auth.getSession();
    await (supabase as any).from("resident_suspensions").insert({
      resident_id: r.id,
      building_id: buildingId,
      reason: reason || null,
      suspended_by: sess.session?.user?.id ?? null,
    });
    toast.success("Resident suspended");
    await load();
  };

  const reinstate = async (r: Resident) => {
    await (supabase as any)
      .from("resident_suspensions")
      .update({ lifted_at: new Date().toISOString() })
      .eq("resident_id", r.id)
      .is("lifted_at", null);
    toast.success("Resident reinstated");
    await load();
  };

  const removeResident = async (r: Resident) => {
    if (!confirm(`Remove ${r.first_name ?? "resident"} from this building? This deletes their resident profile.`)) return;
    const { error } = await (supabase as any).from("resident_profiles").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Resident removed");
    await load();
  };

  const createInvite = async () => {
    const code =
      "R" +
      Array.from({ length: 5 }, () =>
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)],
      ).join("");
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await (supabase as any).from("resident_invites").insert({
      building_id: buildingId,
      email: inviteEmail.trim() || null,
      invite_code: code,
      invited_by: sess.session?.user?.id ?? null,
      expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    });
    if (error) return toast.error(error.message);
    setInviteEmail("");
    toast.success(`Invite code ${code} created`);
    await load();
  };

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Residents</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Resident directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search residents, review profiles, and manage access.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2"><Mail className="h-4 w-4" /> Invite residents</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Invite a resident</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Email (optional)</label>
                  <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="resident@example.com" />
                </div>
                <Button onClick={createInvite} className="gap-2"><Plus className="h-4 w-4" /> Create</Button>
              </div>
              <div className="max-h-64 overflow-auto border rounded-lg divide-y">
                {invites.length === 0 && <div className="p-4 text-sm text-muted-foreground">No invites yet.</div>}
                {invites.map((i) => (
                  <div key={i.id} className="p-3 flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(i.invite_code);
                        toast.success("Code copied");
                      }}
                      className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-1 font-mono text-xs hover:bg-muted/70"
                    >
                      {i.invite_code}
                      <Copy className="h-3 w-3" />
                    </button>
                    <span className="text-muted-foreground truncate flex-1">{i.email ?? "no email"}</span>
                    {i.accepted_at ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">Accepted</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search residents by name, role, or interest…" />
      </div>

      <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No residents match your search.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Interests</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const suspended = suspendedIds.has(r.id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="pl-6 font-medium">
                      {(r.first_name || r.last_name) ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() : <span className="text-muted-foreground italic">Unnamed</span>}
                      <div className="text-xs text-muted-foreground">Joined {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.job_title ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(r.interest_tags ?? []).slice(0, 4).map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                        ))}
                        {(r.interest_tags?.length ?? 0) > 4 && (
                          <span className="text-[10px] text-muted-foreground">+{(r.interest_tags?.length ?? 0) - 4}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.last_active_at ? formatDistanceToNow(new Date(r.last_active_at), { addSuffix: true }) : "Never"}
                    </TableCell>
                    <TableCell>
                      {suspended ? (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">Suspended</Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-right space-x-1">
                      {suspended ? (
                        <Button size="sm" variant="ghost" onClick={() => reinstate(r)} className="gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Reinstate
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => suspend(r)} className="gap-1.5">
                          <Ban className="h-3.5 w-3.5" /> Suspend
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => removeResident(r)} className="gap-1.5 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
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
