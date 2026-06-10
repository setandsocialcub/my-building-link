import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { BrandingEditor } from "@/components/BrandingEditor";

export const Route = createFileRoute("/admin/buildings/$buildingId/branding")({
  head: () => ({
    meta: [
      { title: "Building Branding — Super Admin" },
      { name: "description", content: "Configure white-label branding for a building." },
    ],
  }),
  component: AdminBrandingPage,
});

function AdminBrandingPage() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [buildingName, setBuildingName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/super-admin-login" });
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      if (!role) {
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
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 h-14 flex items-center gap-3">
          <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Buildings
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
            Configure the branded resident experience for this building. Branding is isolated —
            residents only see their own building's branding.
          </p>
        </div>
        <BrandingEditor buildingId={buildingId} />
      </div>
    </main>
  );
}
