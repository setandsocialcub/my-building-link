export type BrandingFields = {
  community_name: string | null;
  community_tagline: string | null;
  custom_tagline: string | null; // legacy alias retained for backwards compat
  logo_url: string | null;
  hero_image_url: string | null;
  community_icon_url: string | null;
  app_icon_url: string | null;
  splash_screen_image_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  welcome_message: string | null;
  homepage_headline: string | null;
  homepage_subheadline: string | null;
  app_name: string | null;
  app_short_name: string | null;
  custom_domain: string | null;
  enable_powered_by_footer: boolean | null;
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
  community_tagline: "A hospitality experience for residents",
  custom_tagline: "A hospitality experience for residents",
  welcome_message: "Welcome home",
  homepage_headline: "Welcome home",
  homepage_subheadline: "Your community, curated.",
  app_name: "Residence",
  app_short_name: "Residence",
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
  // Soft fallbacks between paired fields
  if (key === "community_tagline" && b?.custom_tagline) return b.custom_tagline;
  if (key === "homepage_headline" && b?.welcome_message) return b.welcome_message;
  if (key === "app_name" && b?.community_name) return b.community_name;
  if (key === "app_short_name" && b?.community_name) return b.community_name;
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

  // PWA theme color
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme && b?.primary_color) theme.setAttribute("content", b.primary_color);

  // Dynamic manifest per building so installed PWA shows building-specific name/icon
  if (b?.building_id) {
    let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) {
      manifest = document.createElement("link");
      manifest.rel = "manifest";
      document.head.appendChild(manifest);
    }
    manifest.href = `/api/public/manifest/${b.building_id}.webmanifest`;
  }

  // Apple touch icon — building app icon when present
  if (b?.app_icon_url || b?.community_icon_url || b?.logo_url) {
    const href = (b.app_icon_url || b.community_icon_url || b.logo_url) as string;
    let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!apple) {
      apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      document.head.appendChild(apple);
    }
    apple.href = href;

    // apple-mobile-web-app-title controls installed name on iOS
    const appName =
      (b.app_name && b.app_name.trim()) ||
      (b.community_name && b.community_name.trim()) ||
      null;
    if (appName) {
      let title = document.querySelector<HTMLMetaElement>(
        'meta[name="apple-mobile-web-app-title"]',
      );
      if (!title) {
        title = document.createElement("meta");
        title.name = "apple-mobile-web-app-title";
        document.head.appendChild(title);
      }
      title.content = appName;
    }
  }
}
