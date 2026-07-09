import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, Plus, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  INDUSTRY_META,
  INDUSTRY_TYPES,
  type IndustryType,
} from "@/lib/industry";

export const Route = createFileRoute("/admin/clients")({
  head: () => ({
    meta: [
      { title: "Clients — Super Admin" },
      {
        name: "description",
        content: "Manage enterprise clients (Greystar, Related, Aman) and their portfolio buildings.",
      },
    ],
  }),
  component: ClientsPage,
});

type Client = {
  id: string;
  name: string;
  industry_type: IndustryType;
  contact_email: string | null;
  building_count?: number;
};

function ClientsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "denied" | "ok">("loading");
  const [clients, setClients] = useState<Client[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<IndustryType>("luxury_residential");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data: cs } = await (supabase as any)
      .from("clients")
      .select("id, name, industry_type, contact_email")
      .order("name");
    const list = ((cs as Client[] | null) ?? []).slice();
    // Building counts
    if (list.length) {
      const { data: counts } = await (supabase as any)
        .from("buildings")
        .select("client_id");
      const map = new Map<string, number>();
      ((counts as { client_id: string | null }[] | null) ?? []).forEach((b) => {
        if (b.client_id) map.set(b.client_id, (map.get(b.client_id) ?? 0) + 1);
      });
      list.forEach((c) => (c.building_count = map.get(c.id) ?? 0));
    }
    setClients(list);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
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
      if (!role) {
        setState("denied");
        return;
      }
      await load();
      if (!cancelled) setState("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const createClient = async () => {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    setCreating(true);
    const { error } = await (supabase as any).from("clients").insert({
      name: name.trim(),
      industry_type: industry,
      contact_email: email.trim() || null,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Client created.");
    setName("");
    setEmail("");
    setIndustry("luxury_residential");
    setNewOpen(false);
    await load();
  };

  if (state === "loading") {
    return (
      <main className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }
  if (state === "denied") {
    return (
      <main className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only super admins can view clients.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-3">
          <Link
            to="/admin"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Buildings
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Clients</span>
          </div>
          <div className="ml-auto">
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> New client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create client</DialogTitle>
                  <DialogDescription>
                    An enterprise operator that owns one or more buildings.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Client name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Greystar, Related, Aman"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Industry</Label>
                    <Select
                      value={industry}
                      onValueChange={(v) => setIndustry(v as IndustryType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRY_TYPES.map((k) => (
                          <SelectItem key={k} value={k}>
                            {INDUSTRY_META[k].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact email (optional)</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ops@client.com"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setNewOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createClient} disabled={creating}>
                      {creating ? "Creating…" : "Create client"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Enterprise hierarchy
          </p>
          <h1 className="mt-1 font-serif text-3xl">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Each client can own many buildings. Portfolio templates let you set corporate
            branding, legal defaults, and notification standards once and let each building
            override only what's unique — logo, photography, amenity list.
          </p>
        </div>

        {clients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No clients yet. Create one to start grouping buildings under an operator.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Client</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead className="text-center">Buildings</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-6 font-medium">{c.name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {INDUSTRY_META[c.industry_type]?.label ?? c.industry_type}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-sm tabular-nums">
                        <Building2 className="h-3.5 w-3.5" />
                        {c.building_count ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.contact_email ?? "—"}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Link
                        to="/admin"
                        className={
                          buttonVariants({ variant: "outline", size: "sm" }) + " gap-1.5"
                        }
                      >
                        View buildings
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
