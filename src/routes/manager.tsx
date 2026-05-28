import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/manager")({
  head: () => ({
    meta: [
      { title: "Property Manager — Sign In" },
      { name: "description", content: "Sign in to manage your building." },
    ],
  }),
  component: ManagerLogin,
});

function ManagerLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    const { data, error: qErr } = await supabase
      .from("property_managers")
      .select("id, building_id")
      .eq("manager_code", trimmed)
      .maybeSingle();
    setLoading(false);
    if (qErr || !data) {
      setError("Invalid manager code. Check with your super admin.");
      return;
    }
    localStorage.setItem(`manager_${data.building_id}`, data.id);
    navigate({ to: "/manager/$buildingId", params: { buildingId: data.building_id } });
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
            Enter your manager access code to broadcast announcements and moderate your building.
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4"
        >
          <Input
            placeholder="e.g. MA1B2C"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="text-center tracking-[0.4em] font-mono uppercase"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || !code.trim()} className="w-full">
            {loading ? <Loader2 className="animate-spin" /> : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
