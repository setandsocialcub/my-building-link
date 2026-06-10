export type BrandingFields = {
  community_name: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  app_icon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  welcome_message: string | null;
  custom_tagline: string | null;
};

export type BuildingBranding = BrandingFields & {
  id: string;
  building_id: string;
  draft?: Partial<BrandingFields> | null;
  draft_updated_at?: string | null;
  published_at?: string | null;
};

/** Merge live published branding with pending draft overrides (for preview). */
export function mergeDraft(
  b: BuildingBranding | null | undefined,
  draft: Partial<BrandingFields> | null | undefined,
): BuildingBranding | null {
  if (!b) return null;
  if (!draft) return b;
  const merged: any = { ...b };
  (Object.keys(draft) as (keyof BrandingFields)[]).forEach((k) => {
    const v = draft[k];
    if (v !== undefined) merged[k] = v;
  });
  return merged;
}

export const DEFAULT_BRANDING = {
  community_name: "Residence",
  welcome_message: "Welcome home",
  custom_tagline: "A hospitality experience for residents",
  primary_color: "#1E1E1E",
  secondary_color: "#B7A58D",
  accent_color: "#C97A63",
} as const;

export function brandingValue<K extends keyof typeof DEFAULT_BRANDING>(
  b: BuildingBranding | null | undefined,
  key: K,
): string {
  const v = b?.[key as keyof BuildingBranding];
  if (typeof v === "string" && v.trim()) return v;
  return DEFAULT_BRANDING[key];
}

/** Apply branding colors as CSS variables on the document root. */
export function applyBrandingStyles(b: BuildingBranding | null | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const set = (name: string, val: string | null | undefined) => {
    if (val && val.trim()) root.style.setProperty(name, val);
    else root.style.removeProperty(name);
  };
  set("--primary", b?.primary_color ?? null);
  set("--secondary", b?.secondary_color ?? null);
  set("--accent", b?.accent_color ?? null);
  set("--ring", b?.secondary_color ?? null);
  // Update PWA theme color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && b?.primary_color) meta.setAttribute("content", b.primary_color);
}
