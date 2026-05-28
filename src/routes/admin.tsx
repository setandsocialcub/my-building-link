import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Plus } from "lucide-react";

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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — Buildings" },
      { name: "description", content: "Manage buildings and access codes." },
    ],
  }),
  component: AdminPage,
});

type Building = {
  id: string;
  name: string;
  city: string;
  access_code: string;
  created_at: string;
  manager_code?: string | null;
};

function AdminPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error: qErr } = await supabase
      .from("buildings")
      .select("id, name, city, access_code, created_at, property_managers(manager_code)")
      .order("created_at", { ascending: false });
    if (!qErr && data) {
      setBuildings(
        (data as any[]).map((b) => ({
          ...b,
          manager_code: b.property_managers?.[0]?.manager_code ?? null,
        })),
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !city.trim()) {
      setError("Building name and city are required.");
      return;
    }
    setSaving(true);
    const { error: insErr } = await supabase
      .from("buildings")
      .insert({ name: name.trim(), city: city.trim() });
    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setName("");
    setCity("");
    load();
  };

  const copy = (code: string) => navigator.clipboard.writeText(code);

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Super Admin
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Buildings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create properties and share their access codes with residents.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm mb-10">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Add a building
          </h2>
          <form
            onSubmit={onCreate}
            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3"
          >
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
            <Button type="submit" disabled={saving} className="gap-2">
              <Plus className="h-4 w-4" />
              {saving ? "Creating…" : "Create"}
            </Button>
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
                <TableHead>Created</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buildings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-10"
                  >
                    No buildings yet. Create your first one above.
                  </TableCell>
                </TableRow>
              ) : (
                buildings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="pl-6 font-medium">{b.name}</TableCell>
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
