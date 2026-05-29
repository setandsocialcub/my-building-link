import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Plus, LogOut } from "lucide-react";

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
import { lovable } from "@/integrations/lovable";

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
  manager_code?: string | null;
};

type AuthState = "loading" | "signed-out" | "not-admin" | "admin";

function AdminGate() {
  const [state, setState] = useState<AuthState>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const check = async () => {
    try {
      const { data, error: uErr } = await supabase.auth.getUser();
      if (uErr || !data?.user) return setState("signed-out");
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (rErr) {
        console.error("[admin] role check failed", rErr);
        return setState("not-admin");
      }
      setState(roles ? "admin" : "not-admin");
    } catch (e) {
      console.error("[admin] auth check failed", e);
      setState("signed-out");
    }
  };

  useEffect(() => {
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  if (state === "loading") {
    return <main className="min-h-screen grid place-items-center text-muted-foreground">Loading…</main>;
  }

  if (state === "signed-out") {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Super Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{mode === "signup" ? "Create admin account" : "Sign in"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">The first account created becomes the admin.</p>
          </div>
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={async () => {
              setErr(null);
              const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/admin` });
              if (result.error) setErr(result.error.message ?? "Google sign-in failed");
            }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
              <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
            </svg>
            Continue with Google
          </Button>
          <button type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
            {mode === "signup" ? "Already have an account? Sign in" : "Need to create the admin account? Sign up"}
          </button>
        </form>
      </main>
    );
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
          <Button variant="ghost" size="sm" onClick={onSignOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
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
