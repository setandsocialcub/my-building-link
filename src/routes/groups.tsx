import { ResidentNav } from "@/components/ResidentNav";
import { FeatureGate } from "@/components/FeatureGate";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Users, Plus, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuildingSettings } from "@/hooks/use-building-settings";
import { CIRCLE_CATEGORIES, CIRCLE_TYPE_META, categoryLabel } from "@/lib/circle-categories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/groups")({
  component: () => (
    <FeatureGate feature="enable_circles" featureLabel="Circles">
      <GroupsPage />
    </FeatureGate>
  ),
});

type GroupRow = {
  id: string;
  building_id: string;
  name: string;
  emoji: string;
  category: string;
  interest_tag: string | null;
  is_pinned: boolean;
  is_default: boolean;
  member_count: number;
  circle_type: "resident_created" | "building_sponsored";
  visibility: "public" | "private";
  description: string | null;
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
          .select("id, building_id, name, emoji, category, interest_tag, is_pinned, is_default, member_count, circle_type, visibility, description")
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
            <h1 className="font-serif text-4xl text-foreground">
              Circles
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Curated company, just down the hall.</p>
          </div>
          <div className="flex items-center gap-2">
            {me && (
              <CreateCircleButton
                buildingId={me.building_id}
                onCreated={(g) => {
                  setGroups((prev) => [...prev, g]);
                  setJoinedIds((prev) => new Set(prev).add(g.id));
                }}
              />
            )}
            {me && (
              <Button asChild variant="ghost" size="sm">
                <a href={`/building/${me.building_id}`}>
                  <Users className="mr-2 h-4 w-4" /> Building
                </a>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-8">
        {/* Section 1 — You're In */}
        <section>
          <h2 className="mb-4 font-serif text-2xl text-foreground">Your Circles</h2>
          <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {joinedGroups.map((g) => (
              <GroupCard key={g.id} group={g} joined variant="open" />
            ))}
          </div>
        </section>

        {/* Section 2 — Suggestions */}
        {suggestions.length > 0 && (
          <section>
            <h2 className="mb-1 font-serif text-2xl text-foreground">Selected for You</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Hand-picked from the interests on your profile.
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

        {/* Section 3 — All Circles */}
        <section>
          <h2 className="mb-4 font-serif text-2xl text-foreground">All Circles</h2>
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
    <ResidentNav />
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
      <div className="flex items-start justify-between gap-2">
        <span className="text-4xl leading-none">{group.emoji}</span>
        <div className="flex flex-wrap items-center gap-1 justify-end">
          {group.visibility === "private" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3" /> Private
            </span>
          )}
          {group.is_pinned && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
              Pinned
            </span>
          )}
          {group.category !== "system" && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", CIRCLE_TYPE_META[group.circle_type]?.tone ?? "bg-secondary text-secondary-foreground")}>
              {CIRCLE_TYPE_META[group.circle_type]?.label ?? "Circle"}
            </span>
          )}
        </div>
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

function CreateCircleButton({
  buildingId,
  onCreated,
}: {
  buildingId: string;
  onCreated: (g: GroupRow) => void;
}) {
  const { settings } = useBuildingSettings(buildingId);
  const [open, setOpen] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("custom");
  const [circleType, setCircleType] = useState<"resident_created" | "building_sponsored">("resident_created");
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user || cancelled) return;
      setUserId(auth.user.id);
      const [{ data: mgr }, { data: prof }] = await Promise.all([
        supabase.from("property_managers").select("id").eq("user_id", auth.user.id).eq("building_id", buildingId).maybeSingle(),
        supabase.from("resident_profiles").select("id").eq("user_id", auth.user.id).eq("building_id", buildingId).maybeSingle(),
      ]);
      if (cancelled) return;
      setIsManager(!!mgr);
      setProfileId((prof?.id as string | undefined) ?? null);
      if (mgr) setCircleType("building_sponsored");
    })();
    return () => { cancelled = true; };
  }, [buildingId]);

  const canCreate =
    isManager ||
    (settings?.allow_resident_circle_creation ?? true);

  const visibilityLocked = !isManager && (settings?.limit_circle_visibility ?? false);

  if (!canCreate) return null;

  const meta = CIRCLE_CATEGORIES.find((c) => c.key === category);

  const submit = async () => {
    if (!userId || !name.trim()) return;
    setSubmitting(true);
    const payload = {
      building_id: buildingId,
      name: name.trim(),
      emoji: meta?.emoji ?? "✨",
      category,
      interest_tag: meta?.interestMatches[0] ?? null,
      circle_type: isManager ? circleType : "resident_created",
      visibility: visibilityLocked ? "public" : isPrivate ? "private" : "public",
      description: description.trim() || null,
      created_by: profileId,
      is_default: false,
      is_pinned: false,
    };
    const { data, error } = await supabase
      .from("groups")
      .insert(payload)
      .select("id, building_id, name, emoji, category, interest_tag, is_pinned, is_default, member_count, circle_type, visibility, description")
      .single();
    if (error || !data) {
      setSubmitting(false);
      toast.error(error?.message ?? "Could not create circle");
      return;
    }
    // Auto-join the creator.
    await supabase.from("group_members").insert({ group_id: data.id, user_id: userId });
    setSubmitting(false);
    setOpen(false);
    setName("");
    setDescription("");
    onCreated(data as GroupRow);
    toast.success(`${data.name} is live`);
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" /> Start a Circle
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <Sparkles className="h-4 w-4 text-accent" /> Start a Circle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="circle-name">Name</Label>
              <Input id="circle-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday Run Club" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="circle-desc">Description (optional)</Label>
              <Textarea id="circle-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CIRCLE_CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.emoji} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isManager && (
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={circleType} onValueChange={(v) => setCircleType(v as typeof circleType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="building_sponsored">Building Sponsored</SelectItem>
                      <SelectItem value="resident_created">Resident-Created</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">Private circle</div>
                <div className="text-xs text-muted-foreground">
                  {visibilityLocked
                    ? "Private circles are disabled for this building."
                    : "Only invited residents can see or join."}
                </div>
              </div>
              <Switch
                checked={!visibilityLocked && isPrivate}
                disabled={visibilityLocked}
                onCheckedChange={setIsPrivate}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Posting in <span className="font-medium text-foreground">{categoryLabel(category)}</span> · auto-approved
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting || !name.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create circle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
