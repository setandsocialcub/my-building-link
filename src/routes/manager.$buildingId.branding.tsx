import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { BrandingEditor } from "@/components/BrandingEditor";

export const Route = createFileRoute("/manager/$buildingId/branding")({
  head: () => ({
    meta: [
      { title: "Building Branding — Manager" },
      { name: "description", content: "Customize your community's branded resident experience." },
    ],
  }),
  component: ManagerBrandingPage,
});

function ManagerBrandingPage() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [buildingName, setBuildingName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/manager-auth" });
        return;
      }
      const { data: pm } = await supabase
        .from("property_managers")
        .select("id")
        .eq("user_id", auth.user.id)
        .eq("building_id", buildingId)
        .maybeSingle();
      if (cancelled) return;
      if (!pm) {
        setState("denied");
        return;
      }
      const { data: b } = await supabase
        .from("buildings")
        .select("name")
        .eq("id", buildingId)
        .maybeSingle();
      if (cancelled) return;
      setBuildingName((b?.name as string | undefined) ?? "");
      setState("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, navigate]);

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
            You don't manage this building.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 h-14 flex items-center gap-3">
          <Link
            to="/manager/$buildingId"
            params={{ buildingId }}
            className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="ml-2 flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold truncate">
              Branding {buildingName ? `· ${buildingName}` : ""}
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-serif text-3xl">White label branding</h1>
          <p className="mt-1 text-muted-foreground">
            Give your community a fully branded resident experience. Changes apply across the
            login screen, navigation, dashboard, and PWA install prompt for your residents only.
          </p>
        </div>
        <BrandingEditor buildingId={buildingId} />
      </div>
    </main>
  );
}
