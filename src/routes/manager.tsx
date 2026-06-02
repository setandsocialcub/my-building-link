import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Loader2 } from "lucide-react";
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
  return <ClaimCode />;
}


function ClaimCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Normalize: uppercase, strip everything except A–Z and 0–9 (drops dashes/spaces).
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!normalized) return;
    setLoading(true);
    const { data, error: qErr } = await supabase.rpc("claim_manager_code", { _code: normalized });
    setLoading(false);
    if (qErr || !data) {
      // Detect a building invite code (format AAA-NNN, 3 letters + 3 digits) and explain.
      const looksLikeBuildingCode = /^[A-Z]{3}[0-9]{3}$/.test(normalized);
      if (looksLikeBuildingCode) {
        setError(
          "That looks like a resident invite code (e.g. JUK-611). Manager codes start with M (e.g. M93PP5).",
        );
      } else {
        setError(qErr?.message ?? "Invalid manager code.");
      }
      return;
    }
    navigate({ to: "/manager/$buildingId", params: { buildingId: data as string } });
  };

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
