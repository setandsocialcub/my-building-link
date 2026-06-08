import { supabase } from "@/integrations/supabase/client";

/**
 * Privacy-safe building analytics. All queries return aggregated counts.
 * No PII (names, emails, message bodies) is surfaced. Interest tags and
 * activity dimensions are only emitted as anonymous aggregate counts.
 *
 * Architected for future portfolio-level reporting: each loader is keyed by
 * buildingId and returns a serializable `BuildingPulse` shape. A portfolio
 * report can fan-out with `Promise.all(buildingIds.map(loadBuildingPulse))`
 * and merge the resulting summaries.
 */

const MIN_AGGREGATE = 3; // suppress tiny buckets to protect anonymity

export type TrendPoint = { date: string; value: number };

export type BuildingPulse = {
  buildingId: string;
  generatedAt: string;
  summary: {
    activeResidents: number; // last 30d
    totalResidents: number;
    newIntroductions: number; // last 30d
    acceptedIntroductions: number; // last 30d
    introAcceptRate: number; // 0..1
    circleParticipants: number; // distinct residents in any circle
    circleParticipationRate: number; // 0..1
    experienceAttendees: number; // distinct RSVPs going (last 30d + upcoming)
    onboardingCompletionRate: number; // 0..1
    onboardingCompleted: number;
  };
  topInterests: { tag: string; count: number }[];
  topCircles: { id: string; name: string; emoji: string | null; members: number }[];
  engagementTrend: TrendPoint[]; // active residents per day (last 30d)
  introTrend: TrendPoint[]; // introductions per day (last 30d)
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function emptyDayBuckets(days: number): Map<string, number> {
  const map = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  return map;
}

export async function loadBuildingPulse(buildingId: string): Promise<BuildingPulse> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sinceIso = thirtyDaysAgo.toISOString();

  const [
    residentsRes,
    introsRes,
    circleMembersRes,
    circlesRes,
    rsvpsRes,
  ] = await Promise.all([
    supabase
      .from("resident_profiles")
      .select("id, interest_tags, last_active_at, created_at, first_name")
      .eq("building_id", buildingId),
    supabase
      .from("resident_introductions")
      .select("id, status, created_at")
      .eq("building_id", buildingId)
      .gte("created_at", sinceIso),
    supabase
      .from("group_members")
      .select("group_id, user_id, groups!inner(building_id)")
      .eq("groups.building_id", buildingId),
    supabase
      .from("groups")
      .select("id, name, emoji, member_count, is_default")
      .eq("building_id", buildingId)
      .order("member_count", { ascending: false })
      .limit(8),
    supabase
      .from("event_rsvps")
      .select("profile_id, status, created_at, events!inner(building_id, starts_at)")
      .eq("events.building_id", buildingId)
      .eq("status", "going")
      .gte("created_at", sinceIso),
  ]);

  const residents = residentsRes.data ?? [];
  const intros = introsRes.data ?? [];
  const memberships = circleMembersRes.data ?? [];
  const circles = circlesRes.data ?? [];
  const rsvps = rsvpsRes.data ?? [];

  // --- residents
  const totalResidents = residents.length;
  const activeResidents = residents.filter(
    (r) => r.last_active_at && new Date(r.last_active_at) >= thirtyDaysAgo,
  ).length;

  // Onboarding completion proxy: has a first name AND at least one interest tag
  const onboardingCompleted = residents.filter(
    (r) => (r.first_name?.trim().length ?? 0) > 0 && (r.interest_tags?.length ?? 0) > 0,
  ).length;
  const onboardingCompletionRate = totalResidents > 0 ? onboardingCompleted / totalResidents : 0;

  // --- introductions
  const newIntroductions = intros.length;
  const acceptedIntroductions = intros.filter((i) => i.status === "accepted").length;
  const decided = intros.filter((i) => i.status === "accepted" || i.status === "declined").length;
  const introAcceptRate = decided > 0 ? acceptedIntroductions / decided : 0;

  // --- circle participation (distinct residents with any membership)
  const distinctMembers = new Set(memberships.map((m) => m.user_id));
  const circleParticipants = distinctMembers.size;
  const circleParticipationRate = totalResidents > 0 ? circleParticipants / totalResidents : 0;

  // --- experience attendance
  const experienceAttendees = new Set(rsvps.map((r) => r.profile_id)).size;

  // --- top interests (aggregated, suppress tiny buckets)
  const interestCounts = new Map<string, number>();
  for (const r of residents) {
    for (const tag of r.interest_tags ?? []) {
      const t = tag.toLowerCase().trim();
      if (!t) continue;
      interestCounts.set(t, (interestCounts.get(t) ?? 0) + 1);
    }
  }
  const topInterests = Array.from(interestCounts.entries())
    .filter(([, c]) => c >= MIN_AGGREGATE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  // --- top circles
  const topCircles = circles.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    emoji: (c.emoji as string | null) ?? null,
    members: (c.member_count as number) ?? 0,
  }));

  // --- engagement trend (active residents per day, last 30d)
  const engagementBuckets = emptyDayBuckets(30);
  for (const r of residents) {
    if (!r.last_active_at) continue;
    const d = new Date(r.last_active_at);
    if (d < thirtyDaysAgo) continue;
    const k = dayKey(r.last_active_at);
    if (engagementBuckets.has(k)) engagementBuckets.set(k, (engagementBuckets.get(k) ?? 0) + 1);
  }
  const engagementTrend: TrendPoint[] = Array.from(engagementBuckets.entries()).map(
    ([date, value]) => ({ date, value }),
  );

  // --- intro trend
  const introBuckets = emptyDayBuckets(30);
  for (const i of intros) {
    const k = dayKey(i.created_at);
    if (introBuckets.has(k)) introBuckets.set(k, (introBuckets.get(k) ?? 0) + 1);
  }
  const introTrend: TrendPoint[] = Array.from(introBuckets.entries()).map(([date, value]) => ({
    date,
    value,
  }));

  return {
    buildingId,
    generatedAt: now.toISOString(),
    summary: {
      activeResidents,
      totalResidents,
      newIntroductions,
      acceptedIntroductions,
      introAcceptRate,
      circleParticipants,
      circleParticipationRate,
      experienceAttendees,
      onboardingCompletionRate,
      onboardingCompleted,
    },
    topInterests,
    topCircles,
    engagementTrend,
    introTrend,
  };
}

/**
 * Future portfolio-level rollup. Aggregates pulse across multiple buildings.
 * Safe to call now; callers can wire it to a Super Admin "Portfolio Pulse"
 * view once available.
 */
export async function loadPortfolioPulse(buildingIds: string[]) {
  const pulses = await Promise.all(buildingIds.map((id) => loadBuildingPulse(id)));
  const sum = pulses.reduce(
    (acc, p) => {
      acc.activeResidents += p.summary.activeResidents;
      acc.totalResidents += p.summary.totalResidents;
      acc.newIntroductions += p.summary.newIntroductions;
      acc.acceptedIntroductions += p.summary.acceptedIntroductions;
      acc.circleParticipants += p.summary.circleParticipants;
      acc.experienceAttendees += p.summary.experienceAttendees;
      acc.onboardingCompleted += p.summary.onboardingCompleted;
      return acc;
    },
    {
      activeResidents: 0,
      totalResidents: 0,
      newIntroductions: 0,
      acceptedIntroductions: 0,
      circleParticipants: 0,
      experienceAttendees: 0,
      onboardingCompleted: 0,
    },
  );
  return { buildings: pulses, totals: sum };
}
