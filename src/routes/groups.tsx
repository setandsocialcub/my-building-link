import { ResidentNav } from "@/components/ResidentNav";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
});

type GroupRow = {
  id: string;
  building_id: string;
  name: string;
  emoji: string;
  category: "system" | "sport" | "lifestyle" | "resident";
  interest_tag: string | null;
  is_pinned: boolean;
  is_default: boolean;
  member_count: number;
};

type MyProfile = {
  id: string;
  building_id: string;
  interest_tags: string[];
};

const SYSTEM_ORDER = ["General", "Announcements", "Marketplace"];

function GroupsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }
      const { data: profiles } = await supabase
        .from("resident_profiles")
        .select("id, building_id, interest_tags")
        .eq("user_id", auth.user.id)
        .limit(1);
      if (!profiles || profiles.length === 0) {
        toast.error("Join a building first.");
        navigate({ to: "/resident-access" });
        return;
      }
      const mine = profiles[0] as MyProfile;

      const [{ data: gs, error: gErr }, { data: mems, error: mErr }] = await Promise.all([
        supabase
          .from("groups")
          .select("id, building_id, name, emoji, category, interest_tag, is_pinned, is_default, member_count")
          .eq("building_id", mine.building_id)
          .order("name"),
        supabase.from("group_members").select("group_id").eq("user_id", auth.user.id),
      ]);

      if (cancelled) return;
      if (gErr) toast.error(gErr.message);
      if (mErr) toast.error(mErr.message);

      setMe(mine);
      setUserId(auth.user.id);
      setGroups((gs ?? []) as GroupRow[]);
      setJoinedIds(new Set((mems ?? []).map((m) => m.group_id as string)));
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

  const pinned = useMemo(() => {
    const byName = new Map(groups.map((g) => [g.name, g]));
    return SYSTEM_ORDER.map((n) => byName.get(n)).filter(Boolean) as GroupRow[];
  }, [groups]);

  const joinedGroups = useMemo(() => {
    const inPinnedIds = new Set(pinned.map((g) => g.id));
    const rest = groups.filter((g) => joinedIds.has(g.id) && !inPinnedIds.has(g.id));
    return [...pinned, ...rest];
  }, [groups, joinedIds, pinned]);

  const suggestions = useMemo(() => {
    if (myInterests.size === 0) return [];
    return groups
      .filter((g) => g.is_default && g.category !== "system" && !joinedIds.has(g.id))
      .filter((g) => {
        const tag = (g.interest_tag ?? "").toLowerCase();
        const name = g.name.toLowerCase();
        for (const i of myInterests) {
          if (!i) continue;
          if (tag && (tag.includes(i) || i.includes(tag))) return true;
          if (name.includes(i) || i.includes(name)) return true;
        }
        return false;
      })
      .slice(0, 4);
  }, [groups, joinedIds, myInterests]);

  const sportGroups = groups.filter((g) => g.category === "sport");
  const lifestyleGroups = groups.filter((g) => g.category === "lifestyle");
  const residentGroups = groups.filter((g) => g.category === "resident");

  const handleJoin = async (g: GroupRow) => {
    if (!userId) return;
    setBusyId(g.id);
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: g.id, user_id: userId });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setJoinedIds((prev) => new Set(prev).add(g.id));
    setGroups((prev) =>
      prev.map((x) => (x.id === g.id ? { ...x, member_count: x.member_count + 1 } : x)),
    );
    toast.success(`You joined ${g.name}!`);
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
            <h1
              className="text-3xl text-foreground"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Groups
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Find your people.</p>
          </div>
          {me && (
            <Button asChild variant="ghost" size="sm">
              <a href={`/building/${me.building_id}`}>
                <Users className="mr-2 h-4 w-4" /> Building
              </a>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-8">
        {/* Section 1 — You're In */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">You're In</h2>
          <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {joinedGroups.map((g) => (
              <GroupCard key={g.id} group={g} joined variant="open" />
            ))}
          </div>
        </section>

        {/* Section 2 — Suggestions */}
        {suggestions.length > 0 && (
          <section>
            <h2 className="mb-1 text-lg font-semibold text-foreground">Based on Your Interests</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Picked from your interest tags.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {suggestions.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  joined={false}
                  variant="join"
                  busy={busyId === g.id}
                  onJoin={() => handleJoin(g)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Section 3 — All Groups */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">All Groups</h2>
          <Tabs defaultValue="sport" className="w-full">
            <TabsList>
              <TabsTrigger value="sport">Sport & Activity</TabsTrigger>
              <TabsTrigger value="lifestyle">Lifestyle</TabsTrigger>
              <TabsTrigger value="resident">Resident-Created</TabsTrigger>
            </TabsList>
            <TabsContent value="sport" className="mt-6">
              <GroupGrid
                groups={sportGroups}
                joinedIds={joinedIds}
                busyId={busyId}
                onJoin={handleJoin}
              />
            </TabsContent>
            <TabsContent value="lifestyle" className="mt-6">
              <GroupGrid
                groups={lifestyleGroups}
                joinedIds={joinedIds}
                busyId={busyId}
                onJoin={handleJoin}
              />
            </TabsContent>
            <TabsContent value="resident" className="mt-6">
              {residentGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No resident-created groups yet. Be the first to start one.
                  </p>
                </div>
              ) : (
                <GroupGrid
                  groups={residentGroups}
                  joinedIds={joinedIds}
                  busyId={busyId}
                  onJoin={handleJoin}
                />
              )}
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}

function GroupGrid({
  groups,
  joinedIds,
  busyId,
  onJoin,
}: {
  groups: GroupRow[];
  joinedIds: Set<string>;
  busyId: string | null;
  onJoin: (g: GroupRow) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => {
        const joined = joinedIds.has(g.id);
        return (
          <GroupCard
            key={g.id}
            group={g}
            joined={joined}
            variant={joined ? "open" : "join"}
            busy={busyId === g.id}
            onJoin={() => onJoin(g)}
          />
        );
      })}
    </div>
  );
}

function GroupCard({
  group,
  joined,
  variant,
  busy,
  onJoin,
}: {
  group: GroupRow;
  joined: boolean;
  variant: "open" | "join";
  busy?: boolean;
  onJoin?: () => void;
}) {
  const href = group.name === "Marketplace" ? "/marketplace" : `/groups/${group.id}`;
  return (
    <div
      className={cn(
        "flex min-w-[220px] flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-4xl leading-none">{group.emoji}</span>
        {group.is_pinned && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
            Pinned
          </span>
        )}
      </div>
      <h3 className="mt-3 truncate font-medium text-foreground">{group.name}</h3>
      <p className="text-xs text-muted-foreground">
        {group.member_count} {group.member_count === 1 ? "member" : "members"}
      </p>
      <div className="mt-4">
        {variant === "open" ? (
          <Button asChild size="sm" variant="outline" className="w-full">
            <a href={href}>Open</a>
          </Button>
        ) : joined ? (
          <Button size="sm" variant="ghost" className="w-full" disabled>
            Joined
          </Button>
        ) : (
          <Button size="sm" className="w-full" disabled={busy} onClick={onJoin}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
          </Button>
        )}
      </div>
    </div>
  );
}
