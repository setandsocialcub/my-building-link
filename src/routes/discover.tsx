import { ResidentNav } from "@/components/ResidentNav";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Users, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/discover")({
  component: DiscoverPage,
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
  building_id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  interest_tags: string[];
  is_visible: boolean;
};

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
};

type MyProfile = {
  id: string;
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

function DiscoverPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }
      // Load my resident profile (assumes one building per user for now)
      const { data: profiles, error: pErr } = await supabase
        .from("resident_profiles")
        .select("id, building_id, interest_tags")
        .eq("user_id", auth.user.id)
        .limit(1);
      if (pErr || !profiles || profiles.length === 0) {
        toast.error("Join a building first to discover neighbors.");
        navigate({ to: "/resident-access" });
        return;
      }
      const mine = profiles[0] as MyProfile;

      const [{ data: others, error: rErr }, { data: conns, error: cErr }] =
        await Promise.all([
          supabase
            .from("resident_profiles")
            .select("id, building_id, first_name, last_name, job_title, interest_tags, is_visible")
            .eq("building_id", mine.building_id)
            .neq("user_id", auth.user.id),
          supabase
            .from("connections")
            .select("id, requester_id, addressee_id, status")
            .or(`requester_id.eq.${mine.id},addressee_id.eq.${mine.id}`),
        ]);

      if (cancelled) return;
      if (rErr) toast.error(rErr.message);
      if (cErr) toast.error(cErr.message);

      setMe(mine);
      setResidents(((others ?? []) as ResidentRow[]).filter((r) => r.is_visible));
      setConnections((conns ?? []) as ConnectionRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

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

  const enriched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residents
      .map((r) => {
        const shared = r.interest_tags.filter((t) =>
          myInterests.has(t.toLowerCase()),
        );
        return { resident: r, sharedCount: shared.length };
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
      .sort((a, b) => b.sharedCount - a.sharedCount);
  }, [residents, myInterests, activeCategoryTags, search]);

  const connectionFor = (otherId: string) =>
    connections.find(
      (c) =>
        (c.requester_id === me?.id && c.addressee_id === otherId) ||
        (c.addressee_id === me?.id && c.requester_id === otherId),
    );

  const handleConnect = async (other: ResidentRow) => {
    if (!me) return;
    setBusyId(other.id);
    const { data, error } = await supabase
      .from("connections")
      .insert({
        building_id: me.building_id,
        requester_id: me.id,
        addressee_id: other.id,
        status: "pending",
      })
      .select("id, requester_id, addressee_id, status")
      .single();
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConnections((prev) => [...prev, data as ConnectionRow]);
    toast.success(`Request sent to ${other.first_name}`);
  };

  const handleAccept = async (conn: ConnectionRow, other: ResidentRow) => {
    setBusyId(other.id);
    const { error } = await supabase
      .from("connections")
      .update({ status: "accepted" })
      .eq("id", conn.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConnections((prev) =>
      prev.map((c) => (c.id === conn.id ? { ...c, status: "accepted" } : c)),
    );
    toast.success(`You're now connected with ${other.first_name}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="font-serif text-4xl text-foreground">
              Community Match
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Meet residents who share your tastes and rhythms.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/building/$buildingId" params={{ buildingId: me?.building_id ?? "" }}>
              <Users className="mr-2 h-4 w-4" /> Building
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Filter bar */}
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

        {enriched.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No neighbors match your filters yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enriched.map(({ resident, sharedCount }) => {
              const conn = connectionFor(resident.id);
              const iAmRequester = conn?.requester_id === me?.id;
              const tagsToShow = resident.interest_tags.slice(0, 4);
              const initials = initialsFor(resident.first_name, resident.last_name);

              return (
                <div
                  key={resident.id}
                  className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/20 text-base font-semibold text-foreground">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate font-medium text-foreground">
                          {displayName(resident.first_name, resident.last_name)}
                        </h3>
                        {sharedCount > 0 && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {sharedCount} in common
                          </Badge>
                        )}
                      </div>
                      {resident.job_title && (
                        <p className="truncate text-xs text-muted-foreground">
                          {resident.job_title}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {tagsToShow.map((tag) => {
                      const shared = myInterests.has(tag.toLowerCase());
                      return (
                        <span
                          key={tag}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium",
                            shared
                              ? "bg-accent/30 text-foreground"
                              : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {tag}
                        </span>
                      );
                    })}
                    {resident.interest_tags.length > 4 && (
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                        +{resident.interest_tags.length - 4}
                      </span>
                    )}
                  </div>

                  <div className="mt-5">
                    {!conn && (
                      <Button
                        className="w-full"
                        disabled={busyId === resident.id}
                        onClick={() => handleConnect(resident)}
                      >
                        {busyId === resident.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Connect"
                        )}
                      </Button>
                    )}
                    {conn?.status === "pending" && iAmRequester && (
                      <Button variant="ghost" className="w-full" disabled>
                        Pending
                      </Button>
                    )}
                    {conn?.status === "pending" && !iAmRequester && (
                      <Button
                        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                        disabled={busyId === resident.id}
                        onClick={() => handleAccept(conn, resident)}
                      >
                        Accept
                      </Button>
                    )}
                    {conn?.status === "accepted" && (
                      <Button variant="outline" className="w-full" asChild>
                        <a href={`/messages/${conn.id}`}>Message</a>
                      </Button>
                    )}
                    {conn?.status === "declined" && (
                      <Button variant="ghost" className="w-full" disabled>
                        Unavailable
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    <ResidentNav />
    </div>
  );
}
