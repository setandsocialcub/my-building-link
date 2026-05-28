import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
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
  component: LandingPage,
});

function LandingPage() {
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
      .from("buildings")
      .select("id, name")
      .eq("access_code", trimmed)
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
    navigate({ to: "/onboarding/$buildingId", params: { buildingId: data.id } });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Welcome home
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

        <p className="text-center text-xs text-muted-foreground mt-6">
          Building manager?{" "}
          <Link to="/admin" className="underline hover:text-foreground">
            Open Super Admin
          </Link>
        </p>
      </div>
    </main>
  );
}
