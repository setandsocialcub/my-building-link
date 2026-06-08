import { ReactNode, useEffect, useState } from "react";
import { ArrowLeft, Building2 } from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import {
  ResidentBottomNav,
  ResidentBottomNavSpacer,
  ResidentSidebarLinks,
} from "@/components/ResidentNav";

/**
 * Shared shell for resident pages outside the building hub. Provides a sticky
 * header with a back button, a desktop sidebar with the full nav, and the
 * mobile bottom nav — so users always have a seamless way to get back or jump
 * to another section.
 */
export function ResidentPageShell({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [buildingId, setBuildingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user || cancelled) return;
      const { data } = await supabase
        .from("resident_profiles")
        .select("building_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      setBuildingId((data?.building_id as string | undefined) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else if (buildingId) {
      window.location.href = `/building/${buildingId}`;
    } else {
      window.location.href = "/";
    }
  };

  const homeHref = buildingId ? `/building/${buildingId}` : "/";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 h-14">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <a href={homeHref} className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-content-center shrink-0">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-sm font-semibold truncate">
                {title ?? "Residence"}
              </div>
              {subtitle && (
                <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
              )}
            </div>
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-4 hidden md:block">
          <ResidentSidebarLinks />
        </aside>
        <main className="min-h-[60vh]">{children}</main>
      </div>

      <ResidentBottomNavSpacer />
      <ResidentBottomNav />
    </div>
  );
}
