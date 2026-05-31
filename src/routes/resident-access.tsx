import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/resident-access")({
  head: () => ({
    meta: [
      { title: "Resident Access — Enter Your Building Code" },
      {
        name: "description",
        content:
          "Enter your building access code to join your residential community portal.",
      },
    ],
  }),
  component: ResidentAccessPage,
});

function ResidentAccessPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError("Access codes are 6 characters long.");
      return;
    }
    setLoading(true);
    const { data, error: qErr } = await supabase
      .rpc("lookup_building_by_code", { _code: trimmed })
      .maybeSingle();
    setLoading(false);

    if (qErr) {
      setError("Something went wrong. Please try again.");
      return;
    }
    if (!data) {
      setError("Invalid access code. Please check with your building manager.");
      return;
    }
    try {
      sessionStorage.setItem(
        `building:${data.id}`,
        JSON.stringify({ name: data.name, city: data.city, code: trimmed }),
      );
    } catch {
      // ignore storage failures
    }
    navigate({ to: "/onboarding/$buildingId", params: { buildingId: data.id } });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex flex-col items-center text-center mb-10">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Resident Access
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the access code provided by your building to continue.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4"
        >
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Building Access Code
            </span>
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. LVMIA1"
              maxLength={6}
              className="mt-2 h-12 text-center text-lg font-mono tracking-[0.4em] uppercase"
            />
          </label>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "Checking…" : "Continue"}
          </Button>
        </form>
      </div>
    </main>
  );
}
