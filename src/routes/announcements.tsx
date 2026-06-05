import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/announcements")({
  component: AnnouncementsPage,
});

type Row = {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
};

function AnnouncementsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const userIdRef = useRef<string | null>(null);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }
      userIdRef.current = auth.user.id;

      const { data: profiles } = await supabase
        .from("resident_profiles")
        .select("building_id")
        .eq("user_id", auth.user.id)
        .limit(1);
      if (!profiles || profiles.length === 0) {
        toast.error("Join a building first.");
        navigate({ to: "/resident-access" });
        return;
      }
      const buildingId = profiles[0].building_id as string;

      const [{ data: anns, error: aErr }, { data: reads }] = await Promise.all([
        supabase
          .from("announcements")
          .select("id, title, body, created_at")
          .eq("building_id", buildingId)
          .order("created_at", { ascending: false }),
        supabase
          .from("announcement_reads")
          .select("announcement_id")
          .eq("user_id", auth.user.id),
      ]);

      if (cancelled) return;
      if (aErr) toast.error(aErr.message);

      setRows((anns ?? []) as Row[]);
      setReadIds(new Set((reads ?? []).map((r) => r.announcement_id as string)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const markRead = (id: string) => {
    const uid = userIdRef.current;
    if (!uid || readIds.has(id) || pendingRef.current.has(id)) return;
    pendingRef.current.add(id);
    supabase
      .from("announcement_reads")
      .insert({ announcement_id: id, user_id: uid })
      .then(({ error }) => {
        pendingRef.current.delete(id);
        if (!error) setReadIds((prev) => new Set(prev).add(id));
      });
  };

  useEffect(() => {
    if (loading || rows.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const id = (e.target as HTMLElement).dataset.id;
            if (id) markRead(id);
          }
        });
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll<HTMLElement>("[data-announcement]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rows]);

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
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <div className="grid h-10 w-10 place-content-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1
              className="text-3xl text-foreground"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Announcements
            </h1>
            <p className="text-sm text-muted-foreground">From building management</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No announcements yet. Check back soon.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {rows.map((a) => {
              const unread = !readIds.has(a.id);
              return (
                <li
                  key={a.id}
                  data-announcement
                  data-id={a.id}
                  className="relative rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  {unread && (
                    <span
                      aria-label="Unread"
                      className="absolute left-0 top-6 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background"
                    />
                  )}
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-content-center rounded-xl bg-secondary text-lg">
                      🏠
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Building Management
                      </p>
                      {a.title && (
                        <h2 className="mt-0.5 text-lg font-semibold text-foreground">
                          {a.title}
                        </h2>
                      )}
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                        {a.body}
                      </p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {format(new Date(a.created_at), "EEEE, MMMM d")}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
