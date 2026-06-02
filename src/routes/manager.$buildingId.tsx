import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Shield,
  Flag,
  Loader2,
  Trash2,
  Check,
  Users,
  Search,
  UserMinus,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  X,
  HeartHandshake,
  TrendingUp,
  Copy,
  RefreshCw,
  Link2,
  FileDown,
  KeyRound,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const EVENT_EMOJIS = ["🏢", "🎉", "🍕", "☕", "🧘", "🎬", "🎲", "🌱"];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const wks = Math.floor(days / 7);
  if (wks < 5) return `${wks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function CommunityHealthSection({ buildingId }: { buildingId: string }) {
  const [stats, setStats] = useState({
    residents: 0,
    verifiedPct: 100,
    connections: 0,
    activeThisMonth: 0,
    upcomingEvents: 0,
  });
  const [topInterests, setTopInterests] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: residents } = await supabase
        .from("resident_profiles")
        .select("id, interest_tags, last_active_at")
        .eq("building_id", buildingId);

      const residentList = residents ?? [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const activeThisMonth = residentList.filter(
        (r) => r.last_active_at && new Date(r.last_active_at) >= thirtyDaysAgo
      ).length;

      const [{ count: connectionsCount }, { count: eventsCount }] = await Promise.all([
        supabase
          .from("connections")
          .select("*", { count: "exact", head: true })
          .eq("status", "accepted")
          .eq("building_id", buildingId),
        supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("building_id", buildingId)
          .gte("starts_at", new Date().toISOString()),
      ]);

      setStats({
        residents: residentList.length,
        verifiedPct: 100,
        connections: connectionsCount ?? 0,
        activeThisMonth,
        upcomingEvents: eventsCount ?? 0,
      });

      const tagCounts: Record<string, number> = {};
      residentList.forEach((r) => {
        (r.interest_tags ?? []).forEach((t: string) => {
          tagCounts[t] = (tagCounts[t] ?? 0) + 1;
        });
      });

      const sorted = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setTopInterests(sorted);
      setLoading(false);
    };

    load();
  }, [buildingId]);

  const statCards = [
    {
      label: "Residents",
      value: stats.residents,
      subtitle: `${stats.verifiedPct}% verified`,
      icon: Users,
      iconColor: "text-blue-500",
    },
    {
      label: "Connections Made",
      value: stats.connections,
      subtitle: "Accepted neighbor links",
      icon: HeartHandshake,
      iconColor: "text-rose-500",
    },
    {
      label: "Active This Month",
      value: stats.activeThisMonth,
      subtitle: "Residents engaged recently",
      icon: TrendingUp,
      iconColor: "text-emerald-500",
    },
    {
      label: "Upcoming Events",
      value: stats.upcomingEvents,
      subtitle: "Events on the calendar",
      icon: CalendarIcon,
      iconColor: "text-amber-500",
    },
  ];

  return (
    <div className="space-y-5 mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card
            key={card.label}
            className="bg-gradient-to-br from-amber-500/10 via-card to-card border-border shadow-sm"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                    {loading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      card.value
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.subtitle}</p>
                </div>
                <div
                  className={`h-9 w-9 rounded-lg bg-muted grid place-content-center ${card.iconColor}`}
                >
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {topInterests.length > 0 && (
        <div className="rounded-xl border border-border bg-gradient-to-br from-amber-500/5 to-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Top Interests
          </p>
          <div className="flex flex-wrap gap-2">
            {topInterests.map(({ tag, count }) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-card text-foreground border border-border/50 text-sm px-3 py-1"
              >
                {tag} <span className="ml-1 text-muted-foreground">({count})</span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/manager/$buildingId")({
  component: ManagerDashboard,
});


type Announcement = { id: string; body: string; created_at: string };
type FlaggedRow = {
  id: string;
  message_id: string;
  channel_id: string | null;
  status: string;
  created_at: string;
  message?: { id: string; body: string; sender_id: string; created_at: string } | null;
  channel?: { name: string } | null;
  sender_name?: string;
};

function ManagerDashboard() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const [building, setBuilding] = useState<{ name: string; city: string } | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/manager" });
        return;
      }
      const { data: mgr } = await supabase
        .from("property_managers")
        .select("id")
        .eq("user_id", user.id)
        .eq("building_id", buildingId)
        .maybeSingle();
      if (!mgr) {
        navigate({ to: "/manager" });
        return;
      }
      setManagerId(mgr.id);
      const { data: b } = await supabase
        .rpc("get_building_info", { _building_id: buildingId })
        .maybeSingle();
      if (b) setBuilding({ name: b.name, city: b.city });
    })();
  }, [buildingId, navigate]);

  if (!managerId) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/manager" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-content-center">
              <Shield className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{building?.name ?? "Building"}</div>
              <div className="text-xs text-muted-foreground">Property Manager</div>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/manager" });
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <CommunityHealthSection buildingId={buildingId} />
        <Tabs defaultValue="announcements">
          <TabsList>
            <TabsTrigger value="announcements">
              <Megaphone className="h-4 w-4" /> Announcements
            </TabsTrigger>
            <TabsTrigger value="flags">
              <Flag className="h-4 w-4" /> Flagged Content
            </TabsTrigger>
            <TabsTrigger value="directory">
              <Users className="h-4 w-4" /> Resident Directory
            </TabsTrigger>
            <TabsTrigger value="events">
              <CalendarIcon className="h-4 w-4" /> Events
            </TabsTrigger>
          </TabsList>
          <TabsContent value="announcements" className="mt-6">
            <AnnouncementsPanel buildingId={buildingId} managerId={managerId} />
          </TabsContent>
          <TabsContent value="flags" className="mt-6">
            <FlagsPanel buildingId={buildingId} />
          </TabsContent>
          <TabsContent value="directory" className="mt-6">
            <DirectoryPanel buildingId={buildingId} />
          </TabsContent>
          <TabsContent value="events" className="mt-6">
            <EventsPanel buildingId={buildingId} />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

function AnnouncementsPanel({
  buildingId,
  managerId,
}: {
  buildingId: string;
  managerId: string;
}) {
  const [list, setList] = useState<Announcement[]>([]);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, body, created_at")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false });
    setList(data ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    const { error } = await supabase.from("announcements").insert({
      building_id: buildingId,
      manager_id: managerId,
      body: trimmed,
    });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    toast.success("Announcement posted to all residents.");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    setList((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={post}
        className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm"
      >
        <label className="text-sm font-medium">New official announcement</label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g. Elevator maintenance tomorrow from 9am–12pm."
          maxLength={4000}
          rows={3}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={posting || !body.trim()}>
            {posting ? <Loader2 className="animate-spin" /> : <Megaphone />} Broadcast
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Posted
        </h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          list.map((a) => (
            <article
              key={a.id}
              className="rounded-xl border border-border bg-card p-4 flex items-start gap-3"
            >
              <div className="flex-1">
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function FlagsPanel({ buildingId }: { buildingId: string }) {
  const [rows, setRows] = useState<FlaggedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: flags } = await supabase
      .from("message_flags")
      .select("id, message_id, channel_id, status, created_at")
      .eq("building_id", buildingId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const flagRows = flags ?? [];
    const msgIds = [...new Set(flagRows.map((f) => f.message_id))];
    const chanIds = [...new Set(flagRows.map((f) => f.channel_id).filter((id): id is string => !!id))];

    const [{ data: msgs }, { data: chans }] = await Promise.all([
      msgIds.length
        ? supabase
            .from("channel_messages")
            .select("id, body, sender_id, created_at")
            .in("id", msgIds)
        : Promise.resolve({ data: [] as any[] }),
      chanIds.length
        ? supabase.from("channels").select("id, name").in("id", chanIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const senderIds = [...new Set((msgs ?? []).map((m: any) => m.sender_id))];
    const { data: senders } = senderIds.length
      ? await supabase
          .from("resident_public_profiles")
          .select("id, first_name")
          .in("id", senderIds)
      : { data: [] as any[] };

    const msgMap = new Map((msgs ?? []).map((m: any) => [m.id, m]));
    const chanMap = new Map((chans ?? []).map((c: any) => [c.id, c]));
    const senderMap = new Map((senders ?? []).map((s: any) => [s.id, s.first_name]));

    setRows(
      flagRows.map((f) => {
        const m = msgMap.get(f.message_id) ?? null;
        return {
          ...f,
          message: m,
          channel: chanMap.get(f.channel_id) ?? null,
          sender_name: m ? senderMap.get(m.sender_id) ?? "Resident" : "Resident",
        };
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    const sub = supabase
      .channel(`flags-${buildingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_flags",
          filter: `building_id=eq.${buildingId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const dismiss = async (flagId: string) => {
    await supabase
      .from("message_flags")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", flagId);
    setRows((prev) => prev.filter((r) => r.id !== flagId));
    toast.success("Flag dismissed.");
  };

  const removeMessage = async (row: FlaggedRow) => {
    // Delete the message — cascades flag rows.
    await supabase.from("channel_messages").delete().eq("id", row.message_id);
    // Mark any sibling flags as removed for the audit trail (best-effort; may have cascaded already)
    await supabase
      .from("message_flags")
      .update({ status: "removed", resolved_at: new Date().toISOString() })
      .eq("message_id", row.message_id);
    setRows((prev) => prev.filter((r) => r.message_id !== row.message_id));
    toast.success("Message removed.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <Flag className="h-8 w-8 mx-auto text-muted-foreground" />
        <h3 className="mt-3 font-semibold">Queue is clear</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Residents haven't flagged any messages. Nice and quiet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <article key={r.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" />
              {r.channel?.name ?? "group"}
            </Badge>
            <span>by {r.sender_name}</span>
            <span>· flagged {new Date(r.created_at).toLocaleString()}</span>
          </div>
          {r.message ? (
            <p className="text-sm bg-muted rounded-lg px-3 py-2">{r.message.body}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">Message no longer available.</p>
          )}
          <div className="mt-3 flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => dismiss(r.id)}>
              <Check className="h-4 w-4" /> Dismiss flag
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => removeMessage(r)}
              disabled={!r.message}
            >
              <Trash2 className="h-4 w-4" /> Delete message
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

type Resident = {
  id: string;
  first_name: string;
  job_title: string | null;
  interest_tags: string[];
  created_at: string;
  last_active_at: string | null;
};

function DirectoryPanel({ buildingId }: { buildingId: string }) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("resident_profiles")
      .select("id, first_name, job_title, interest_tags, created_at, last_active_at")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false });
    setResidents((data ?? []) as Resident[]);
    setLoading(false);
  };


  useEffect(() => {
    load();
    const sub = supabase
      .channel(`residents-${buildingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "resident_profiles",
          filter: `building_id=eq.${buildingId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const deactivate = async (r: Resident) => {
    const { error } = await supabase
      .from("resident_profiles")
      .delete()
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResidents((prev) => prev.filter((x) => x.id !== r.id));
    toast.success(`${r.first_name} removed from the directory.`);
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? residents.filter(
        (r) =>
          r.first_name.toLowerCase().includes(q) ||
          (r.job_title ?? "").toLowerCase().includes(q) ||
          r.interest_tags.some((t) => t.toLowerCase().includes(q)),
      )
    : residents;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Total Active Members
          </p>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-foreground">
            {residents.length}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Residents currently in your building community.
          </p>
        </div>
        <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary grid place-content-center">
          <Users className="h-7 w-7" />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, job title, or interest…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-semibold">
            {residents.length === 0 ? "No residents yet" : "No matches"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {residents.length === 0
              ? "Share your resident access code to start growing the community."
              : "Try a different search term."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-full bg-primary/10 text-primary grid place-content-center font-semibold">
                    {r.first_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold truncate">{r.first_name}</h4>
                    {r.job_title && (
                      <p className="text-xs text-muted-foreground truncate">
                        {r.job_title}
                      </p>
                    )}
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive gap-1.5 shrink-0"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Deactivate</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Deactivate {r.first_name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes them from the building directory and revokes
                        their access to community channels. They can rejoin later
                        with the building access code.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deactivate(r)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Deactivate member
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {r.interest_tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {r.interest_tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Last active {r.last_active_at ? relativeTime(r.last_active_at) : "—"}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Events Panel ============

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  capacity: number | null;
  cover_emoji: string;
  status: string;
  created_by: string | null;
};

type RsvpRow = {
  id: string;
  event_id: string;
  profile_id: string;
  status: string;
  resident_name?: string;
};

function EventsPanel({ buildingId }: { buildingId: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("18:00");
  const [capacity, setCapacity] = useState("");
  const [emoji, setEmoji] = useState("🏢");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: evs } = await supabase
      .from("events")
      .select("id, title, description, location, starts_at, capacity, cover_emoji, status, created_by")
      .eq("building_id", buildingId)
      .order("starts_at", { ascending: true });
    const evList = (evs ?? []) as EventRow[];
    setEvents(evList);

    if (evList.length) {
      const { data: rs } = await supabase
        .from("event_rsvps")
        .select("id, event_id, profile_id, status")
        .in("event_id", evList.map((e) => e.id));
      const rsList = (rs ?? []) as RsvpRow[];
      const profileIds = [...new Set(rsList.map((r) => r.profile_id))];
      const { data: profs } = profileIds.length
        ? await supabase
            .from("resident_profiles")
            .select("id, first_name")
            .in("id", profileIds)
        : { data: [] as any[] };
      const nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.first_name]));
      setRsvps(rsList.map((r) => ({ ...r, resident_name: nameMap.get(r.profile_id) ?? "Resident" })));
    } else {
      setRsvps([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      toast.error("Title and date are required.");
      return;
    }
    const [hh, mm] = time.split(":").map(Number);
    const startsAt = new Date(date);
    startsAt.setHours(hh ?? 18, mm ?? 0, 0, 0);
    setPosting(true);
    const { error } = await supabase.from("events").insert({
      building_id: buildingId,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      starts_at: startsAt.toISOString(),
      capacity: capacity ? Number(capacity) : null,
      cover_emoji: emoji,
      status: "published",
    });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setDescription("");
    setLocation("");
    setDate(undefined);
    setTime("18:00");
    setCapacity("");
    setEmoji("🏢");
    toast.success("Event published.");
    load();
  };

  const cancelEvent = async (ev: EventRow) => {
    const evRsvps = rsvps.filter((r) => r.event_id === ev.id);
    // Notify all RSVPed residents
    if (evRsvps.length) {
      await supabase.from("notifications").insert(
        evRsvps.map((r) => ({
          building_id: buildingId,
          recipient_id: r.profile_id,
          message: `Event cancelled: ${ev.title}`,
        })),
      );
    }
    const { error } = await supabase.from("events").delete().eq("id", ev.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event cancelled.");
    load();
  };

  const now = Date.now();
  const upcoming = useMemo(
    () => events.filter((e) => new Date(e.starts_at).getTime() >= now),
    [events, now],
  );
  const past = useMemo(
    () => events.filter((e) => new Date(e.starts_at).getTime() < now).reverse(),
    [events, now],
  );

  const rsvpsFor = (eventId: string) => rsvps.filter((r) => r.event_id === eventId);

  return (
    <div className="space-y-8">
      {/* Create form */}
      <form
        onSubmit={post}
        className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm"
      >
        <h3 className="text-sm font-semibold">Create event</h3>
        <Input
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        <Textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
        />
        <Input
          placeholder="Location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={200}
        />
        <div className="grid grid-cols-2 gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="h-4 w-4" />
                {date ? format(date, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            min={1}
            placeholder="Capacity (optional)"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5 items-center">
            {EVENT_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setEmoji(em)}
                className={cn(
                  "h-8 w-8 rounded-lg grid place-content-center text-lg transition",
                  emoji === em ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted",
                )}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={posting || !title.trim() || !date}>
            {posting ? <Loader2 className="animate-spin" /> : <CalendarIcon />} Publish event
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          {/* Upcoming */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Upcoming
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events.</p>
            ) : (
              upcoming.map((ev) => {
                const evRsvps = rsvpsFor(ev.id);
                const going = evRsvps.filter((r) => r.status === "going");
                const maybe = evRsvps.filter((r) => r.status === "maybe");
                const isExpanded = !!expanded[ev.id];
                return (
                  <article key={ev.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{ev.cover_emoji}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold">{ev.title}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(ev.starts_at), "PPP 'at' p")}
                          {ev.location && (
                            <>
                              <MapPin className="h-3 w-3 ml-2" />
                              {ev.location}
                            </>
                          )}
                        </p>
                        <p className="text-xs mt-2">
                          <span className="font-medium">{going.length} Going</span>
                          <span className="text-muted-foreground"> · {maybe.length} Maybe</span>
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpanded((p) => ({ ...p, [ev.id]: !p[ev.id] }))}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                              <X className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel {ev.title}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This deletes the event and notifies all {evRsvps.length} RSVPed residents.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep event</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => cancelEvent(ev)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Cancel event
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {evRsvps.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No RSVPs yet.</p>
                        ) : (
                          <>
                            <RsvpList label="Going" items={going} />
                            <RsvpList label="Maybe" items={maybe} />
                          </>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>

          {/* Past */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Past
            </h3>
            {past.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past events.</p>
            ) : (
              past.map((ev) => {
                const going = rsvpsFor(ev.id).filter((r) => r.status === "going");
                return (
                  <article key={ev.id} className="rounded-xl border border-border bg-card p-4 opacity-80">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl grayscale">{ev.cover_emoji}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold">{ev.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(ev.starts_at), "PPP 'at' p")}
                        </p>
                        <p className="text-xs mt-2 text-muted-foreground">
                          {going.length} attended (RSVPed Going)
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
}

function RsvpList({ label, items }: { label: string; items: RsvpRow[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label} ({items.length})</p>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {items.map((r) => (
          <Badge key={r.id} variant="secondary" className="text-xs">
            {r.resident_name}
          </Badge>
        ))}
      </div>
    </div>
  );
}

