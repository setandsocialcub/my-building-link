import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BuildingSettings = {
  id: string;
  building_id: string;
  enable_circles: boolean;
  enable_experiences: boolean;
  enable_concierge: boolean;
  enable_community_board: boolean;
  enable_resident_exchange: boolean;
  enable_conversations: boolean;
  enable_introductions: boolean;
  enable_ai_matching: boolean;
  enable_resident_ambassadors: boolean;
  allow_resident_circle_creation: boolean;
  require_circle_approval: boolean;
  theme: string;
  community_style: string;
};

export const DEFAULT_SETTINGS: Omit<BuildingSettings, "id" | "building_id"> = {
  enable_circles: true,
  enable_experiences: true,
  enable_concierge: true,
  enable_community_board: true,
  enable_resident_exchange: true,
  enable_conversations: true,
  enable_introductions: true,
  enable_ai_matching: true,
  enable_resident_ambassadors: true,
  allow_resident_circle_creation: true,
  require_circle_approval: false,
  theme: "hospitality",
  community_style: "luxury",
};

export function useBuildingSettings(buildingId: string | null | undefined) {
  const [settings, setSettings] = useState<BuildingSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(!!buildingId);

  useEffect(() => {
    let cancelled = false;
    if (!buildingId) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("building_settings")
        .select("*")
        .eq("building_id", buildingId)
        .maybeSingle();
      if (cancelled) return;
      setSettings((data as BuildingSettings | null) ?? null);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`building-settings-${buildingId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "building_settings", filter: `building_id=eq.${buildingId}` },
        (payload) => {
          if (payload.new) setSettings(payload.new as BuildingSettings);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [buildingId]);

  return { settings, loading };
}

/**
 * Resolves a building's settings while the request is in flight. Defaults to
 * "feature enabled" so the UI never disappears just because settings haven't
 * loaded yet.
 */
export function isFeatureEnabled(
  settings: BuildingSettings | null,
  key: keyof typeof DEFAULT_SETTINGS,
): boolean {
  if (!settings) return DEFAULT_SETTINGS[key] as boolean;
  const v = settings[key as keyof BuildingSettings];
  return typeof v === "boolean" ? v : Boolean(v);
}
