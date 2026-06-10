import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyBrandingStyles, type BuildingBranding } from "@/lib/branding";

type Ctx = {
  branding: BuildingBranding | null;
  buildingId: string | null;
  refresh: () => Promise<void>;
};

const BrandingContext = createContext<Ctx>({
  branding: null,
  buildingId: null,
  refresh: async () => {},
});

export function useBranding() {
  return useContext(BrandingContext);
}

/**
 * Resolves the current building's branding for the signed-in user and
 * applies it globally. Falls back to default platform branding.
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BuildingBranding | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);

  const resolveBuildingId = async (): Promise<string | null> => {
    // 1. URL hint: /building/:id, /manager/:id, /admin/buildings/:id
    if (typeof window !== "undefined") {
      const m = window.location.pathname.match(
        /\/(?:building|manager|admin\/buildings)\/([0-9a-f-]{36})/i,
      );
      if (m) return m[1];
    }
    // 2. Resident profile
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data } = await supabase
      .from("resident_profiles")
      .select("building_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    return (data?.building_id as string | undefined) ?? null;
  };

  const load = async (bid: string | null) => {
    if (!bid) {
      setBranding(null);
      applyBrandingStyles(null);
      return;
    }
    const { data } = await (supabase as any)
      .from("building_branding")
      .select("*")
      .eq("building_id", bid)
      .maybeSingle();
    const b = (data as BuildingBranding | null) ?? null;
    setBranding(b);
    applyBrandingStyles(b);
  };

  const refresh = async () => {
    const bid = await resolveBuildingId();
    setBuildingId(bid);
    await load(bid);
  };

  useEffect(() => {
    void refresh();
    // Re-resolve on auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void refresh();
      }
    });
    // Re-resolve on navigation
    const onNav = () => void refresh();
    window.addEventListener("popstate", onNav);
    window.addEventListener("branding:changed", onNav as EventListener);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("branding:changed", onNav as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates when branding row changes
  useEffect(() => {
    if (!buildingId) return;
    const channel = supabase
      .channel(`branding-${buildingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "building_branding",
          filter: `building_id=eq.${buildingId}`,
        },
        (payload) => {
          const b = (payload.new as BuildingBranding) ?? null;
          setBranding(b);
          applyBrandingStyles(b);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [buildingId]);

  return (
    <BrandingContext.Provider value={{ branding, buildingId, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}
