import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Heart, Loader2, Send, Sparkles, Star, Trophy } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/manager/$buildingId/recognition")({
  head: () => ({ meta: [{ title: "Staff Recognition — Manager" }] }),
  component: RecognitionDashboard,
});

type Row = {
  id: string;
  subject: string;
  description: string;
  recognized_staff_name: string | null;
  is_anonymous: boolean;
  created_at: string;
  status: string;
};

const WINDOWS = [
  { id: "7", label: "7 days", days: 7 },
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "all", label: "All time", days: 100000 },
] as const;

function RecognitionDashboard() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowId, setWindowId] = useState<(typeof WINDOWS)[number]["id"]>("30");
  const [selected, setSelected] = useState<Row | null>(null);
  const [reply, setReply] = useState("");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return navigate({ to: "/manager-auth" });
      setUserId(auth.user.id);
      const { data: mgr } = await supabase.from("property_managers").select("id")
        .eq("user_id", auth.user.id).eq("building_id", buildingId).maybeSingle();
      setAuthorized(!!mgr);
    })();
  }, [buildingId, navigate]);

  const load = async () => {
    setLoading(true);
    const w = WINDOWS.find((x) => x.id === windowId)!;
    const since = new Date(Date.now() - w.days * 86400000).toISOString();
    const { data } = await (supabase as any)
      .from("community_voice_submissions")
      .select("id, subject, description, recognized_staff_name, is_anonymous, created_at, status")
      .eq("building_id", buildingId)
      .eq("submission_type", "recognition")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (authorized) void load(); /* eslint-disable-next-line */ }, [authorized, buildingId, windowId]);

  const staffLeaderboard = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const name = r.recognized_staff_name?.trim() || "Team (unnamed)";
      counts[name] = (counts[name] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);
  }, [rows]);

  const sendThanks = async () => {
    if (!selected || !userId || !reply.trim()) return;
    const { error } = await (supabase as any).from("community_voice_updates").insert({
      submission_id: selected.id,
      author_id: userId,
      author_role: "manager",
      body: reply.trim(),
      visible_to_resident: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Thanks sent to the resident.");
    setReply("");
    setSelected(null);
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
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/manager/$buildingId" params={{ buildingId }}><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          </Button>
          <div className="leading-tight min-w-0">
            <div className="text-xs uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Staff Recognition
            </div>
            <div className="text-sm font-semibold truncate">Kudos from your residents</div>
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
          <Card className="bg-gradient-to-br from-amber-500/10 via-card to-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold">Recognition leaderboard</h2>
              </div>
              {loading ? (
                <div className="py-10 grid place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : staffLeaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No recognitions yet. Encourage residents to celebrate your team!</p>
              ) : (
                <ol className="space-y-2">
                  {staffLeaderboard.map((s, i) => (
                    <li key={s.name} className="flex items-center gap-3 rounded-lg bg-card border border-border p-2.5">
                      <div className={cn(
                        "h-7 w-7 rounded-full grid place-content-center text-xs font-semibold",
                        i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-orange-700 text-white" : "bg-muted text-muted-foreground",
                      )}>{i + 1}</div>
                      <div className="flex-1 truncate text-sm font-medium">{s.name}</div>
                      <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                        <Star className="h-3.5 w-3.5 fill-current" /> {s.count}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500" />
              <h2 className="text-sm font-semibold">Recent recognitions</h2>
              <span className="text-xs text-muted-foreground ml-auto">{rows.length} total</span>
            </div>
            {loading ? (
              <div className="py-14 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <p className="py-14 text-center text-sm text-muted-foreground">No recognitions in this window.</p>
            ) : (
              <ul className="divide-y divide-border max-h-[70vh] overflow-auto">
                {rows.map((r) => (
                  <li key={r.id} className="p-4 hover:bg-muted/40">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-full bg-amber-500/15 grid place-content-center flex-shrink-0">
                        <Star className="h-4 w-4 text-amber-500 fill-current" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">
                            {r.recognized_staff_name?.trim() || "Team member"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </span>
                          {r.is_anonymous && <span className="text-xs text-muted-foreground">· from Anonymous</span>}
                        </div>
                        <div className="mt-1 text-sm font-medium">{r.subject}</div>
                        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{r.description}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 gap-1.5"
                            onClick={() => { setSelected(r); setReply(`Thank you for recognizing ${r.recognized_staff_name?.trim() || "our team"} — this made our day!`); }}>
                            <Send className="h-3 w-3" /> Send thanks
                          </Button>
                          <Button asChild size="sm" variant="ghost" className="h-7">
                            <Link to="/manager/$buildingId/community-voice" params={{ buildingId }}>Open conversation</Link>
                          </Button>
                        </div>

                        {selected?.id === r.id && (
                          <div className="mt-3 space-y-2">
                            <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Send a warm thank-you back to the resident…" />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
                              <Button size="sm" onClick={sendThanks} className="gap-1.5"><Send className="h-3 w-3" /> Send</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
