import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyBrandingStyles,
  mergeDraft,
  type BrandingFields,
  type BuildingBranding,
} from "@/lib/branding";
import type { IndustryType } from "@/lib/industry";

type Ctx = {
  branding: BuildingBranding | null;
  buildingId: string | null;
  clientId: string | null;
  industry: IndustryType | null;
  refresh: () => Promise<void>;
  /** True when the current viewer is previewing an unpublished draft locally. */
  previewing: boolean;
  /** Apply a draft locally (no DB write). Pass null to clear. Manager-only UX. */
  setPreviewDraft: (draft: Partial<BrandingFields> | null) => void;
};

const BrandingContext = createContext<Ctx>({
  branding: null,
  buildingId: null,
  clientId: null,
  industry: null,
  refresh: async () => {},
  previewing: false,
  setPreviewDraft: () => {},
});

export function useBranding() {
  return useContext(BrandingContext);
}

/**
 * Resolves the current building's PUBLISHED branding for the signed-in user
 * and applies it globally. Managers can locally preview a draft via
 * `setPreviewDraft` without affecting other residents.
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BuildingBranding | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [industry, setIndustry] = useState<IndustryType | null>(null);
  const [previewDraft, setPreviewDraftState] = useState<Partial<BrandingFields> | null>(null);

  const resolveBuildingId = async (): Promise<string | null> => {
    if (typeof window !== "undefined") {
      const m = window.location.pathname.match(
        /\/(?:building|manager|admin\/buildings)\/([0-9a-f-]{36})/i,
      );
      if (m) return m[1];
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data } = await supabase
      .from("resident_profiles")
      .select("building_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    return (data?.building_id as string | undefined) ?? null;
  };

  const applyEffective = (b: BuildingBranding | null, draft: Partial<BrandingFields> | null) => {
    applyBrandingStyles(draft ? mergeDraft(b, draft) : b);
  };

  const load = async (bid: string | null) => {
    if (!bid) {
      setBranding(null);
      applyEffective(null, previewDraft);
      return;
    }
    const { data } = await (supabase as any)
      .from("building_branding")
      .select("*")
      .eq("building_id", bid)
      .maybeSingle();
    const b = (data as BuildingBranding | null) ?? null;
    setBranding(b);
    applyEffective(b, previewDraft);
  };

  const refresh = async () => {
    const bid = await resolveBuildingId();
    setBuildingId(bid);
    await load(bid);
  };

  const setPreviewDraft = (draft: Partial<BrandingFields> | null) => {
    setPreviewDraftState(draft);
    applyEffective(branding, draft);
  };

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void refresh();
      }
    });
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
          applyEffective(b, previewDraft);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId, previewDraft]);

  return (
    <BrandingContext.Provider
      value={{
        branding,
        buildingId,
        refresh,
        previewing: !!previewDraft,
        setPreviewDraft,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}
