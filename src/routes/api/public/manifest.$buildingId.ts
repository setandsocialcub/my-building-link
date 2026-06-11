import { createFileRoute } from "@tanstack/react-router";

/**
 * Building-specific PWA manifest. When a resident installs the app from their
 * building's URL, iOS/Android cache this manifest and show the building's
 * branded name + icon on the home screen.
 *
 * URL: /api/public/manifest/<buildingId>
 * Served with Content-Type: application/manifest+json (browsers honor the
 * header — the `.webmanifest` filename suffix is not required).
 */
export const Route = createFileRoute("/api/public/manifest/$buildingId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const buildingId = String((params as any).buildingId || "").replace(
          /\.webmanifest$/i,
          "",
        );

        const defaults = {
          name: "Residence",
          short_name: "Residence",
          theme_color: "#0F172A",
          background_color: "#0F172A",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ] as Array<Record<string, string>>,
        };

        let name = defaults.name;
        let short_name = defaults.short_name;
        let theme_color = defaults.theme_color;
        let background_color = defaults.background_color;
        let icons = defaults.icons;

        if (/^[0-9a-f-]{36}$/i.test(buildingId)) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await supabaseAdmin
              .from("building_branding")
              .select(
                "community_name,app_name,app_short_name,app_icon_url,community_icon_url,logo_url,primary_color",
              )
              .eq("building_id", buildingId)
              .maybeSingle();
            if (data) {
              name =
                ((data as any).app_name as string | null)?.trim() ||
                ((data as any).community_name as string | null)?.trim() ||
                name;
              short_name =
                ((data as any).app_short_name as string | null)?.trim() ||
                ((data as any).community_name as string | null)?.trim() ||
                name.slice(0, 12);
              theme_color =
                ((data as any).primary_color as string | null)?.trim() || theme_color;
              background_color = theme_color;
              const iconUrl =
                ((data as any).app_icon_url as string | null) ||
                ((data as any).community_icon_url as string | null) ||
                ((data as any).logo_url as string | null);
              if (iconUrl) {
                icons = [
                  { src: iconUrl, sizes: "192x192", type: "image/png", purpose: "any maskable" },
                  { src: iconUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" },
                ];
              }
            }
          } catch (e) {
            console.error("[manifest] failed to load branding", e);
          }
        }

        const manifest = {
          name,
          short_name,
          description: `${name} — your community, curated.`,
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          theme_color,
          background_color,
          categories: ["lifestyle", "social", "productivity"],
          icons,
        };

        return new Response(JSON.stringify(manifest, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/manifest+json",
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          },
        });
      },
    },
  },
});
