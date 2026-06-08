import { createFileRoute, useNavigate, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Loader2, CheckCircle2, ArrowRight, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/manager")({
  head: () => ({
    meta: [
      { title: "Property Manager — Enter Code" },
      { name: "description", content: "Claim your building manager access." },
    ],
  }),
  component: ManagerEntry,
});

function ManagerEntry() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const matches = useMatches();
  const hasChild = matches.some((m) => m.routeId === "/manager/$buildingId");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/manager-auth" });
        return;
      }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) navigate({ to: "/manager-auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!ready) {
    return <main className="min-h-screen grid place-items-center text-muted-foreground">Loading…</main>;
  }
  if (hasChild) return <Outlet />;
  return <ClaimCode />;
}

type ClaimedBuilding = {
  id: string;
  name: string;
  city: string;
  code: string;
};

function ClaimCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<ClaimedBuilding | null>(null);

  // Real-time validation: show a specific error while typing resident invite codes
  useEffect(() => {
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!normalized) {
      setError(null);
      return;
    }
    const looksLikeBuildingCode = /^[A-Z]{3}[0-9]{3}$/.test(normalized);
    if (looksLikeBuildingCode) {
      setError(
        "That looks like a resident invite code (e.g. JUK-611). Manager codes start with M (e.g. M93PP5).",
      );
      return;
    }
    if (!normalized.startsWith("M")) {
      setError("Manager codes start with M followed by 5 characters (e.g. M93PP5).");
      return;
    }
    setError(null);
  }, [code]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Normalize: uppercase, strip everything except A–Z and 0–9 (drops dashes/spaces).
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!normalized) return;

    // Early guard: resident invite codes look like XXX-NNN (3 letters + 3 digits)
    const looksLikeBuildingCode = /^[A-Z]{3}[0-9]{3}$/.test(normalized);
    if (looksLikeBuildingCode) {
      setError(
        "That looks like a resident invite code (e.g. JUK-611). Manager codes start with M (e.g. M93PP5).",
      );
      return;
    }

    // Manager codes must start with M
    if (!normalized.startsWith("M")) {
      setError("Manager codes start with M followed by 5 characters (e.g. M93PP5).");
      return;
    }

    setLoading(true);
    const { data, error: qErr } = await supabase.rpc("claim_manager_code", {
      _code: normalized,
    });
    if (qErr || !data) {
      setLoading(false);
      setError(qErr?.message ?? "Invalid manager code.");
      return;
    }

    const buildingId = data as string;
    const { data: b, error: bErr } = await supabase
      .from("buildings")
      .select("id, name, city")
      .eq("id", buildingId)
      .maybeSingle();
    setLoading(false);
    if (bErr || !b) {
      setError(bErr?.message ?? "Couldn't load building details.");
      return;
    }
    setClaimed({ id: b.id, name: b.name, city: b.city, code: normalized });
  };

  if (claimed) {
    return (
      <main className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-background to-muted px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              Code verified
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You're about to manage the building below.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="rounded-xl border border-border bg-muted/40 p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 text-primary grid place-content-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    Building
                  </div>
                  <div className="text-lg font-semibold truncate">
                    {claimed.name}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {claimed.city}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Matched code
                </div>
                <code className="px-2.5 py-1 rounded-md bg-primary/10 text-primary font-mono text-sm tracking-widest">
                  {claimed.code}
                </code>
              </div>
            </div>

            <Button
              className="w-full gap-2"
              onClick={() =>
                navigate({
                  to: "/manager/$buildingId",
                  params: { buildingId: claimed.id },
                })
              }
            >
              Continue to dashboard <ArrowRight className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => {
                setClaimed(null);
                setCode("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
            >
              Use a different code
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-background to-muted px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Property Manager</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the manager access code your super admin gave you. It starts with{" "}
            <span className="font-mono font-semibold">M</span> followed by 5 characters.
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4"
        >
          <Input
            placeholder="e.g. M93PP5"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={12}
            className="text-center tracking-[0.4em] font-mono uppercase"
            autoFocus
          />

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || !code.trim()} className="w-full">
            {loading ? <Loader2 className="animate-spin" /> : "Continue"}
          </Button>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
