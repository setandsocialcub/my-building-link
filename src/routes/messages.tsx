import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  component: MessagesInboxPage,
});

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
};

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string | null;
};

type MessageRow = {
  id: string;
  connection_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type Thread = {
  connection: ConnectionRow;
  peer: ProfileRow | undefined;
  lastMessage: MessageRow | null;
  unread: boolean;
};

function initialsFor(firstName: string, lastName: string | null) {
  const f = firstName?.[0] ?? "?";
  const l = lastName?.[0] ?? "";
  return (f + l).toUpperCase();
}

function displayName(firstName: string, lastName: string | null) {
  return lastName ? `${firstName} ${lastName[0]}.` : firstName;
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function truncate(text: string, max = 60) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function MessagesInboxPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }

      const { data: profileRows, error: profileErr } = await supabase
        .from("resident_profiles")
        .select("id")
        .eq("user_id", auth.user.id)
        .limit(1);

      if (profileErr || !profileRows || profileRows.length === 0) {
        toast.error("Join a building first to use messages.");
        navigate({ to: "/resident-access" });
        return;
      }

      const meId = profileRows[0].id as string;
      if (cancelled) return;
      setMyProfileId(meId);

      const { data: connectionsData, error: cErr } = await supabase
        .from("connections")
        .select("id, requester_id, addressee_id, status")
        .eq("status", "accepted")
        .or(`requester_id.eq.${meId},addressee_id.eq.${meId}`);

      if (cErr) {
        toast.error("Could not load your conversations.");
        setLoading(false);
        return;
      }

      const connections: ConnectionRow[] = (connectionsData ?? []).map((r) => ({
        id: r.id,
        requester_id: r.requester_id,
        addressee_id: r.addressee_id,
      }));

      const peerIds = Array.from(
        new Set(
          connections.map((c) =>
            c.requester_id === meId ? c.addressee_id : c.requester_id,
          ),
        ),
      );

      const [profilesRes, messagesRes] = await Promise.all([
        peerIds.length
          ? supabase
              .from("resident_profiles")
              .select("id, first_name, last_name")
              .in("id", peerIds)
          : Promise.resolve({ data: [], error: null } as const),
        connections.length
          ? supabase
              .from("direct_messages")
              .select(
                "id, connection_id, sender_id, recipient_id, body, read_at, created_at",
              )
              .in(
                "connection_id",
                connections.map((c) => c.id),
              )
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null } as const),
      ]);

      if (cancelled) return;

      const profileById: Record<string, ProfileRow> = {};
      for (const p of (profilesRes.data ?? []) as ProfileRow[]) {
        profileById[p.id] = p;
      }

      const latestByConn: Record<string, MessageRow> = {};
      const unreadByConn: Record<string, boolean> = {};
      for (const m of (messagesRes.data ?? []) as MessageRow[]) {
        if (!latestByConn[m.connection_id]) {
          latestByConn[m.connection_id] = m;
        }
        if (m.recipient_id === meId && m.read_at === null) {
          unreadByConn[m.connection_id] = true;
        }
      }

      const built: Thread[] = connections.map((c) => {
        const peerId = c.requester_id === meId ? c.addressee_id : c.requester_id;
        return {
          connection: c,
          peer: profileById[peerId],
          lastMessage: latestByConn[c.id] ?? null,
          unread: !!unreadByConn[c.id],
        };
      });

      built.sort((a, b) => {
        const at = a.lastMessage?.created_at ?? "";
        const bt = b.lastMessage?.created_at ?? "";
        if (at === bt) return 0;
        return at < bt ? 1 : -1;
      });

      setThreads(built);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Realtime: refresh on any new/updated direct message touching us
  useEffect(() => {
    if (!myProfileId) return;
    const channel = supabase
      .channel(`dm-inbox-${myProfileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = (payload.new ?? payload.old) as MessageRow | undefined;
          if (!row) return;
          if (row.sender_id !== myProfileId && row.recipient_id !== myProfileId) return;
          // Lightweight re-fetch
          setThreads((prev) => {
            const idx = prev.findIndex((t) => t.connection.id === row.connection_id);
            if (idx === -1) return prev;
            const next = [...prev];
            const t = next[idx];
            const isNewer =
              !t.lastMessage ||
              new Date(row.created_at).getTime() >
                new Date(t.lastMessage.created_at).getTime();
            next[idx] = {
              ...t,
              lastMessage: isNewer ? row : t.lastMessage,
              unread:
                row.recipient_id === myProfileId && row.read_at === null
                  ? true
                  : t.unread,
            };
            next.sort((a, b) => {
              const at = a.lastMessage?.created_at ?? "";
              const bt = b.lastMessage?.created_at ?? "";
              if (at === bt) return 0;
              return at < bt ? 1 : -1;
            });
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myProfileId]);

  const hasThreads = useMemo(() => threads.length > 0, [threads]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Messages
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Direct conversations with your connected neighbors.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !hasThreads ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Your messages will appear here once you connect with a neighbor.
          </p>
          <Button asChild className="mt-6">
            <Link to="/discover">Discover neighbors</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {threads.map((t) => {
            const peerName = t.peer
              ? displayName(t.peer.first_name, t.peer.last_name)
              : "Neighbor";
            const initials = t.peer
              ? initialsFor(t.peer.first_name, t.peer.last_name)
              : "?";
            const preview = t.lastMessage
              ? truncate(t.lastMessage.body)
              : "Say hello 👋";
            return (
              <li key={t.connection.id}>
                <Link
                  to="/messages/$connectionId"
                  params={{ connectionId: t.connection.id }}
                  className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-accent/30"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-sm",
                          t.unread
                            ? "font-semibold text-foreground"
                            : "font-medium text-foreground",
                        )}
                      >
                        {peerName}
                      </p>
                      {t.lastMessage && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatTimestamp(t.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-sm",
                        t.unread
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {preview}
                    </p>
                  </div>
                  {t.unread && (
                    <span
                      aria-label="Unread messages"
                      className="ml-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
