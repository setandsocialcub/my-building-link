import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  HeartHandshake,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { badgeById } from "@/lib/network";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/manager/$buildingId/network-intelligence")({
  head: () => ({
    meta: [{ title: "Community Network Intelligence™ — Manager" }],
  }),
  component: NetworkIntelligencePage,
});

const WINDOWS = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
] as const;

type WindowId = (typeof WINDOWS)[number]["id"];

type Ranked = { label: string; count: number };

const STOPWORDS = new Set([
  "a", "an", "and", "or", "the", "of", "for", "to", "in", "on", "with",
  "any", "someone", "anyone", "please", "help",
]);

function normalize(q: string) {
  return q.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
}

function topN<T extends string>(map: Record<T, number>, n = 8): Ranked[] {
  return Object.entries(map)
    .map(([label, count]) => ({ label, count: count as number }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function NetworkIntelligencePage() {
  const { buildingId } = Route.useParams();
  const [win, setWin] = useState<WindowId>("30");
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    residents: 0,
    onNetwork: 0,
    introductions: 0,
    searches: 0,
  });
  const [professions, setProfessions] = useState<Ranked[]>([]);
  const [industries, setIndustries] = useState<Ranked[]>([]);
  const [categories, setCategories] = useState<Ranked[]>([]);
  const [services, setServices] = useState<Ranked[]>([]);
  const [interests, setInterests] = useState<Ranked[]>([]);
  const [goals, setGoals] = useState<Ranked[]>([]);
  const [badges, setBadges] = useState<Ranked[]>([]);
  const [searches, setSearches] = useState<Ranked[]>([]);
  const [searchCategories, setSearchCategories] = useState<Ranked[]>([]);
  const [activity, setActivity] = useState<{ day: string; count: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const days = WINDOWS.find((w) => w.id === win)!.days;
      const since = new Date(Date.now() - days * 86400_000).toISOString();

      const [residentsRes, netRes, introRes, searchesRes] = await Promise.all([
        supabase
          .from("resident_profiles")
          .select(
            "id, professional_title, industry, professional_category, services_offered, interest_tags, community_goals, expert_badges, network_visible",
          )
          .eq("building_id", buildingId),
        supabase
          .from("resident_profiles")
          .select("id", { count: "exact", head: true })
          .eq("building_id", buildingId)
          .eq("network_visible", true),
        supabase
          .from("resident_introductions")
          .select("id, message, created_at")
          .eq("building_id", buildingId)
          .gte("created_at", since)
          .order("created_at", { ascending: true }),
        supabase
          .from("network_search_events")
          .select("query, category, created_at")
          .eq("building_id", buildingId)
          .gte("created_at", since),
      ]);

      if (cancelled) return;

      const residents = residentsRes.data ?? [];

      // Professions / industries / categories from all residents (a
      // "community expertise map" — no PII is exposed in the aggregate).
      const professionMap: Record<string, number> = {};
      const industryMap: Record<string, number> = {};
      const categoryMap: Record<string, number> = {};
      const serviceMap: Record<string, number> = {};
      const interestMap: Record<string, number> = {};
      const goalMap: Record<string, number> = {};
      const badgeMap: Record<string, number> = {};

      for (const r of residents) {
        if (r.professional_title) {
          const key = r.professional_title.trim();
          if (key) professionMap[key] = (professionMap[key] ?? 0) + 1;
        }
        if (r.industry) industryMap[r.industry] = (industryMap[r.industry] ?? 0) + 1;
        if (r.professional_category)
          categoryMap[r.professional_category] = (categoryMap[r.professional_category] ?? 0) + 1;
        for (const s of r.services_offered ?? []) serviceMap[s] = (serviceMap[s] ?? 0) + 1;
        for (const s of r.interest_tags ?? []) interestMap[s] = (interestMap[s] ?? 0) + 1;
        for (const s of r.community_goals ?? []) goalMap[s] = (goalMap[s] ?? 0) + 1;
        for (const s of r.expert_badges ?? []) badgeMap[s] = (badgeMap[s] ?? 0) + 1;
      }

      // Networking activity — introductions triggered from Community Network
      // are prefixed by "[Community Network" in `message`.
      const intros = introRes.data ?? [];
      const networkIntros = intros.filter((i) =>
        (i.message ?? "").startsWith("[Community Network"),
      );

      // Activity by day
      const perDay = new Map<string, number>();
      for (let d = days - 1; d >= 0; d--) {
        const day = new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10);
        perDay.set(day, 0);
      }
      for (const i of networkIntros) {
        const day = (i.created_at as string).slice(0, 10);
        if (perDay.has(day)) perDay.set(day, (perDay.get(day) ?? 0) + 1);
      }

      // Searches
      const rawSearches = searchesRes.data ?? [];
      const searchTermMap: Record<string, number> = {};
      const searchCatMap: Record<string, number> = {};
      for (const s of rawSearches) {
        if (s.category) searchCatMap[s.category] = (searchCatMap[s.category] ?? 0) + 1;
        if (s.query) {
          for (const w of normalize(s.query)) {
            if (STOPWORDS.has(w) || w.length < 3) continue;
            searchTermMap[w] = (searchTermMap[w] ?? 0) + 1;
          }
        }
      }

      setTotals({
        residents: residents.length,
        onNetwork: netRes.count ?? 0,
        introductions: networkIntros.length,
        searches: rawSearches.length,
      });
      setProfessions(topN(professionMap));
      setIndustries(topN(industryMap));
      setCategories(topN(categoryMap));
      setServices(topN(serviceMap));
      setInterests(topN(interestMap));
      setGoals(topN(goalMap));
      setBadges(topN(badgeMap));
      setSearches(topN(searchTermMap, 10));
      setSearchCategories(topN(searchCatMap));
      setActivity(
        [...perDay.entries()].map(([day, count]) => ({ day, count })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, win]);

  const activityMax = useMemo(
    () => Math.max(1, ...activity.map((a) => a.count)),
    [activity],
  );
  const optInPct = totals.residents
    ? Math.round((totals.onNetwork / totals.residents) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="sticky top-0 z-20 border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/manager/$buildingId" params={{ buildingId }}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Manager
              </Link>
            </Button>
            <div className="hidden items-center gap-2 sm:flex">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Community Network Intelligence™</div>
                <div className="text-xs text-muted-foreground">
                  Anonymous trends across your community
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWin(w.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  win === w.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Residents on Network"
                value={totals.onNetwork}
                subtitle={`${optInPct}% of ${totals.residents} residents opted in`}
                icon={Users}
              />
              <Stat
                label="Introductions sent"
                value={totals.introductions}
                subtitle="Through Community Network"
                icon={HeartHandshake}
              />
              <Stat
                label="Searches"
                value={totals.searches}
                subtitle="Anonymous resident queries"
                icon={Search}
              />
              <Stat
                label="Community experts"
                value={badges.reduce((a, b) => a + b.count, 0)}
                subtitle="Neighborhood Expert™ badges"
                icon={Sparkles}
              />
            </div>

            <Section
              icon={TrendingUp}
              title="Networking activity"
              subtitle="Introductions triggered from Community Network"
            >
              {activity.length === 0 ? (
                <EmptyRow>No activity in this window yet.</EmptyRow>
              ) : (
                <div className="flex h-32 items-end gap-1">
                  {activity.map((a) => (
                    <div
                      key={a.day}
                      className="flex-1 rounded-t bg-primary/80 transition hover:bg-primary"
                      style={{ height: `${(a.count / activityMax) * 100}%` }}
                      title={`${a.day} — ${a.count}`}
                    />
                  ))}
                </div>
              )}
            </Section>

            <div className="grid gap-6 lg:grid-cols-2">
              <Section icon={Search} title="Most searched services" subtitle="Words residents look for">
                <RankList items={searches} emptyText="No searches yet — encourage residents to explore Community Network." />
              </Section>
              <Section icon={Briefcase} title="Community expertise map" subtitle="Professional categories represented">
                <RankList items={categories} />
              </Section>
              <Section icon={Users} title="Top professions" subtitle="Roles neighbors have shared">
                <RankList items={professions} />
              </Section>
              <Section icon={TrendingUp} title="Top industries">
                <RankList items={industries} />
              </Section>
              <Section icon={Sparkles} title="Most popular interests">
                <RankList items={interests} />
              </Section>
              <Section icon={HeartHandshake} title="What neighbors are open to" subtitle="Community goals">
                <RankList items={goals} />
              </Section>
              <Section
                icon={Sparkles}
                title="Neighborhood Experts™"
                subtitle="Distribution of expert badges"
              >
                {badges.length === 0 ? (
                  <EmptyRow>No badges claimed yet.</EmptyRow>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {badges.map((b) => {
                      const meta = badgeById(b.label);
                      return (
                        <Badge
                          key={b.label}
                          variant="secondary"
                          className="border border-border/50 bg-card px-3 py-1 text-sm text-foreground"
                        >
                          {meta ? `${meta.emoji} ${meta.label}` : b.label}
                          <span className="ml-1.5 text-muted-foreground">({b.count})</span>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </Section>
              <Section icon={Search} title="Searched categories" subtitle="Filters residents tap most">
                <RankList items={searchCategories} />
              </Section>
              <Section icon={Sparkles} title="Services offered" subtitle="What professionals are ready to help with">
                <RankList items={services} />
              </Section>
            </div>

            <p className="pt-2 text-center text-xs text-muted-foreground">
              All figures are aggregate. Individual residents are never identified in this view.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: typeof Users;
}) {
  return (
    <Card className="border-border bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="grid h-9 w-9 place-content-center rounded-lg bg-muted text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Users;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function RankList({ items, emptyText }: { items: Ranked[]; emptyText?: string }) {
  if (items.length === 0) {
    return <EmptyRow>{emptyText ?? "Not enough data yet."}</EmptyRow>;
  }
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-3">
          <span className="w-32 truncate text-sm text-foreground sm:w-40">{it.label}</span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary/80"
              style={{ width: `${Math.max(6, (it.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
            {it.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
