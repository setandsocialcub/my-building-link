import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Users, Sparkles, CalendarDays, Activity, HeartHandshake, BookOpen, TrendingUp, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { loadBuildingPulse, type BuildingPulse } from "@/lib/pulse-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/admin/buildings/$buildingId/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Building Admin" }] }),
  component: AnalyticsPage,
});

type Extras = {
  eventsTotal: number;
  eventsUpcoming: number;
  circleActivity: number;
  playbookCompletion: number;
  belonging: number;
  health: number;
};

function AnalyticsPage() {
  const { buildingId } = Route.useParams();
  const [pulse, setPulse] = useState<BuildingPulse | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const p = await loadBuildingPulse(buildingId);

      const [{ data: events }, { count: messageCount }, { data: playbook }] = await Promise.all([
        (supabase as any)
          .from("events")
          .select("id, starts_at, status")
          .eq("building_id", buildingId),
        (supabase as any)
          .from("channel_messages")
          .select("id, channels!inner(building_id)", { count: "exact", head: true })
          .eq("channels.building_id", buildingId)
          .gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
        (supabase as any)
          .from("building_playbook_items")
          .select("completed_at")
          .eq("building_id", buildingId),
      ]);
      if (cancelled) return;

      const evRows = (events as { starts_at: string; status: string }[]) ?? [];
      const now = Date.now();
      const eventsTotal = evRows.length;
      const eventsUpcoming = evRows.filter((e) => new Date(e.starts_at).getTime() > now && e.status !== "cancelled").length;
      const circleActivity = messageCount ?? 0;

      const pbRows = (playbook as { completed_at: string | null }[]) ?? [];
      const playbookCompletion = pbRows.length > 0 ? pbRows.filter((r) => r.completed_at).length / pbRows.length : 0;

      // Belonging Score™: 0-100 weighted composite
      // 40% intro accept rate · 30% circle participation · 30% onboarding completion
      const belonging = Math.round(
        (p.summary.introAcceptRate * 40 +
          p.summary.circleParticipationRate * 30 +
          p.summary.onboardingCompletionRate * 30) *
          1,
      );

      // Community Health™: 0-100 rollup
      // 40% belonging · 30% 30d active-resident share · 30% playbook completion
      const activeShare = p.summary.totalResidents > 0 ? p.summary.activeResidents / p.summary.totalResidents : 0;
      const health = Math.round(belonging * 0.4 + activeShare * 100 * 0.3 + playbookCompletion * 100 * 0.3);

      setPulse(p);
      setExtras({ eventsTotal, eventsUpcoming, circleActivity, playbookCompletion, belonging, health });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  if (loading || !pulse || !extras) {
    return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const s = pulse.summary;

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Analytics</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Building analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Aggregate metrics, engagement, and proprietary community scores.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Users} label="Residents" value={String(s.totalResidents)} sub={`${s.activeResidents} active (30d)`} />
        <Stat icon={CalendarDays} label="Events" value={String(extras.eventsTotal)} sub={`${extras.eventsUpcoming} upcoming`} />
        <Stat icon={Sparkles} label="Circle activity" value={String(extras.circleActivity)} sub="messages (30d)" />
        <Stat icon={BookOpen} label="Playbook" value={`${Math.round(extras.playbookCompletion * 100)}%`} sub="complete" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-primary" /> Belonging Score™
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold tabular-nums">{extras.belonging}</div>
            <Progress value={extras.belonging} className="mt-3 h-2" />
            <p className="text-xs text-muted-foreground mt-3">
              Composite of introduction acceptance, circle participation, and onboarding completion.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Community Health™
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold tabular-nums">{extras.health}</div>
            <Progress value={extras.health} className="mt-3 h-2" />
            <p className="text-xs text-muted-foreground mt-3">
              Rollup of Belonging Score, 30-day engagement share, and Playbook completion.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Engagement</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Line label="Introduction accept rate" value={s.introAcceptRate * 100} />
            <Line label="Circle participation" value={s.circleParticipationRate * 100} />
            <Line label="Onboarding completion" value={s.onboardingCompletionRate * 100} />
            <Line label="Active resident share" value={s.totalResidents ? (s.activeResidents / s.totalResidents) * 100 : 0} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4" /> Community Pulse</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="New introductions (30d)" value={s.newIntroductions} />
            <Row label="Accepted introductions" value={s.acceptedIntroductions} />
            <Row label="Circle participants" value={s.circleParticipants} />
            <Row label="Event attendees (30d + upcoming)" value={s.experienceAttendees} />
            <Row label="Onboarded residents" value={s.onboardingCompleted} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{Math.round(v)}%</span>
      </div>
      <Progress value={v} className="h-1.5" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border-b border-border last:border-0 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
