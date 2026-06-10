import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Calendar,
  Users,
  HeartHandshake,
  ArrowRight,
  MapPin,
  Clock,
  Lock,
  TrendingUp,
  UtensilsCrossed,
  Dumbbell,
  Dog,
  Ticket,
  Gift,
  Plus,
  MessageCircle,
  UserPlus,
  Check,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CIRCLE_CATEGORIES, categoryLabel } from "@/lib/circle-categories";
import heroImg from "@/assets/home-hero.jpg";
import { useBranding } from "@/components/BrandingProvider";
import { brandingValue } from "@/lib/branding";

type Me = {
  id: string;
  user_id: string;
  first_name: string;
  interest_tags: string[];
};

type RecommendedResident = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  interest_tags: string[];
  sharedInterests: string[];
  sharedCircles: number;
  reason: string;
  isNew: boolean;
  introStatus?: "pending" | "accepted" | "declined" | "expired" | null;
  introId?: string;
  iAmRequester?: boolean;
};

type Experience = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  cover_emoji: string | null;
  rsvpStatus: "going" | "interested" | null;
};

type MyCircle = {
  id: string;
  name: string;
  emoji: string | null;
  member_count: number;
  recent_activity_at: string | null;
};

type Momentum = {
  activeThisWeek: number;
  introsThisWeek: number;
  upcomingExperiences: number;
  newCircleMembers: number;
};

type Highlight = { id: string; text: string; emoji: string };

const SUNSET_GRADIENT =
  "linear-gradient(135deg, rgba(201,122,99,0.85) 0%, rgba(183,165,141,0.7) 50%, rgba(168,178,161,0.6) 100%)";

export function ResidentHome({
  buildingId,
  me,
  buildingName,
}: {
  buildingId: string;
  me: Me;
  buildingName?: string;
}) {
  const [momentum, setMomentum] = useState<Momentum>({
    activeThisWeek: 0,
    introsThisWeek: 0,
    upcomingExperiences: 0,
    newCircleMembers: 0,
  });
  const [recommended, setRecommended] = useState<RecommendedResident[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [myCircles, setMyCircles] = useState<MyCircle[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [introInflight, setIntroInflight] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      const weekAgoIso = weekAgo.toISOString();
      const nowIso = now.toISOString();

      const [
        residentsRes,
        introsWeekRes,
        upcomingRes,
        newMembersRes,
        myMembershipsRes,
        myIntrosRes,
        rsvpsRes,
      ] = await Promise.all([
        supabase
          .from("resident_profiles")
          .select("id, user_id, first_name, last_name, job_title, interest_tags, last_active_at, created_at")
          .eq("building_id", buildingId)
          .eq("is_visible", true),
        supabase
          .from("resident_introductions")
          .select("id, requester_id, recipient_id, status, created_at")
          .eq("building_id", buildingId)
          .gte("created_at", weekAgoIso),
        supabase
          .from("events")
          .select("id, title, starts_at, location, cover_emoji")
          .eq("building_id", buildingId)
          .gte("starts_at", nowIso)
          .order("starts_at", { ascending: true })
          .limit(4),
        supabase
          .from("group_members")
          .select("user_id, group_id, joined_at, groups!inner(building_id, name, emoji)")
          .eq("groups.building_id", buildingId)
          .gte("joined_at", weekAgoIso),
        supabase
          .from("group_members")
          .select("group_id, joined_at, groups!inner(id, name, emoji, member_count, building_id)")
          .eq("user_id", me.user_id)
          .eq("groups.building_id", buildingId),
        supabase
          .from("resident_introductions")
          .select("id, recipient_id, requester_id, status")
          .or(`requester_id.eq.${me.id},recipient_id.eq.${me.id}`)
          .eq("building_id", buildingId),
        supabase
          .from("event_rsvps")
          .select("event_id, status")
          .eq("profile_id", me.id),
      ]);

      if (cancelled) return;

      const residents = (residentsRes.data ?? []).filter((r) => r.user_id !== me.user_id);
      const intros = introsWeekRes.data ?? [];
      const upcoming = upcomingRes.data ?? [];
      const newMembers = newMembersRes.data ?? [];
      const myMemberships = myMembershipsRes.data ?? [];
      const myIntros = myIntrosRes.data ?? [];
      const rsvps = rsvpsRes.data ?? [];

      const activeThisWeek = residents.filter(
        (r) => r.last_active_at && new Date(r.last_active_at) >= weekAgo,
      ).length;

      setMomentum({
        activeThisWeek,
        introsThisWeek: intros.length,
        upcomingExperiences: upcoming.length,
        newCircleMembers: newMembers.length,
      });

      // ----- Recommended residents
      // Pull memberships for shared-circle scoring
      const { data: allMemberships } = await supabase
        .from("group_members")
        .select("user_id, group_id, groups!inner(building_id)")
        .eq("groups.building_id", buildingId);
      const myGroupIds = new Set(
        (allMemberships ?? [])
          .filter((m) => m.user_id === me.user_id)
          .map((m) => m.group_id as string),
      );
      const sharedCirclesByUser = new Map<string, number>();
      for (const m of allMemberships ?? []) {
        if (m.user_id === me.user_id) continue;
        if (myGroupIds.has(m.group_id as string)) {
          sharedCirclesByUser.set(m.user_id, (sharedCirclesByUser.get(m.user_id) ?? 0) + 1);
        }
      }

      const myInterests = (me.interest_tags ?? []).map((t) => t.toLowerCase());
      const introMetaByProfile = new Map<
        string,
        { status: "pending" | "accepted" | "declined" | "expired"; id: string; iAmRequester: boolean }
      >();
      for (const it of myIntros) {
        const other = it.requester_id === me.id ? it.recipient_id : it.requester_id;
        const status = it.status as "pending" | "accepted" | "declined" | "expired";
        const iAmRequester = it.requester_id === me.id;
        if (status === "accepted") {
          introMetaByProfile.set(other, { status, id: it.id, iAmRequester });
        } else if (!introMetaByProfile.has(other)) {
          introMetaByProfile.set(other, { status, id: it.id, iAmRequester });
        }
      }

      const scored = residents.map((r) => {
        const tags = (r.interest_tags ?? []) as string[];
        const shared = tags.filter((t) => myInterests.includes(t.toLowerCase()));
        const sc = sharedCirclesByUser.get(r.user_id) ?? 0;
        const ageDays = (now.getTime() - new Date(r.created_at).getTime()) / 86400000;
        const isNew = ageDays < 14;
        const score = shared.length * 2 + sc * 3 + (isNew ? 1 : 0);
        return { r, tags, shared, sc, isNew, score };
      });
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, 3).map(({ r, tags, shared, sc, isNew }) => {
        let reason = "New to your community — say hello.";
        if (shared.length >= 2)
          reason = `You both enjoy ${shared.slice(0, 2).map(titleCase).join(" and ")}.`;
        else if (shared.length === 1) reason = `You both enjoy ${titleCase(shared[0])}.`;
        else if (sc > 0)
          reason = `You belong to ${sc} of the same Circle${sc === 1 ? "" : "s"}.`;
        else if (isNew) reason = "Recently joined the community.";
        const meta = introMetaByProfile.get(r.id);
        return {
          id: r.id,
          user_id: r.user_id,
          first_name: r.first_name,
          last_name: r.last_name as string | null,
          job_title: r.job_title as string | null,
          interest_tags: tags,
          sharedInterests: shared,
          sharedCircles: sc,
          reason,
          isNew,
          introStatus: meta?.status ?? null,
          introId: meta?.id,
          iAmRequester: meta?.iAmRequester,
        };
      });
      setRecommended(top);

      // ----- Experiences
      const rsvpMap = new Map<string, "going" | "interested">();
      for (const r of rsvps) rsvpMap.set(r.event_id as string, r.status as "going" | "interested");
      setExperiences(
        upcoming.map((e) => ({
          id: e.id as string,
          title: e.title as string,
          starts_at: e.starts_at as string,
          location: (e.location as string | null) ?? null,
          cover_emoji: (e.cover_emoji as string | null) ?? null,
          rsvpStatus: rsvpMap.get(e.id as string) ?? null,
        })),
      );

      // ----- My circles (with recent activity = most recent member joined_at)
      const recentByGroup = new Map<string, string>();
      for (const m of newMembers) {
        const prev = recentByGroup.get(m.group_id as string);
        if (!prev || new Date(m.joined_at as string) > new Date(prev)) {
          recentByGroup.set(m.group_id as string, m.joined_at as string);
        }
      }
      const circles: MyCircle[] = myMemberships.map((m) => {
        const g = m.groups as unknown as {
          id: string;
          name: string;
          emoji: string | null;
          member_count: number;
        };
        return {
          id: g.id,
          name: g.name,
          emoji: g.emoji ?? null,
          member_count: g.member_count ?? 0,
          recent_activity_at: recentByGroup.get(g.id) ?? null,
        };
      });
      setMyCircles(circles);

      // ----- Highlights (derived from real activity)
      const newIntrosCount = intros.filter((i) => i.status === "accepted").length;
      const computedHighlights: Highlight[] = [];
      if (newIntrosCount > 0) {
        computedHighlights.push({
          id: "h-intros",
          emoji: "🤝",
          text: `${newIntrosCount} new introduction${newIntrosCount === 1 ? "" : "s"} made this week.`,
        });
      }
      const circleGrowth = new Map<string, { name: string; count: number }>();
      for (const m of newMembers) {
        const g = m.groups as unknown as { name: string };
        const key = m.group_id as string;
        const cur = circleGrowth.get(key) ?? { name: g.name, count: 0 };
        cur.count += 1;
        circleGrowth.set(key, cur);
      }
      const topGrowing = Array.from(circleGrowth.values()).sort((a, b) => b.count - a.count)[0];
      if (topGrowing && topGrowing.count >= 2) {
        computedHighlights.push({
          id: "h-circle",
          emoji: "✨",
          text: `The ${topGrowing.name} Circle welcomed ${topGrowing.count} new member${topGrowing.count === 1 ? "" : "s"}.`,
        });
      }
      if (activeThisWeek > 0) {
        computedHighlights.push({
          id: "h-active",
          emoji: "🌿",
          text: `${activeThisWeek} resident${activeThisWeek === 1 ? "" : "s"} active in the community this week.`,
        });
      }
      if (upcoming.length > 0) {
        computedHighlights.push({
          id: "h-upcoming",
          emoji: "📅",
          text: `${upcoming.length} curated experience${upcoming.length === 1 ? "" : "s"} on the calendar.`,
        });
      }
      if (computedHighlights.length === 0) {
        computedHighlights.push({
          id: "h-empty",
          emoji: "🌅",
          text: "Your community is just getting started — be the first to spark something.",
        });
      }
      setHighlights(computedHighlights);

      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [buildingId, me.id, me.user_id, me.interest_tags]);

  const requestIntroduction = async (recipientProfileId: string) => {
    setIntroInflight((s) => ({ ...s, [recipientProfileId]: true }));
    const { data, error } = await supabase.from("resident_introductions").insert({
      building_id: buildingId,
      requester_id: me.id,
      recipient_id: recipientProfileId,
      status: "pending",
      message: null,
    }).select("id").single();
    setIntroInflight((s) => ({ ...s, [recipientProfileId]: false }));
    if (error) {
      console.error("[home] intro failed", error);
      return;
    }
    setRecommended((prev) =>
      prev.map((r) =>
        r.id === recipientProfileId
          ? { ...r, introStatus: "pending" as const, introId: data?.id, iAmRequester: true }
          : r,
      ),
    );
  };

  const respondIntroduction = async (
    profileId: string,
    introId: string,
    next: "accepted" | "declined",
  ) => {
    setIntroInflight((s) => ({ ...s, [profileId]: true }));
    const { error } = await supabase
      .from("resident_introductions")
      .update({ status: next })
      .eq("id", introId);
    setIntroInflight((s) => ({ ...s, [profileId]: false }));
    if (error) {
      console.error("[home] respond failed", error);
      return;
    }
    setRecommended((prev) =>
      prev.map((r) =>
        r.id === profileId ? { ...r, introStatus: next } : r,
      ),
    );
  };

  return (
    <div className="space-y-12 pb-8">
      <WelcomeHero firstName={me.first_name} buildingName={buildingName} />

      <MomentumWidget momentum={momentum} loading={loading} />

      <SectionHeader
        eyebrow="Concierge picks"
        title="Residents you may enjoy meeting"
        subtitle="Curated by the Community Match engine, refreshed daily."
        action={
          <Link
            to="/discover"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            See all matches <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <RecommendationGrid
        items={recommended}
        loading={loading}
        onRequestIntro={requestIntroduction}
        onRespondIntro={respondIntroduction}
        inflight={introInflight}
      />

      <SectionHeader
        eyebrow="On the calendar"
        title="Upcoming experiences"
        subtitle="From rooftop socials to sommelier evenings — your community, curated."
        action={
          <Link
            to="/events"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all experiences <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <ExperiencesGrid items={experiences} loading={loading} />

      <SectionHeader
        eyebrow="Your circles"
        title={myCircles.length > 0 ? "Where you belong" : "Find your circle"}
        subtitle={
          myCircles.length > 0
            ? "Stay close to the neighbors who share what you love."
            : "Discover circles tailored to your interests."
        }
        action={
          <Link
            to="/groups"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Browse all circles <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      {myCircles.length > 0 ? (
        <CirclesGrid items={myCircles} buildingId={buildingId} />
      ) : (
        <CircleSuggestions interests={me.interest_tags ?? []} />
      )}

      <SectionHeader
        eyebrow="In the air"
        title="Community highlights"
        subtitle="Moments that make this building feel like home."
      />
      <HighlightsRow items={highlights} />

      <SectionHeader
        eyebrow="Coming soon"
        title="Resident Concierge"
        subtitle="Curated recommendations, local perks, services, and experiences tailored to your community."
      />
      <ConciergePreview />
    </div>
  );
}

// ============================================================================
// Sections
// ============================================================================

function WelcomeHero({ firstName, buildingName }: { firstName: string; buildingName?: string }) {
  const { branding } = useBranding();
  const hour = new Date().getHours();
  const part =
    hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const customWelcome = branding?.welcome_message?.trim();
  const tagline = brandingValue(branding, "custom_tagline");
  const communityName = branding?.community_name?.trim() || buildingName;
  const heroSrc = branding?.hero_image_url || heroImg;
  return (
    <section className="relative overflow-hidden rounded-3xl">
      <div className="relative h-[360px] sm:h-[440px]">
        <img
          src={heroSrc}
          alt=""
          width={1600}
          height={800}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: SUNSET_GRADIENT, mixBlendMode: "multiply" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/20 to-transparent" />
        <div className="relative h-full flex flex-col justify-end p-8 sm:p-12 text-ivory">
          <p className="text-xs uppercase tracking-[0.2em] text-ivory/80 mb-3">
            {part}
            {communityName ? ` · ${communityName}` : ""}
          </p>
          <h1 className="font-serif text-4xl sm:text-6xl tracking-tight max-w-3xl leading-[1.05]">
            {customWelcome ? `${customWelcome}, ${firstName}.` : `Welcome home, ${firstName}.`}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-ivory/90 max-w-xl font-light">
            {tagline}
          </p>
        </div>
      </div>
    </section>
  );
}

function MomentumWidget({ momentum, loading }: { momentum: Momentum; loading: boolean }) {
  const items = [
    { label: "Active residents this week", value: momentum.activeThisWeek, icon: Users },
    { label: "New introductions this week", value: momentum.introsThisWeek, icon: HeartHandshake },
    { label: "Upcoming experiences", value: momentum.upcomingExperiences, icon: Calendar },
    { label: "New circle members", value: momentum.newCircleMembers, icon: Sparkles },
  ];
  return (
    <section>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Community momentum</p>
          <h2 className="font-serif text-2xl mt-1">The pulse of your building</h2>
        </div>
        <TrendingUp className="h-5 w-5 text-muted-foreground hidden sm:block" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(({ label, value, icon: Icon }) => (
          <Card
            key={label}
            className="border-border/60 bg-card/80 backdrop-blur shadow-[0_1px_3px_rgba(30,30,30,0.04),0_8px_24px_-12px_rgba(183,165,141,0.25)]"
          >
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-primary/70 shrink-0 mt-0.5" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground leading-snug">
                  {label}
                </span>
              </div>
              <div className="font-serif text-4xl text-foreground">{loading ? "—" : value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
        <h2 className="font-serif text-3xl sm:text-4xl mt-1 leading-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

function RecommendationGrid({
  items,
  loading,
  onRequestIntro,
  onRespondIntro,
  inflight,
}: {
  items: RecommendedResident[];
  loading: boolean;
  onRequestIntro: (id: string) => void;
  onRespondIntro: (profileId: string, introId: string, next: "accepted" | "declined") => void;
  inflight: Record<string, boolean>;
}) {
  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 rounded-2xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <Card className="border-dashed border-2 border-border/60 bg-card/60">
        <CardContent className="p-10 text-center space-y-2">
          <Sparkles className="h-6 w-6 mx-auto text-primary/60" />
          <p className="font-serif text-xl">Your concierge is still curating.</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            As more neighbors share their interests, you'll see thoughtful recommendations here.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((r) => (
        <ResidentCard
          key={r.id}
          r={r}
          onRequestIntro={() => onRequestIntro(r.id)}
          onRespondIntro={(introId, next) => onRespondIntro(r.id, introId, next)}
          inflight={!!inflight[r.id]}
        />
      ))}
    </div>
  );
}

function ResidentCard({
  r,
  onRequestIntro,
  onRespondIntro,
  inflight,
}: {
  r: RecommendedResident;
  onRequestIntro: () => void;
  onRespondIntro: (introId: string, next: "accepted" | "declined") => void;
  inflight: boolean;
}) {
  const initials = `${r.first_name?.[0] ?? ""}${r.last_name?.[0] ?? ""}`.toUpperCase() || "·";
  const fullName = `${r.first_name}${r.last_name ? " " + r.last_name : ""}`;
  return (
    <Card className="overflow-hidden border-border/50 bg-card hover:border-primary/30 transition-colors shadow-[0_1px_3px_rgba(30,30,30,0.04),0_12px_32px_-16px_rgba(183,165,141,0.3)]">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div
            className="h-16 w-16 rounded-full grid place-items-center font-serif text-2xl text-ivory shrink-0"
            style={{ background: "linear-gradient(135deg, #B7A58D 0%, #C97A63 100%)" }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-xl leading-tight truncate">{fullName}</h3>
            {r.job_title && (
              <p className="text-sm text-muted-foreground truncate">{r.job_title}</p>
            )}
            {r.isNew && (
              <Badge variant="outline" className="mt-2 text-[10px] uppercase tracking-wider border-primary/30 text-primary">
                New resident
              </Badge>
            )}
          </div>
        </div>

        <p className="text-sm italic text-foreground/80 leading-relaxed border-l-2 border-primary/40 pl-3">
          "{r.reason}"
        </p>

        {r.interest_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {r.interest_tags.slice(0, 4).map((t) => {
              const shared = r.sharedInterests.some(
                (s) => s.toLowerCase() === t.toLowerCase(),
              );
              return (
                <Badge
                  key={t}
                  variant={shared ? "default" : "secondary"}
                  className={
                    shared
                      ? "bg-primary/15 text-primary border-primary/20 hover:bg-primary/20 font-normal"
                      : "font-normal"
                  }
                >
                  {t}
                </Badge>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {r.introStatus === "accepted" ? (
            <Button asChild size="sm" className="flex-1 gap-1.5">
              <Link to="/messages">
                <MessageCircle className="h-3.5 w-3.5" /> Open conversation
              </Link>
            </Button>
          ) : r.introStatus === "pending" && !r.iAmRequester ? (
            <div className="flex flex-1 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={inflight}
                onClick={() => r.introId && onRespondIntro(r.introId, "declined")}
              >
                Decline
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                disabled={inflight}
                onClick={() => r.introId && onRespondIntro(r.introId, "accepted")}
              >
                <HeartHandshake className="h-3.5 w-3.5" /> Accept
              </Button>
            </div>
          ) : r.introStatus === "pending" ? (
            <Button size="sm" variant="secondary" disabled className="flex-1 gap-1.5">
              <Check className="h-3.5 w-3.5" /> Awaiting reply
            </Button>
          ) : r.introStatus === "declined" || r.introStatus === "expired" ? (
            <Button size="sm" variant="ghost" disabled className="flex-1 gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Introduction closed
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              onClick={onRequestIntro}
              disabled={inflight}
            >
              <HeartHandshake className="h-3.5 w-3.5" />
              Request introduction
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link to="/discover">View profile</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ExperiencesGrid({ items, loading }: { items: Experience[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="h-56 rounded-2xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <Card className="border-dashed border-2 border-border/60 bg-card/60">
        <CardContent className="p-10 text-center space-y-2">
          <Calendar className="h-6 w-6 mx-auto text-primary/60" />
          <p className="font-serif text-xl">No experiences scheduled yet.</p>
          <p className="text-sm text-muted-foreground">
            Your building team is curating the next one.
          </p>
          <Button asChild variant="outline" className="mt-2">
            <Link to="/events">Explore the calendar</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {items.map((e) => (
        <ExperienceCard key={e.id} e={e} />
      ))}
    </div>
  );
}

function ExperienceCard({ e }: { e: Experience }) {
  const d = new Date(e.starts_at);
  const dateLabel = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <Card className="overflow-hidden border-border/50 bg-card shadow-[0_1px_3px_rgba(30,30,30,0.04),0_12px_32px_-16px_rgba(183,165,141,0.3)] hover:shadow-[0_4px_12px_rgba(30,30,30,0.06),0_20px_40px_-12px_rgba(201,122,99,0.25)] transition-shadow">
      <div
        className="h-32 relative flex items-end p-5"
        style={{
          background:
            "linear-gradient(135deg, #FAF7F2 0%, #E8DDD0 50%, #C97A63 100%)",
        }}
      >
        <span className="text-5xl drop-shadow-sm">{e.cover_emoji ?? "✨"}</span>
        {e.rsvpStatus === "going" && (
          <Badge className="absolute top-4 right-4 bg-ivory text-charcoal border-0 gap-1">
            <Check className="h-3 w-3" /> You're going
          </Badge>
        )}
      </div>
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="font-serif text-2xl leading-tight">{e.title}</h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> {dateLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {timeLabel}
            </span>
            {e.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {e.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" className="flex-1">
            <Link to="/events">{e.rsvpStatus === "going" ? "Update RSVP" : "RSVP"}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/events">View details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CirclesGrid({ items, buildingId }: { items: MyCircle[]; buildingId: string }) {
  void buildingId;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((c) => (
        <Card
          key={c.id}
          className="border-border/50 bg-card hover:border-primary/30 transition-colors shadow-[0_1px_3px_rgba(30,30,30,0.04),0_12px_32px_-16px_rgba(183,165,141,0.3)]"
        >
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="text-3xl">{c.emoji ?? "✨"}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-xl leading-tight truncate">{c.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.member_count} member{c.member_count === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {c.recent_activity_at
                ? `New activity ${relTime(c.recent_activity_at)}`
                : "Quiet this week — start a conversation."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="default" className="gap-1.5">
                <Link to="/groups">
                  <ArrowRight className="h-3.5 w-3.5" /> View circle
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to="/groups">
                  <MessageCircle className="h-3.5 w-3.5" /> Discussion
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="gap-1.5">
                <Link to="/discover">
                  <UserPlus className="h-3.5 w-3.5" /> Invite
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CircleSuggestions({ interests }: { interests: string[] }) {
  const lower = useMemo(() => interests.map((t) => t.toLowerCase()), [interests]);
  const suggested = useMemo(() => {
    const scored = CIRCLE_CATEGORIES.filter((c) => c.key !== "custom").map((c) => {
      const matches = c.interestMatches.filter((m) => lower.some((t) => t.includes(m) || m.includes(t)));
      return { c, score: matches.length };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((s) => s.c);
  }, [lower]);
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {suggested.map((c) => (
        <Card key={c.key} className="border-border/50 bg-card">
          <CardContent className="p-6 space-y-3 text-center">
            <div className="text-3xl">{c.emoji}</div>
            <h3 className="font-serif text-xl">{categoryLabel(c.key)}</h3>
            <p className="text-sm text-muted-foreground">
              A natural fit based on your interests.
            </p>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/groups">
                <Plus className="h-3.5 w-3.5" /> Explore circle
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HighlightsRow({ items }: { items: Highlight[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((h) => (
        <Card
          key={h.id}
          className="border-border/50 bg-gradient-to-br from-ivory to-card shadow-[0_1px_3px_rgba(30,30,30,0.04),0_8px_24px_-12px_rgba(168,178,161,0.3)]"
        >
          <CardContent className="p-6 space-y-3">
            <div className="text-3xl">{h.emoji}</div>
            <p className="text-sm text-foreground leading-relaxed">{h.text}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ConciergePreview() {
  const items = [
    { label: "Restaurants", icon: UtensilsCrossed, blurb: "Tasting menus & neighborhood favorites" },
    { label: "Fitness", icon: Dumbbell, blurb: "Studio classes & personal trainers" },
    { label: "Pet Services", icon: Dog, blurb: "Walkers, groomers & vet partners" },
    { label: "Local Events", icon: Ticket, blurb: "Curated openings, shows & tastings" },
    { label: "Resident Perks", icon: Gift, blurb: "Exclusive offers from local partners" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {items.map(({ label, icon: Icon, blurb }) => (
        <Card
          key={label}
          className="border-border/50 bg-card/60 backdrop-blur relative overflow-hidden"
        >
          <CardContent className="p-5 space-y-3 text-center">
            <div
              className="mx-auto h-12 w-12 rounded-full grid place-items-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(183,165,141,0.15) 0%, rgba(201,122,99,0.15) 100%)",
              }}
            >
              <Icon className="h-5 w-5 text-primary/70" />
            </div>
            <h3 className="font-serif text-base">{label}</h3>
            <p className="text-xs text-muted-foreground leading-snug">{blurb}</p>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider gap-1 border-primary/30 text-primary/80">
              <Lock className="h-2.5 w-2.5" /> Coming soon
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
