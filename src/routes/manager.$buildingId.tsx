import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/manager/$buildingId")({
  component: ManagerBuildingLayout,
});

function ManagerBuildingLayout() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState("loading");
      setMessage(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        navigate({ to: "/manager-auth" });
        return;
      }
      const { data: mgr, error } = await supabase
        .from("property_managers")
        .select("id")
        .eq("user_id", user.id)
        .eq("building_id", buildingId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !mgr) {
        setMessage(
          error?.message ??
            "You're signed in, but you don't have manager access for this building yet. Enter a manager code below.",
        );
        setState("denied");
        return;
      }
      setState("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, navigate]);

  if (state === "loading") {
    return (
      <main className="min-h-screen grid place-items-center text-muted-foreground">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading manager workspace…
        </div>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-6">
        <div className="max-w-md w-full text-center space-y-5 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-content-center">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Manager access required</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {message ?? "You don't have manager access for this building."}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate({ to: "/manager" })} className="w-full">
              Enter manager code
            </Button>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/manager-auth" });
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <Outlet />;
}