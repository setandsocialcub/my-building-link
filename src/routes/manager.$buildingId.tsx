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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

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
      label: "Introductions Made",
      value: stats.connections,
      subtitle: "Accepted neighbor introductions",
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
      label: "Upcoming Experiences",
      value: stats.upcomingEvents,
      subtitle: "On the residence calendar",
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


type Announcement = { id: string; title: string | null; body: string; created_at: string };
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
  const [building, setBuilding] = useState<{ name: string; city: string; access_code: string } | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      setLoadError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        navigate({ to: "/manager-auth" });
        return;
      }
      const { data: mgr, error: mgrErr } = await supabase
        .from("property_managers")
        .select("id")
        .eq("user_id", user.id)
        .eq("building_id", buildingId)
        .maybeSingle();
      if (cancelled) return;
      if (mgrErr) {
        setLoadError(mgrErr.message);
        setStatus("ready");
        return;
      }
      if (!mgr) {
        setLoadError(
          "You're signed in, but you don't have manager access for this building yet. Enter a manager code below.",
        );
        setStatus("ready");
        return;
      }
      setManagerId(mgr.id);
      const { data: b } = await supabase
        .from("buildings")
        .select("name, city, access_code")
        .eq("id", buildingId)
        .maybeSingle();
      if (cancelled) return;
      if (b) setBuilding({ name: b.name, city: b.city, access_code: b.access_code });
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, navigate]);

  if (status === "loading") {
    return (
      <main className="min-h-screen grid place-items-center text-muted-foreground">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading manager dashboard…
        </div>
      </main>
    );
  }

  if (loadError || !managerId) {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-6">
        <div className="max-w-md w-full text-center space-y-5 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-content-center">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Manager access required</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {loadError ?? "You don't have manager access for this building."}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate({ to: "/manager" })} className="w-full">
              Enter manager code
            </Button>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/manager-auth" });
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

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
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/pulse/$buildingId" params={{ buildingId }}>
                <TrendingUp className="h-3.5 w-3.5" /> Pulse
              </Link>
            </Button>
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
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <CommunityHealthSection buildingId={buildingId} />
        {building && (
          <InviteCodeCard
            buildingId={buildingId}
            buildingName={building.name}
            code={building.access_code}
            onCodeChange={(c) => setBuilding((prev) => (prev ? { ...prev, access_code: c } : prev))}
          />
        )}
        <Tabs defaultValue="announcements">

          <TabsList>
            <TabsTrigger value="announcements">
              <Megaphone className="h-4 w-4" /> Community Updates
            </TabsTrigger>
            <TabsTrigger value="flags">
              <Flag className="h-4 w-4" /> Flagged Content
            </TabsTrigger>
            <TabsTrigger value="directory">
              <Users className="h-4 w-4" /> Resident Directory
            </TabsTrigger>
            <TabsTrigger value="events">
              <CalendarIcon className="h-4 w-4" /> Experiences
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

function InviteCodeCard({
  buildingId,
  buildingName,
  code,
  onCodeChange,
}: {
  buildingId: string;
  buildingName: string;
  code: string;
  onCodeChange: (code: string) => void;
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${encodeURIComponent(code)}`
      : `/join?code=${encodeURIComponent(code)}`;

  const copy = async (text: string, setFlag: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 1800);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    const { data, error } = await supabase.rpc("regenerate_building_access_code", {
      _building_id: buildingId,
    });
    setRegenerating(false);
    setConfirmOpen(false);
    if (error || !data) {
      toast.error(error?.message ?? "Couldn't regenerate code");
      return;
    }
    onCodeChange(data as string);
    toast.success("New code generated");
  };

  const downloadFlyer = () => {
    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>${buildingName} — Invite</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:48px;color:#111}
  .wrap{max-width:560px;margin:0 auto;text-align:center;border:1px solid #e5e7eb;border-radius:24px;padding:56px 40px}
  h1{font-size:22px;margin:0 0 8px;font-weight:600}
  .sub{color:#6b7280;margin-bottom:40px}
  .code{font-family:'SF Mono',Menlo,monospace;font-size:72px;letter-spacing:.08em;font-weight:700;padding:32px 0;border-top:1px dashed #d1d5db;border-bottom:1px dashed #d1d5db;margin:24px 0}
  .instr{margin:32px 0;font-size:16px;line-height:1.5}
  .qr{margin-top:32px;padding:24px;border:2px dashed #d1d5db;border-radius:12px;font-family:monospace;font-size:13px;word-break:break-all;color:#374151}
  .qrlabel{font-size:12px;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:.1em}
  @media print{body{padding:0}.wrap{border:none}}
</style></head>
<body><div class="wrap">
  <h1>${buildingName}</h1>
  <div class="sub">Join your building community</div>
  <div class="code">${code}</div>
  <div class="instr">Download the app and enter this code to join your building community.</div>
  <div class="qr"><div class="qrlabel">Or scan / visit</div>${joinUrl}</div>
</div><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${buildingName.replace(/[^a-z0-9]+/gi, "-")}-invite-${code}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="mb-6 bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
          <KeyRound className="h-3.5 w-3.5" />
          Resident Invite Code
        </div>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="font-mono text-5xl md:text-6xl font-bold tracking-[0.15em] text-foreground select-all">
            {code}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => copy(code, setCopiedCode)}
            >
              {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedCode ? "Copied!" : "Copy Code"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={regenerating}
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate
            </Button>
          </div>
        </div>

        <div className="h-px bg-border my-5" />

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => copy(joinUrl, setCopiedLink)}>
            {copiedLink ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copiedLink ? "Link copied!" : "Copy invite link"}
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadFlyer}>
            <FileDown className="h-4 w-4" />
            Download PDF flyer
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate code?</AlertDialogTitle>
            <AlertDialogDescription>
              The old code will stop working immediately. Residents who haven't
              signed up yet will need the new code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={regenerate} disabled={regenerating}>
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
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
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState(false);
  const [residentCount, setResidentCount] = useState(0);
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});

  const load = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, created_at")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Announcement[];
    setList(rows);

    const { count } = await supabase
      .from("resident_profiles")
      .select("*", { count: "exact", head: true })
      .eq("building_id", buildingId);
    setResidentCount(count ?? 0);

    if (rows.length > 0) {
      const { data: reads } = await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .in("announcement_id", rows.map((r) => r.id));
      const counts: Record<string, number> = {};
      (reads ?? []).forEach((r) => {
        const id = r.announcement_id as string;
        counts[id] = (counts[id] ?? 0) + 1;
      });
      setReadCounts(counts);
    } else {
      setReadCounts({});
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBody = body.trim();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !trimmedBody) return;
    setPosting(true);
    const { error } = await supabase.from("announcements").insert({
      building_id: buildingId,
      manager_id: managerId,
      title: trimmedTitle,
      body: trimmedBody,
    });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setBody("");
    setOpen(false);
    toast.success("Announcement posted — residents notified.");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    setList((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Past announcements
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New announcement</DialogTitle>
              <DialogDescription>
                Posts to all residents and sends a push notification.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={post} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Elevator maintenance Friday"
                  maxLength={120}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Body</label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Share the details residents need to know."
                  maxLength={4000}
                  rows={5}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={posting || !title.trim() || !body.trim()}>
                  {posting ? <Loader2 className="animate-spin" /> : <Megaphone />} Post
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          list.map((a) => {
            const seen = readCounts[a.id] ?? 0;
            return (
              <article
                key={a.id}
                className="rounded-xl border border-border bg-card p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  {a.title && <h4 className="text-sm font-semibold">{a.title}</h4>}
                  <p className="text-sm whitespace-pre-wrap mt-1">{a.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span>
                      Seen by {seen} of {residentCount} resident
                      {residentCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </article>
            );
          })
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

