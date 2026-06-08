import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  X,
  Handshake,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

type Me = {
  id: string;
  user_id: string;
  first_name: string;
};

type PendingIntro = {
  id: string;
  requester_id: string;
  requester_name: string;
  message: string | null;
  created_at: string;
};

type RespondedIntro = {
  id: string;
  recipient_id: string;
  recipient_name: string;
  status: "accepted" | "declined" | "expired";
  responded_at: string;
};

type Notification = {
  id: string;
  message: string;
  channel_id: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationBell({
  buildingId,
  me,
}: {
  buildingId: string;
  me: Me;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingIntros, setPendingIntros] = useState<PendingIntro[]>([]);
  const [respondedIntros, setRespondedIntros] = useState<RespondedIntro[]>([]);
  const [loading, setLoading] = useState(false);
  const [inflight, setInflight] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    const [
      { data: notifs },
      { data: pending },
      { data: responded },
    ] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, message, channel_id, read, created_at")
        .eq("recipient_id", me.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("resident_introductions")
        .select(
          "id, requester_id, message, created_at, requester:resident_public_profiles!requester_id(first_name)"
        )
        .eq("building_id", buildingId)
        .eq("recipient_id", me.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("resident_introductions")
        .select(
          "id, recipient_id, status, responded_at, recipient:resident_public_profiles!recipient_id(first_name)"
        )
        .eq("building_id", buildingId)
        .eq("requester_id", me.id)
        .in("status", ["accepted", "declined"])
        .order("responded_at", { ascending: false })
        .limit(10),
    ]);

    const pendingParsed: PendingIntro[] = (pending ?? []).map((p) => ({
      id: p.id as string,
      requester_id: p.requester_id as string,
      requester_name:
        (p.requester as unknown as { first_name: string | null } | null)
          ?.first_name ?? "A neighbor",
      message: (p.message as string | null) ?? null,
      created_at: p.created_at as string,
    }));

    const respondedParsed: RespondedIntro[] = (responded ?? []).map((r) => ({
      id: r.id as string,
      recipient_id: r.recipient_id as string,
      recipient_name:
        (r.recipient as unknown as { first_name: string | null } | null)
          ?.first_name ?? "A neighbor",
      status: r.status as "accepted" | "declined" | "expired",
      responded_at: (r.responded_at as string | null) ?? (r as unknown as Record<string, unknown>).updated_at as string,
    }));

    setNotifications(notifs ?? []);
    setPendingIntros(pendingParsed);
    setRespondedIntros(respondedParsed);
    setLoading(false);
  };

  // Load when opened
  useEffect(() => {
    if (open) {
      void loadData();
      void markAllRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Initial load for badge count
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, message, channel_id, read, created_at")
        .eq("recipient_id", me.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setNotifications(data ?? []);
    })();

    const sub = supabase
      .channel(`notifs-${me.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${me.id}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev]);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(sub);
    };
  }, [me.id]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length + pendingIntros.length;

  const markAllRead = async () => {
    if (!me || unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("recipient_id", me.id)
      .eq("read", false);
  };

  const respond = async (
    introId: string,
    next: "accepted" | "declined"
  ) => {
    setInflight((s) => ({ ...s, [introId]: true }));
    const { error } = await supabase
      .from("resident_introductions")
      .update({ status: next })
      .eq("id", introId);
    setInflight((s) => ({ ...s, [introId]: false }));
    if (error) {
      console.error("[NotificationBell] respond failed", error);
      return;
    }
    setPendingIntros((prev) => prev.filter((p) => p.id !== introId));
    if (next === "accepted") {
      // Add to responded list optimistically
      const item = pendingIntros.find((p) => p.id === introId);
      if (item) {
        setRespondedIntros((prev) => [
          {
            id: introId,
            recipient_id: me.id,
            recipient_name: me.first_name,
            status: "accepted",
            responded_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    }
  };

  const introTotal = pendingIntros.length + respondedIntros.length;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 grid place-content-center rounded-md hover:bg-muted cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-96 max-h-[32rem] overflow-y-auto rounded-xl border border-border bg-card shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}

          {!loading && introTotal === 0 && notifications.length === 0 && (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                No notifications yet.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Introductions and community updates appear here.
              </p>
            </div>
          )}

          {!loading && pendingIntros.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Introduction Requests
              </h3>
              <ul className="space-y-2">
                {pendingIntros.map((intro) => (
                  <li
                    key={intro.id}
                    className="rounded-lg border border-border/60 bg-muted/30 p-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-8 w-8 rounded-full bg-primary/10 text-primary grid place-content-center shrink-0">
                        <Handshake className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          {intro.requester_name} would like an introduction
                        </p>
                        {intro.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic truncate">
                            “{intro.message}”
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{timeAgo(intro.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs px-3"
                            disabled={inflight[intro.id]}
                            onClick={() => respond(intro.id, "accepted")}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-3 text-muted-foreground hover:text-foreground"
                            disabled={inflight[intro.id]}
                            onClick={() => respond(intro.id, "declined")}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && respondedIntros.length > 0 && (
            <div
              className={cn(
                "px-4 pt-3 pb-1",
                pendingIntros.length > 0 && "border-t border-border"
              )}
            >
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Introduction Updates
              </h3>
              <ul className="space-y-2">
                {respondedIntros.map((intro) => (
                  <li
                    key={intro.id}
                    className={cn(
                      "rounded-lg border p-3 flex items-start gap-2.5",
                      intro.status === "accepted"
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-border/60 bg-muted/30"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 h-8 w-8 rounded-full grid place-content-center shrink-0",
                        intro.status === "accepted"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {intro.status === "accepted" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">
                        {intro.status === "accepted" ? (
                          <>
                            <span className="font-medium">{intro.recipient_name}</span>{" "}
                            accepted your introduction
                          </>
                        ) : (
                          <>
                            <span className="font-medium">{intro.recipient_name}</span>{" "}
                            is not available right now
                          </>
                        )}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{timeAgo(intro.responded_at)}</span>
                      </div>
                      {intro.status === "accepted" && (
                        <Button
                          size="sm"
                          variant="link"
                          className="h-auto p-0 mt-1.5 text-xs"
                          onClick={() => {
                            navigate({
                              to: "/discover",
                              search: { buildingId },
                            });
                            setOpen(false);
                          }}
                        >
                          View connection →
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && notifications.length > 0 && (
            <div
              className={cn(
                "px-4 pt-3 pb-2",
                introTotal > 0 && "border-t border-border"
              )}
            >
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Community
              </h3>
              <ul className="space-y-1">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        if (n.channel_id) {
                          navigate({
                            to: "/building/$buildingId",
                            params: { buildingId },
                            search: { c: n.channel_id ?? undefined },
                          });
                        }
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full text-left rounded-md px-3 py-2.5 transition-colors cursor-pointer flex items-start gap-2.5",
                        n.read
                          ? "hover:bg-muted/50"
                          : "bg-primary/5 hover:bg-primary/10"
                      )}
                    >
                      <div className="mt-0.5 h-7 w-7 rounded-full bg-muted grid place-content-center shrink-0">
                        <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">{n.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                      {!n.read && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
