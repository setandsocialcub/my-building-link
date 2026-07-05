import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

import { loadBuildingPulse, type BuildingPulse } from "@/lib/pulse-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/buildings/$buildingId/pulse")({
  head: () => ({ meta: [{ title: "Community Pulse — Building Admin" }] }),
  component: PulseEmbedPage,
});

function PulseEmbedPage() {
  const { buildingId } = Route.useParams();
  const [pulse, setPulse] = useState<BuildingPulse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const p = await loadBuildingPulse(buildingId);
      if (!cancelled) {
        setPulse(p);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  if (loading || !pulse) {
    return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const s = pulse.summary;

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Community Pulse</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Community health at a glance</h1>
          <p className="text-sm text-muted-foreground mt-1">Privacy-safe activity, aggregated.</p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/pulse/$buildingId" params={{ buildingId }}>Open full Pulse <ExternalLink className="h-3.5 w-3.5" /></Link>
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Active residents (30d)" value={`${s.activeResidents} / ${s.totalResidents}`} />
        <Metric label="Introductions (30d)" value={String(s.newIntroductions)} />
        <Metric label="Accept rate" value={`${Math.round(s.introAcceptRate * 100)}%`} />
        <Metric label="Circle participation" value={`${Math.round(s.circleParticipationRate * 100)}%`} />
        <Metric label="Event attendees" value={String(s.experienceAttendees)} />
        <Metric label="Onboarded" value={`${Math.round(s.onboardingCompletionRate * 100)}%`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Engagement trend (30d)</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pulse.engagementTrend}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#pg)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
