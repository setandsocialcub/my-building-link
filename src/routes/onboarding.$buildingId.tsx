import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding/$buildingId")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { buildingId } = Route.useParams();
  const [building, setBuilding] = useState<{ name: string; city: string } | null>(
    null,
  );
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("buildings")
        .select("name, city")
        .eq("id", buildingId)
        .maybeSingle();
      if (!data) setNotFound(true);
      else setBuilding(data);
    })();
  }, [buildingId]);

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Building not found</h1>
          <Link to="/" className="text-sm text-primary underline mt-3 inline-block">
            Back to access
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted px-4 py-16">
      <div className="max-w-xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex items-center gap-2 text-primary mb-3">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Access verified</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome to {building?.name ?? "your building"}
          </h1>
          {building && (
            <p className="text-sm text-muted-foreground mt-1">{building.city}</p>
          )}
          <p className="text-sm text-muted-foreground mt-6">
            Your resident onboarding flow will go here — profile setup, unit
            details, and community access.
          </p>
        </div>
      </div>
    </main>
  );
}
