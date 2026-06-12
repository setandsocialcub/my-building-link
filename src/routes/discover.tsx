import { ResidentPageShell } from "@/components/ResidentPageShell";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Users, Search, Sparkles, Send, CalendarCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { FeatureGate } from "@/components/FeatureGate";
import { useBranding } from "@/components/BrandingProvider";
import { brandingValue } from "@/lib/branding";

export const Route = createFileRoute("/discover")({
  component: () => (
    <FeatureGate feature="enable_ai_matching" featureLabel="Community Match">
      <DiscoverPage />
    </FeatureGate>
  ),
});

const INTEREST_CATEGORIES: Record<string, string[]> = {
  "Wellness & Movement": [
    "Running", "Cycling", "Yoga", "Strength Training",
    "Swimming", "Hiking", "Dance", "Tennis", "Pilates",
  ],
  "Food & Drink": [
    "Cooking", "Wine", "Cocktails", "Coffee",
    "Vegan & Plant-Based", "Baking", "Restaurant Hunting",
  ],
  "Arts & Culture": [
    "Music", "Live Music & Concerts", "Photography",
    "Film & Cinema", "Reading & Books", "Visual Art", "Writing",
  ],
  "Career & Professional": [
    "Tech & Startups", "Finance & Investing",
    "Entrepreneurship", "Creative Industries", "Real Estate",
  ],
  "Lifestyle & Social": [
    "Pets & Dogs", "Parenting & Kids", "Travel", "Gaming",
    "Sustainability", "Sports Watching", "Meditation", "Board Games",
  ],
  "Building Life": [
    "New to the Building", "New to the City",
    "Remote Worker", "Looking for Running Buddy", "Looking for Carpool",
  ],
};

const CATEGORY_LABELS: Record<string, string> = {
  "Wellness & Movement": "Wellness",
  "Food & Drink": "Food & Drink",
  "Arts & Culture": "Arts",
  "Career & Professional": "Career",
  "Lifestyle & Social": "Lifestyle",
  "Building Life": "Building Life",
};

type ResidentRow = {
  id: string;
  user_id: string;
  building_id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  interest_tags: string[];
  is_visible: boolean;
  visibility: "self" | "full" | "limited" | "discover" | "hidden";
};

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
};

type IntroductionRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined" | "expired";
  message: string | null;
  created_at: string;
};

type MyProfile = {
  id: string;
  user_id: string;
  building_id: string;
  interest_tags: string[];
};

function initialsFor(firstName: string, lastName: string | null) {
  const f = firstName?.[0] ?? "?";
  const l = lastName?.[0] ?? "";
  return (f + l).toUpperCase();
}

function displayName(firstName: string, lastName: string | null) {
  return lastName ? `${firstName} ${lastName[0]}.` : firstName;
}

type Match = {
  resident: ResidentRow;
  sharedInterests: string[];
  sharedCircles: number;
  sharedEvents: number;
  score: number;
};

function DiscoverPage() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const community = brandingValue(branding, "community_name");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [introductions, setIntroductions] = useState<IntroductionRow[]>([]);
  /** Map other resident user_id -> count of circles we both belong to */
  const [sharedCirclesByUser, setSharedCirclesByUser] = useState<Record<string, number>>({});
  /** Map other resident profile_id -> count of events we both RSVP'd "going" */
  const [sharedEventsByProfile, setSharedEventsByProfile] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Request introduction dialog
  const [introTarget, setIntroTarget] = useState<ResidentRow | null>(null);
  const [introMessage, setIntroMessage] = useState("");
  const [introSending, setIntroSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }
      const { data: profiles, error: pErr } = await supabase
        .from("resident_profiles")
        .select("id, building_id, interest_tags")
        .eq("user_id", auth.user.id)
        .limit(1);
      if (pErr || !profiles || profiles.length === 0) {
        toast.error("Join a building to find your circle.");
        navigate({ to: "/resident-access" });
        return;
      }
      const mine: MyProfile = {
        id: profiles[0].id,
        user_id: auth.user.id,
        building_id: profiles[0].building_id,
        interest_tags: (profiles[0].interest_tags ?? []) as string[],
      };

      const [othersRes, connsRes, introsRes, myCirclesRes, myRsvpsRes] = await Promise.all([
        supabase
          .from("resident_profiles_safe")
          .select("id, user_id, building_id, first_name, last_name, job_title, interest_tags, is_visible, visibility")
          .eq("building_id", mine.building_id)
          .neq("user_id", auth.user.id),
        supabase
          .from("connections")
          .select("id, requester_id, addressee_id, status")
          .or(`requester_id.eq.${mine.id},addressee_id.eq.${mine.id}`),
        supabase
          .from("resident_introductions")
          .select("id, requester_id, recipient_id, status, message, created_at")
          .or(`requester_id.eq.${mine.id},recipient_id.eq.${mine.id}`),
        supabase.from("group_members").select("group_id").eq("user_id", auth.user.id),
        supabase
          .from("event_rsvps")
          .select("event_id")
          .eq("profile_id", mine.id)
          .eq("status", "going"),
      ]);

      if (cancelled) return;

      const others = ((othersRes.data ?? []) as ResidentRow[]).filter((r) => r.is_visible);

      // Shared circles: pull all members of my groups in this building.
      const myGroupIds = (myCirclesRes.data ?? []).map((g) => g.group_id as string);
      const circleCounts: Record<string, number> = {};
      if (myGroupIds.length > 0) {
        const { data: coMembers } = await supabase
          .from("group_members")
          .select("group_id, user_id")
          .in("group_id", myGroupIds);
        for (const row of (coMembers ?? []) as { user_id: string }[]) {
          if (row.user_id === auth.user.id) continue;
          circleCounts[row.user_id] = (circleCounts[row.user_id] ?? 0) + 1;
        }
      }

      // Shared events: residents who RSVP'd "going" to events I'm going to.
      const myEventIds = (myRsvpsRes.data ?? []).map((r) => r.event_id as string);
      const eventCounts: Record<string, number> = {};
      if (myEventIds.length > 0) {
        const { data: coRsvps } = await supabase
          .from("event_rsvps")
          .select("event_id, profile_id")
          .in("event_id", myEventIds)
          .eq("status", "going");
        for (const row of (coRsvps ?? []) as { profile_id: string }[]) {
          if (row.profile_id === mine.id) continue;
          eventCounts[row.profile_id] = (eventCounts[row.profile_id] ?? 0) + 1;
        }
      }

      setMe(mine);
      setResidents(others);
      setConnections((connsRes.data ?? []) as ConnectionRow[]);
      setIntroductions((introsRes.data ?? []) as IntroductionRow[]);
      setSharedCirclesByUser(circleCounts);
      setSharedEventsByProfile(eventCounts);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Live refresh when any resident in this building changes their privacy/profile.
  useEffect(() => {
    if (!me) return;
    const refetchResidents = async () => {
      const { data } = await supabase
        .from("resident_profiles_safe")
        .select("id, user_id, building_id, first_name, last_name, job_title, interest_tags, is_visible, visibility")
        .eq("building_id", me.building_id)
        .neq("user_id", me.user_id);
      setResidents(((data ?? []) as ResidentRow[]).filter((r) => r.is_visible));
    };

    const channel = supabase
      .channel(`profiles:${me.building_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "resident_profiles",
          filter: `building_id=eq.${me.building_id}`,
        },
        () => {
          void refetchResidents();
        },
      )
      .subscribe();

    const onLocal = () => {
      void refetchResidents();
    };
    window.addEventListener("privacy:changed", onLocal);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("privacy:changed", onLocal);
    };
  }, [me]);

  const myInterests = useMemo(
    () => new Set((me?.interest_tags ?? []).map((t) => t.toLowerCase())),
    [me],
  );

  const activeCategoryTags = useMemo(() => {
    if (!activeCategory) return null;
    return new Set(
      (INTEREST_CATEGORIES[activeCategory] ?? []).map((t) => t.toLowerCase()),
    );
  }, [activeCategory]);

  const matches: Match[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residents
      .map((r) => {
        const sharedInterests = r.interest_tags.filter((t) =>
          myInterests.has(t.toLowerCase()),
        );
        const sharedCircles = sharedCirclesByUser[r.user_id] ?? 0;
        const sharedEvents = sharedEventsByProfile[r.id] ?? 0;
        const score = sharedInterests.length * 2 + sharedCircles * 3 + sharedEvents * 4;
        return { resident: r, sharedInterests, sharedCircles, sharedEvents, score };
      })
      .filter(({ resident }) => {
        if (q && !resident.first_name.toLowerCase().includes(q)) return false;
        if (activeCategoryTags) {
          const hasAny = resident.interest_tags.some((t) =>
            activeCategoryTags.has(t.toLowerCase()),
          );
          if (!hasAny) return false;
        }
        return true;
      })
      .sort((a, b) => b.score - a.score);
  }, [residents, myInterests, activeCategoryTags, search, sharedCirclesByUser, sharedEventsByProfile]);

  const recommended = useMemo(() => matches.filter((m) => m.score > 0).slice(0, 3), [matches]);

  const introFor = (otherProfileId: string) =>
    introductions
      .filter(
        (i) =>
          (i.requester_id === me?.id && i.recipient_id === otherProfileId) ||
          (i.recipient_id === me?.id && i.requester_id === otherProfileId),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  const connectionFor = (otherProfileId: string) =>
    connections.find(
      (c) =>
        (c.requester_id === me?.id && c.addressee_id === otherProfileId) ||
        (c.addressee_id === me?.id && c.requester_id === otherProfileId),
    );

  const openIntroDialog = (other: ResidentRow) => {
    setIntroTarget(other);
    setIntroMessage("");
  };

  const sendIntroduction = async () => {
    if (!me || !introTarget) return;
    setIntroSending(true);
    const { data, error } = await supabase
      .from("resident_introductions")
      .insert({
        building_id: me.building_id,
        requester_id: me.id,
        recipient_id: introTarget.id,
        message: introMessage.trim() || null,
        status: "pending",
      })
      .select("id, requester_id, recipient_id, status, message, created_at")
      .single();
    setIntroSending(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not send the introduction.");
      return;
    }
    setIntroductions((prev) => [...prev, data as IntroductionRow]);
    toast.success(`Introduction requested with ${introTarget.first_name}.`);
    setIntroTarget(null);
    setIntroMessage("");
  };

  const respondIntroduction = async (
    intro: IntroductionRow,
    next: "accepted" | "declined",
    other: ResidentRow,
  ) => {
    setBusyId(other.id);
    const { error } = await supabase
      .from("resident_introductions")
      .update({ status: next })
      .eq("id", intro.id);

    if (error) {
      setBusyId(null);
      toast.error(error.message);
      return;
    }

    setIntroductions((prev) =>
      prev.map((i) => (i.id === intro.id ? { ...i, status: next } : i)),
    );

    if (next === "accepted" && me) {
      // The DB trigger opens (or upserts) the connection — refresh ours.
      const { data: conns } = await supabase
        .from("connections")
        .select("id, requester_id, addressee_id, status")
        .or(`requester_id.eq.${me.id},addressee_id.eq.${me.id}`);
      setConnections((conns ?? []) as ConnectionRow[]);
      toast.success(`Introduction accepted — your conversation with ${other.first_name} is open.`);
    } else {
      toast("Introduction declined.");
    }
    setBusyId(null);
  };

  if (loading) {
    return (
      <ResidentPageShell title="Community Match">
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </ResidentPageShell>
    );
  }

  return (
    <ResidentPageShell title="Community Match" subtitle={`Concierge introductions at ${community}`}>
      <div>
        <header className="border-b border-border bg-card/50 -mx-4 px-4 md:-mx-6 md:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between py-5">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
              Concierge Introductions
            </p>
            <h1 className="font-serif text-4xl text-foreground">
              Community Match
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hand-curated neighbors from {community} you might enjoy meeting. Request an introduction — they decide what happens next.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/building/$buildingId" params={{ buildingId: me?.building_id ?? "" }}>
              <Users className="mr-2 h-4 w-4" /> Building
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl py-8 space-y-10">
        {/* Concierge recommendations */}
        {recommended.length > 0 && (
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-serif text-2xl text-foreground">
                  <Sparkles className="h-4 w-4 text-accent" /> The Concierge Recommends
                </h2>
                <p className="text-xs text-muted-foreground">
                  Selected from shared interests, circles, and experiences you both attend.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recommended.map((m) => (
                <MatchCard
                  key={`rec-${m.resident.id}`}
                  match={m}
                  myInterests={myInterests}
                  intro={introFor(m.resident.id)}
                  connection={connectionFor(m.resident.id)}
                  meProfileId={me?.id ?? null}
                  busyId={busyId}
                  onRequest={() => openIntroDialog(m.resident)}
                  onRespond={respondIntroduction}
                  highlight
                />
              ))}
            </div>
          </section>
        )}

        {/* Filter bar */}
        <section>
          <div className="mb-6 space-y-4">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by first name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs font-medium transition",
                  activeCategory === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {Object.keys(INTEREST_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-xs font-medium transition",
                    activeCategory === cat
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {matches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No neighbors match your filters yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((m) => (
                <MatchCard
                  key={m.resident.id}
                  match={m}
                  myInterests={myInterests}
                  intro={introFor(m.resident.id)}
                  connection={connectionFor(m.resident.id)}
                  meProfileId={me?.id ?? null}
                  busyId={busyId}
                  onRequest={() => openIntroDialog(m.resident)}
                  onRespond={respondIntroduction}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog open={!!introTarget} onOpenChange={(o) => !o && setIntroTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <Send className="h-4 w-4 text-accent" />
              Request an introduction
              {introTarget ? ` with ${introTarget.first_name}` : ""}
            </DialogTitle>
            <DialogDescription>
              They&apos;ll receive a private note. Conversations open only after they accept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="intro-msg">A short, considered note</Label>
              <Textarea
                id="intro-msg"
                rows={4}
                maxLength={500}
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                placeholder={`Hi${introTarget ? " " + introTarget.first_name : ""} — noticed we both…`}
              />
              <p className="text-[11px] text-muted-foreground">
                Optional. Kept private between the two of you. {introMessage.length}/500
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIntroTarget(null)} disabled={introSending}>
              Cancel
            </Button>
            <Button onClick={sendIntroduction} disabled={introSending}>
              {introSending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Send className="h-4 w-4" /> Send request</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      </div>
    </ResidentPageShell>
  );
}

function MatchCard({
  match,
  myInterests,
  intro,
  connection,
  meProfileId,
  busyId,
  onRequest,
  onRespond,
  highlight,
}: {
  match: Match;
  myInterests: Set<string>;
  intro: IntroductionRow | undefined;
  connection: ConnectionRow | undefined;
  meProfileId: string | null;
  busyId: string | null;
  onRequest: () => void;
  onRespond: (intro: IntroductionRow, next: "accepted" | "declined", other: ResidentRow) => void;
  highlight?: boolean;
}) {
  const { resident, sharedInterests, sharedCircles, sharedEvents } = match;
  const tagsToShow = resident.interest_tags.slice(0, 4);
  const initials = initialsFor(resident.first_name, resident.last_name);
  const iAmRequester = intro ? intro.requester_id === meProfileId : false;

  const renderCta = () => {
    // Accepted connection => Conversation open
    if (connection?.status === "accepted" || intro?.status === "accepted") {
      return (
        <Button variant="outline" className="w-full" asChild>
          <a href={connection ? `/messages/${connection.id}` : "/messages"}>Open Conversation</a>
        </Button>
      );
    }
    if (intro?.status === "pending" && iAmRequester) {
      return (
        <Button variant="ghost" className="w-full" disabled>
          Awaiting their reply
        </Button>
      );
    }
    if (intro?.status === "pending" && !iAmRequester) {
      return (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={busyId === resident.id}
            onClick={() => onRespond(intro, "declined", resident)}
          >
            Decline
          </Button>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={busyId === resident.id}
            onClick={() => onRespond(intro, "accepted", resident)}
          >
            Accept
          </Button>
        </div>
      );
    }
    if (intro?.status === "declined" || intro?.status === "expired") {
      return (
        <Button variant="ghost" className="w-full" disabled>
          Introduction closed
        </Button>
      );
    }
    return (
      <Button className="w-full" onClick={onRequest}>
        <Send className="h-4 w-4" /> Request Introduction
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md",
        highlight ? "border-accent/40 ring-1 ring-accent/20" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/20 text-base font-semibold text-foreground">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-foreground">
            {displayName(resident.first_name, resident.last_name)}
          </h3>
          {resident.job_title ? (
            <p className="truncate text-xs text-muted-foreground">
              {resident.job_title}
            </p>
          ) : resident.visibility === "discover" ? (
            <p className="truncate text-[11px] text-muted-foreground italic">
              Profile unlocks after an accepted introduction
            </p>
          ) : resident.visibility === "limited" ? (
            <p className="truncate text-[11px] text-muted-foreground italic">
              Limited profile
            </p>
          ) : null}
        </div>
      </div>

      {/* Shared signals */}
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
        {sharedInterests.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-foreground">
            <Sparkles className="h-3 w-3" /> {sharedInterests.length} shared interest{sharedInterests.length === 1 ? "" : "s"}
          </span>
        )}
        {sharedCircles > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
            <UsersRound className="h-3 w-3" /> {sharedCircles} circle{sharedCircles === 1 ? "" : "s"}
          </span>
        )}
        {sharedEvents > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
            <CalendarCheck className="h-3 w-3" /> {sharedEvents} experience{sharedEvents === 1 ? "" : "s"}
          </span>
        )}
        {sharedInterests.length === 0 && sharedCircles === 0 && sharedEvents === 0 && (
          <span className="text-muted-foreground">In your building</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {tagsToShow.map((tag) => {
          const shared = myInterests.has(tag.toLowerCase());
          return (
            <Badge
              key={tag}
              variant={shared ? "default" : "secondary"}
              className={cn("text-[11px]", shared ? "bg-accent/30 text-foreground hover:bg-accent/30" : "")}
            >
              {tag}
            </Badge>
          );
        })}
        {resident.interest_tags.length > 4 && (
          <Badge variant="secondary" className="text-[11px] text-muted-foreground">
            +{resident.interest_tags.length - 4}
          </Badge>
        )}
      </div>

      <div className="mt-5">{renderCta()}</div>
    </div>
  );
}
