import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  scoreCircleForResident,
  categoryEmojiFallback,
  categoryLabel,
} from "@/lib/circle-categories";

type Circle = {
  id: string;
  name: string;
  emoji: string;
  category: string;
  interest_tag: string | null;
  member_count: number;
  visibility: string;
  circle_type: string;
};

/**
 * Compact recommendation strip surfaced on the building home, onboarding, etc.
 * Loads up to `limit` public circles ranked against the resident's interests.
 */
export function CircleRecommendations({
  buildingId,
  interests,
  userId,
  limit = 3,
  title = "Circles for you",
  subtitle = "Hand-picked from your interests.",
  className,
}: {
  buildingId: string;
  interests: string[];
  userId?: string | null;
  limit?: number;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: gs }, { data: mems }] = await Promise.all([
        supabase
          .from("groups")
          .select("id, name, emoji, category, interest_tag, member_count, visibility, circle_type")
          .eq("building_id", buildingId)
          .eq("visibility", "public"),
        userId
          ? supabase.from("group_members").select("group_id").eq("user_id", userId)
          : Promise.resolve({ data: [] as { group_id: string }[] }),
      ]);
      if (cancelled) return;
      setCircles((gs as Circle[]) ?? []);
      setJoined(new Set(((mems as { data: { group_id: string }[] | null })?.data ?? mems?.data ?? []).map?.((m: { group_id: string }) => m.group_id) ?? []));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, userId]);

  const ranked = useMemo(() => {
    return circles
      .filter((c) => c.category !== "system" && !joined.has(c.id))
      .map((c) => ({ c, s: scoreCircleForResident(c, interests) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => x.c);
  }, [circles, joined, interests, limit]);

  const handleJoin = async (c: Circle) => {
    if (!userId) return;
    setBusy(c.id);
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: c.id, user_id: userId });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setJoined((prev) => new Set(prev).add(c.id));
    toast.success(`Joined ${c.name}`);
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (ranked.length === 0) return null;

  return (
    <section className={className}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl text-foreground">
            <Sparkles className="h-4 w-4 text-accent" /> {title}
          </h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Link to="/groups" className="text-xs font-medium text-primary hover:underline">
          See all
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((c) => (
          <div
            key={c.id}
            className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="text-3xl leading-none">{c.emoji || categoryEmojiFallback(c.category)}</span>
              <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {categoryLabel(c.category)}
              </span>
            </div>
            <h3 className="mt-3 truncate font-medium text-foreground">{c.name}</h3>
            <p className="text-xs text-muted-foreground">
              {c.member_count} {c.member_count === 1 ? "member" : "members"}
            </p>
            <div className="mt-4">
              <Button
                size="sm"
                className="w-full"
                disabled={busy === c.id || !userId}
                onClick={() => handleJoin(c)}
              >
                {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
