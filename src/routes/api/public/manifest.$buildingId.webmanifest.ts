import { createFileRoute } from "@tanstack/react-router";

/**
 * Building-specific PWA manifest. When a resident installs the app from their
 * building's URL, iOS/Android cache this manifest and show the building's
 * branded name + icon on the home screen.
 */
export const Route = createFileRoute("/api/public/manifest/$buildingId/webmanifest")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = (params as any).buildingId as string;
        // The route ".webmanifest" suffix is captured in the filename; strip if present.
        const buildingId = raw.replace(/\.webmanifest$/i, "");

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
              (data.app_name as string | null)?.trim() ||
              (data.community_name as string | null)?.trim() ||
              name;
            short_name =
              (data.app_short_name as string | null)?.trim() ||
              (data.community_name as string | null)?.trim() ||
              name.slice(0, 12);
            theme_color = (data.primary_color as string | null)?.trim() || theme_color;
            background_color = theme_color;
            const iconUrl =
              (data.app_icon_url as string | null) ||
              (data.community_icon_url as string | null) ||
              (data.logo_url as string | null);
            if (iconUrl) {
              icons = [
                { src: iconUrl, sizes: "192x192", type: "image/png", purpose: "any maskable" },
                { src: iconUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" },
              ];
            }
          }
        } catch (e) {
          // fall through to defaults
          console.error("[manifest] failed to load branding", e);
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
