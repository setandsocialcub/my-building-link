import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useBuildingSettings, isFeatureEnabled, DEFAULT_SETTINGS } from "@/hooks/use-building-settings";
import { Button } from "@/components/ui/button";

type FeatureKey = keyof typeof DEFAULT_SETTINGS;

/**
 * Wraps resident-facing route content. If the building has disabled the given
 * feature, renders a "feature unavailable" notice instead of `children`.
 * Loading state passes through so we never flash empty UI.
 */
export function FeatureGate({
  feature,
  featureLabel,
  children,
}: {
  feature: FeatureKey;
  featureLabel: string;
  children: React.ReactNode;
}) {
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setResolved(true);
        return;
      }
      const { data: profile } = await supabase
        .from("resident_profiles")
        .select("building_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      setBuildingId((profile?.building_id as string | undefined) ?? null);
      setResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { settings, loading } = useBuildingSettings(buildingId);

  if (!resolved || (buildingId && loading)) {
    return <>{children}</>;
  }

  // No building yet → don't block (onboarding path).
  if (!buildingId) return <>{children}</>;

  if (isFeatureEnabled(settings, feature)) return <>{children}</>;

  return (
    <main className="min-h-screen grid place-items-center px-6 bg-background">
      <div className="max-w-md text-center space-y-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="font-serif text-2xl font-semibold">{featureLabel} unavailable</h1>
        <p className="text-sm text-muted-foreground">
          This feature has been disabled for your residence. Reach out to your
          property management team for more information.
        </p>
        <Button asChild variant="outline">
          <Link to="/building/$buildingId" params={{ buildingId }}>Return home</Link>
        </Button>
        <button
          type="button"
          onClick={() => navigate({ to: "/building/$buildingId", params: { buildingId } })}
          className="hidden"
        />
      </div>
    </main>
  );
}
