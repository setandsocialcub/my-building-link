import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Users,
  HeartHandshake,
  Sparkles,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Loader2,
  Activity,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadBuildingPulse, type BuildingPulse } from "@/lib/pulse-analytics";

export const Route = createFileRoute("/pulse/$buildingId")({
  head: () => ({
    meta: [
      { title: "Community Pulse — Analytics" },
      {
        name: "description",
        content:
          "Privacy-safe community analytics for property managers: engagement, introductions, and circle participation.",
      },
    ],
  }),
  component: PulsePage,
});

type AuthState = "loading" | "denied" | "ok";

function PulsePage() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [buildingName, setBuildingName] = useState<string>("");
  const [pulse, setPulse] = useState<BuildingPulse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        navigate({ to: "/manager-auth" });
        return;
      }
      const [{ data: mgr }, { data: roleRow }] = await Promise.all([
        supabase
          .from("property_managers")
          .select("building_id")
          .eq("user_id", uid)
          .eq("building_id", buildingId)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .eq("role", "admin")
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (!mgr && !roleRow) {
        setAuthState("denied");
        return;
      }
      setAuthState("ok");
      const { data: b } = await supabase
        .from("buildings")
        .select("name")
        .eq("id", buildingId)
        .maybeSingle();
      if (b?.name) setBuildingName(b.name);
      try {
        const p = await loadBuildingPulse(buildingId);
        if (!cancelled) setPulse(p);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [buildingId, navigate]);

  if (authState === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (authState === "denied") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="font-serif text-3xl">Access restricted</h1>
        <p className="text-muted-foreground max-w-md">
          Community Pulse is available to property managers and super admins for this building only.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Return home</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 gap-1.5">
              <Link to="/manager/$buildingId" params={{ buildingId }}>
                <ArrowLeft className="h-4 w-4" /> Back to Manager
              </Link>
            </Button>
            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">Community Pulse</h1>
            <p className="text-muted-foreground mt-2">
              {buildingName ? `${buildingName} · ` : ""}Privacy-safe insights from the last 30 days.
            </p>
          </div>
          {pulse && (
            <Badge variant="outline" className="self-start sm:self-end gap-1.5 px-3 py-1.5">
              <Activity className="h-3.5 w-3.5" />
              Updated {new Date(pulse.generatedAt).toLocaleString()}
            </Badge>
          )}
        </header>

        {loading || !pulse ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <PulseDashboard pulse={pulse} />
        )}
      </div>
    </main>
  );
}

function PulseDashboard({ pulse }: { pulse: BuildingPulse }) {
  const s = pulse.summary;
  const introData = useMemo(
    () => pulse.introTrend.map((p) => ({ ...p, label: p.date.slice(5) })),
    [pulse.introTrend],
  );
  const engagementData = useMemo(
    () => pulse.engagementTrend.map((p) => ({ ...p, label: p.date.slice(5) })),
    [pulse.engagementTrend],
  );

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={Users}
          label="Active Residents"
          value={s.activeResidents}
          sub={`${s.totalResidents} total · last 30d`}
        />
        <SummaryCard
          icon={HeartHandshake}
          label="New Introductions"
          value={s.newIntroductions}
          sub={`${s.acceptedIntroductions} accepted`}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Acceptance Rate"
          value={`${Math.round(s.introAcceptRate * 100)}%`}
          sub="of decided introductions"
        />
        <SummaryCard
          icon={Sparkles}
          label="Circle Participation"
          value={`${Math.round(s.circleParticipationRate * 100)}%`}
          sub={`${s.circleParticipants} residents in a circle`}
        />
        <SummaryCard
          icon={Calendar}
          label="Experience Attendance"
          value={s.experienceAttendees}
          sub="distinct RSVPs (30d)"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Onboarding Complete"
          value={`${Math.round(s.onboardingCompletionRate * 100)}%`}
          sub={`${s.onboardingCompleted} of ${s.totalResidents}`}
        />
      </section>

      {/* Trend charts */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Resident Engagement</CardTitle>
            <p className="text-sm text-muted-foreground">Active residents per day</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={engagementData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#engGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Introductions Trend</CardTitle>
            <p className="text-sm text-muted-foreground">New introduction requests per day</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={introData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Lists */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Most Popular Interests</CardTitle>
            <p className="text-sm text-muted-foreground">
              Aggregated tags (groups smaller than 3 hidden for privacy)
            </p>
          </CardHeader>
          <CardContent>
            {pulse.topInterests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Not enough data yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {pulse.topInterests.map((i) => {
                  const max = pulse.topInterests[0]?.count || 1;
                  const pct = Math.max(8, Math.round((i.count / max) * 100));
                  return (
                    <li key={i.tag} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize">{i.tag}</span>
                        <span className="text-muted-foreground">{i.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Most Active Circles</CardTitle>
            <p className="text-sm text-muted-foreground">By member count</p>
          </CardHeader>
          <CardContent>
            {pulse.topCircles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No circles yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {pulse.topCircles.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2">
                      <span className="text-lg">{c.emoji ?? "✨"}</span>
                      <span className="font-medium">{c.name}</span>
                    </span>
                    <Badge variant="secondary">{c.members} members</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="font-serif text-3xl">{value}</div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
