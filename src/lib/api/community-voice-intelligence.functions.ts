import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Batch-score sentiment for recent Community Voice submissions in a building.
 * Uses Lovable AI Gateway (google/gemini-2.5-flash — free tier). Only scores
 * submissions where sentiment IS NULL. Caller must be a manager or admin.
 */
export const scoreCommunityVoiceSentiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { buildingId: string; limit?: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const limit = Math.min(Math.max(data.limit ?? 25, 1), 50);

    // Authorize as manager/admin of this building
    const [{ data: mgr }, { data: adminRole }] = await Promise.all([
      supabase.from("property_managers").select("id").eq("user_id", userId).eq("building_id", data.buildingId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" as never }),
    ]);
    if (!mgr && !adminRole) throw new Error("Not authorized");

    const { data: rows, error } = await supabase
      .from("community_voice_submissions")
      .select("id, subject, description")
      .eq("building_id", data.buildingId)
      .is("sentiment" as never, null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!rows?.length) return { scored: 0 };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI Gateway not configured");

    let scored = 0;
    for (const row of rows) {
      const text = `Subject: ${row.subject}\n\n${row.description}`.slice(0, 4000);
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: 'Classify the sentiment of resident feedback. Reply with JSON only: {"sentiment":"positive|neutral|negative","score":-1..1}. score: -1 very negative, 0 neutral, +1 very positive.' },
              { role: "user", content: text },
            ],
            temperature: 0,
          }),
        });
        if (!res.ok) continue;
        const json: unknown = await res.json();
        const content = (json as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? "";
        const match = content.match(/\{[^}]*\}/);
        if (!match) continue;
        const parsed = JSON.parse(match[0]) as { sentiment?: string; score?: number };
        if (!parsed.sentiment || !["positive", "neutral", "negative"].includes(parsed.sentiment)) continue;
        await supabase
          .from("community_voice_submissions")
          .update({ sentiment: parsed.sentiment, sentiment_score: parsed.score ?? 0 } as never)
          .eq("id", row.id);
        scored += 1;
      } catch {
        // continue on individual failures
      }
    }
    return { scored };
  });
