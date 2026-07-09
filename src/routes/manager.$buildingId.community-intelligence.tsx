import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BarChart3, Clock, Loader2, Sparkles, TrendingUp, AlertTriangle, Smile, Frown, Meh, RefreshCw, Settings2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CATEGORIES, PRIORITIES, submissionTypeMeta, type Priority, type Status, type SubmissionType } from "@/lib/community-voice";
import { scoreCommunityVoiceSentiment } from "@/lib/api/community-voice-intelligence.functions";

export const Route = createFileRoute("/manager/$buildingId/community-intelligence")({
  head: () => ({ meta: [{ title: "Community Intelligence™ — Manager" }] }),
  component: CommunityIntelligence,
});

type Row = {
  id: string;
  submission_type: SubmissionType;
  category: string | null;
  priority: Priority;
  subject: string;
  status: Status;
  sentiment: "positive" | "neutral" | "negative" | null;
  first_viewed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  escalation_level: number;
};

type Config = {
  building_id: string;
  enabled: boolean;
  urgent_minutes: number;
  high_minutes: number;
  medium_minutes: number;
  low_minutes: number;
  max_escalations: number;
};

const WINDOWS = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
] as const;

function CommunityIntelligence() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowId, setWindowId] = useState<(typeof WINDOWS)[number]["id"]>("30");
  const [scoring, setScoring] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const scoreFn = useServerFn(scoreCommunityVoiceSentiment);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return navigate({ to: "/manager-auth" });
      const { data: mgr } = await supabase
        .from("property_managers").select("id")
        .eq("user_id", auth.user.id).eq("building_id", buildingId).maybeSingle();
      setAuthorized(!!mgr);
    })();
  }, [buildingId, navigate]);

  const load = async () => {
    setLoading(true);
    const days = WINDOWS.find((w) => w.id === windowId)!.days;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [subs, cfg] = await Promise.all([
      (supabase as any).from("community_voice_submissions")
        .select("id, submission_type, category, priority, subject, status, sentiment, first_viewed_at, resolved_at, created_at, escalation_level")
        .eq("building_id", buildingId)
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
      (supabase as any).from("community_voice_escalation_config")
        .select("*").eq("building_id", buildingId).maybeSingle(),
    ]);
    setRows((subs.data as Row[]) ?? []);
    setConfig((cfg.data as Config) ?? null);
    setLoading(false);
  };

  useEffect(() => { if (authorized) void load(); /* eslint-disable-next-line */ }, [authorized, buildingId, windowId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const open = rows.filter((r) => r.status !== "resolved" && r.status !== "closed").length;
    const resolved = rows.filter((r) => r.status === "resolved").length;
    const escalated = rows.filter((r) => r.escalation_level > 0).length;

    const viewedMins: number[] = [];
    const resolvedMins: number[] = [];
    rows.forEach((r) => {
      const created = new Date(r.created_at).getTime();
      if (r.first_viewed_at) viewedMins.push((new Date(r.first_viewed_at).getTime() - created) / 60000);
      if (r.resolved_at) resolvedMins.push((new Date(r.resolved_at).getTime() - created) / 60000);
    });
    const median = (arr: number[]) => {
      if (!arr.length) return null;
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    return { total, open, resolved, escalated, medianAckMin: median(viewedMins), medianResolveMin: median(resolvedMins) };
  }, [rows]);

  const trending = useMemo(() => {
    const types: Record<string, number> = {};
    const cats: Record<string, number> = {};
    rows.forEach((r) => {
      types[r.submission_type] = (types[r.submission_type] ?? 0) + 1;
      if (r.category) cats[r.category] = (cats[r.category] ?? 0) + 1;
    });
    const sortDesc = (o: Record<string, number>) =>
      Object.entries(o).map(([k, v]) => ({ key: k, count: v })).sort((a, b) => b.count - a.count);
    return { types: sortDesc(types).slice(0, 8), cats: sortDesc(cats).slice(0, 8) };
  }, [rows]);

  const recurring = useMemo(() => {
    // Group by category+type; flag groups with 3+ in window.
    const groups: Record<string, Row[]> = {};
    rows.forEach((r) => {
      if (!r.category) return;
      const k = `${r.category}::${r.submission_type}`;
      (groups[k] ??= []).push(r);
    });
    return Object.entries(groups)
      .filter(([, v]) => v.length >= 3)
      .map(([k, v]) => {
        const [category, type] = k.split("::");
        return { category, type: type as SubmissionType, count: v.length, samples: v.slice(0, 3) };
      })
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const sentimentBreakdown = useMemo(() => {
    const c = { positive: 0, neutral: 0, negative: 0, unscored: 0 };
    rows.forEach((r) => { if (r.sentiment) c[r.sentiment]++; else c.unscored++; });
    return c;
  }, [rows]);

  const runSentiment = async () => {
    setScoring(true);
    try {
      const res = await scoreFn({ data: { buildingId, limit: 25 } });
      toast.success(`Scored ${res.scored} conversation${res.scored === 1 ? "" : "s"}.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to score sentiment.");
    } finally {
      setScoring(false);
    }
  };

  if (authorized === null) {
    return <main className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></main>;
  }
  if (!authorized) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-md">
          <h1 className="font-semibold">Manager access required</h1>
          <Button asChild className="mt-4"><Link to="/manager">Enter manager code</Link></Button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/manager/$buildingId" params={{ buildingId }}><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
            </Button>
            <div className="leading-tight min-w-0">
              <div className="text-xs uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Community Intelligence™
              </div>
              <div className="text-sm font-semibold truncate">Trends, response times & sentiment</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {config && <EscalationConfigDialog config={config} onSaved={load} />}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap gap-2 items-center">
          {WINDOWS.map((w) => (
            <Button key={w.id} size="sm" variant={windowId === w.id ? "default" : "outline"} onClick={() => setWindowId(w.id)}>
              {w.label}
            </Button>
          ))}
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={runSentiment} disabled={scoring} className="gap-1.5">
            {scoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Score sentiment
          </Button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Metric label="Total" value={stats.total} icon={BarChart3} tone="text-primary" />
              <Metric label="Open" value={stats.open} icon={TrendingUp} tone="text-blue-500" />
              <Metric label="Resolved" value={stats.resolved} icon={TrendingUp} tone="text-emerald-500" />
              <Metric label="Escalated" value={stats.escalated} icon={AlertTriangle} tone="text-red-500" />
              <Metric label="Median ack" value={fmtMin(stats.medianAckMin)} icon={Clock} tone="text-amber-500" />
              <Metric label="Median resolve" value={fmtMin(stats.medianResolveMin)} icon={Clock} tone="text-emerald-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Trending topics" subtitle="What residents are raising most">
                <BarList
                  items={trending.types.map((t) => ({
                    key: t.key,
                    label: submissionTypeMeta(t.key as SubmissionType).emoji + " " + submissionTypeMeta(t.key as SubmissionType).label,
                    count: t.count,
                  }))}
                />
              </Panel>
              <Panel title="Top categories" subtitle="Where feedback clusters">
                <BarList items={trending.cats.map((c) => ({ key: c.key, label: c.key, count: c.count }))} />
              </Panel>
            </div>

            <Panel title="Recurring issues" subtitle="Same category + type reported 3+ times in this window">
              {recurring.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No recurring patterns detected. 🎉</p>
              ) : (
                <ul className="space-y-3">
                  {recurring.map((g) => {
                    const meta = submissionTypeMeta(g.type);
                    return (
                      <li key={`${g.category}-${g.type}`} className="rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">{meta.emoji}</span>
                          <span className="font-medium text-sm">{g.category}</span>
                          <span className="text-xs text-muted-foreground">· {meta.label}</span>
                          <Badge className="ml-auto bg-red-500/10 text-red-700 dark:text-red-300 border-0">
                            {g.count} reports
                          </Badge>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {g.samples.map((s) => (
                            <li key={s.id} className="text-xs text-muted-foreground truncate">
                              · {s.subject} — {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Sentiment" subtitle="AI-scored tone across conversations">
              <div className="grid grid-cols-4 gap-3">
                <SentimentTile icon={Smile} label="Positive" count={sentimentBreakdown.positive} tone="text-emerald-500" />
                <SentimentTile icon={Meh} label="Neutral" count={sentimentBreakdown.neutral} tone="text-muted-foreground" />
                <SentimentTile icon={Frown} label="Negative" count={sentimentBreakdown.negative} tone="text-red-500" />
                <SentimentTile icon={Sparkles} label="Unscored" count={sentimentBreakdown.unscored} tone="text-amber-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Click "Score sentiment" above to analyze up to 25 unscored conversations at a time.
              </p>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

function fmtMin(m: number | null): string {
  if (m == null) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone: string }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", tone)} />
        <span className="text-lg font-semibold tabular-nums">{value}</span>
      </div>
    </CardContent></Card>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3">
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function BarList({ items }: { items: { key: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (!items.length) return <p className="text-sm text-muted-foreground py-4">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.key}>
          <div className="flex justify-between text-xs mb-1">
            <span className="truncate pr-2">{i.label}</span>
            <span className="tabular-nums text-muted-foreground">{i.count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SentimentTile({ icon: Icon, label, count, tone }: { icon: any; label: string; count: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <Icon className={cn("h-5 w-5 mx-auto", tone)} />
      <div className="mt-1 text-lg font-semibold tabular-nums">{count}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function EscalationConfigDialog({ config, onSaved }: { config: Config; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Config>(config);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(config), [config]);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("community_voice_escalation_config")
      .update({
        enabled: draft.enabled,
        urgent_minutes: draft.urgent_minutes,
        high_minutes: draft.high_minutes,
        medium_minutes: draft.medium_minutes,
        low_minutes: draft.low_minutes,
        max_escalations: draft.max_escalations,
      })
      .eq("building_id", config.building_id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Escalation rules saved.");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Escalation rules</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalation rules</DialogTitle>
          <DialogDescription>
            Conversations that haven't been acknowledged within the time window are automatically escalated and re-notified to managers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label>Automatic escalation</Label>
              <p className="text-xs text-muted-foreground">Runs every 5 minutes.</p>
            </div>
            <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
          </div>
          {(["urgent", "high", "medium", "low"] as const).map((p) => {
            const key = `${p}_minutes` as keyof Config;
            const label = PRIORITIES.find((x) => x.id === p)!.label;
            return (
              <div key={p} className="flex items-center justify-between gap-3">
                <Label className="text-sm">{label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={1} className="w-24 h-8"
                    value={draft[key] as number}
                    onChange={(e) => setDraft({ ...draft, [key]: Math.max(1, parseInt(e.target.value) || 1) } as Config)}
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm">Max escalations per conversation</Label>
            <Input type="number" min={1} max={10} className="w-24 h-8"
              value={draft.max_escalations}
              onChange={(e) => setDraft({ ...draft, max_escalations: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}Save rules</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
