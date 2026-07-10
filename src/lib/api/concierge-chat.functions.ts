import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMsg = { role: "user" | "assistant"; content: string };

export const askConcierge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMsg[] }) => {
    if (!Array.isArray(input?.messages)) throw new Error("messages required");
    return { messages: input.messages.slice(-12) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("resident_profiles")
      .select("id, building_id, first_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.building_id) throw new Error("No building found for user");
    const buildingId = profile.building_id;
    const nowIso = new Date().toISOString();

    const [placesRes, neighborsRes, favRes, eventsRes, buildingRes] = await Promise.all([
      supabase
        .from("neighborhood_places")
        .select("name, category, subcategory, description, notes, address, tags, collections, is_featured, is_perk, perk_description, distance_note, source")
        .eq("building_id", buildingId)
        .eq("status", "approved")
        .order("is_featured", { ascending: false })
        .limit(120),
      supabase
        .from("resident_profiles")
        .select("first_name, last_name, professional_title, professional_category, service_bio, expert_badges, network_audience")
        .eq("building_id", buildingId)
        .eq("network_visible", true)
        .neq("user_id", userId)
        .limit(120),
      supabase
        .from("concierge_favorites")
        .select("place_id, neighborhood_places(name, category)")
        .eq("user_id", userId)
        .limit(50),
      supabase
        .from("events")
        .select("title, description, location, starts_at, cover_emoji")
        .eq("building_id", buildingId)
        .eq("status", "published" as never)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(20),
      supabase.from("buildings").select("name, city").eq("id", buildingId).maybeSingle(),
    ]);

    const places = (placesRes.data ?? []) as Array<Record<string, unknown>>;
    const neighbors = ((neighborsRes.data ?? []) as Array<Record<string, unknown>>).filter(
      (n) => ["everyone", "building"].includes(String(n.network_audience ?? "everyone")),
    );
    const favorites = (favRes.data ?? []) as Array<{ neighborhood_places: { name: string; category: string | null } | null }>;
    const events = (eventsRes.data ?? []) as Array<Record<string, unknown>>;
    const building = buildingRes.data as { name?: string; city?: string } | null;

    const ctx = {
      building: building?.name ?? "your building",
      city: building?.city ?? "",
      resident_first_name: profile.first_name ?? "resident",
      approved_recommendations: places.map((p) => ({
        name: p.name,
        category: p.category,
        subcategory: p.subcategory,
        description: p.description ?? p.notes,
        address: p.address,
        tags: p.tags,
        collections: p.collections,
        featured: p.is_featured,
        perk: p.is_perk ? p.perk_description ?? true : false,
        distance: p.distance_note,
      })),
      community_network_neighbors: neighbors.map((n) => ({
        name: `${n.first_name ?? ""} ${(n.last_name as string)?.[0] ?? ""}.`.trim(),
        title: n.professional_title,
        category: n.professional_category,
        bio: n.service_bio,
        expert_badges: n.expert_badges,
      })),
      resident_favorites: favorites
        .map((f) => f.neighborhood_places?.name)
        .filter(Boolean),
      upcoming_events: events.map((e) => ({
        title: e.title,
        when: e.starts_at,
        location: e.location,
        summary: e.description,
      })),
    };

    const system = `You are Community Concierge™, a warm, concise AI hospitality concierge for residents of ${ctx.building}${ctx.city ? ` in ${ctx.city}` : ""}.

Answer using ONLY the JSON context below. When recommending, prefer (1) resident favorites, (2) featured/management picks, (3) neighbors from Community Network™ when a professional service is asked for, (4) other approved recommendations, and (5) upcoming events when relevant.

Rules:
- Never invent places, neighbors, or events not present in the context.
- When suggesting a neighbor, mention them by first name + last initial and note it's from Community Network™.
- Keep answers short (2–5 sentences or a short bulleted list). Use markdown.
- If the context has no relevant match, say so honestly and suggest submitting a recommendation.

CONTEXT:
${JSON.stringify(ctx).slice(0, 18000)}`;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI Gateway not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          ...data.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit — please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please contact your building manager.");
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "Sorry, I couldn't generate a response.";
    return { reply };
  });
