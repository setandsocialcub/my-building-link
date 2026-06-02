import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$connectionId")({
  component: MessageThreadPage,
});

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

function initialsFor(firstName: string, lastName: string | null) {
  return ((firstName?.[0] ?? "?") + (lastName?.[0] ?? "")).toUpperCase();
}

function displayName(firstName: string, lastName: string | null) {
  return lastName ? `${firstName} ${lastName[0]}.` : firstName;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageThreadPage() {
  const { connectionId } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [peer, setPeer] = useState<ProfileRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  const markIncomingRead = async (myId: string) => {
    await supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("connection_id", connectionId)
      .neq("sender_id", myId)
      .is("read_at", null);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }

      const { data: profileRows } = await supabase
        .from("resident_profiles")
        .select("id")
        .eq("user_id", auth.user.id)
        .limit(1);

      if (!profileRows || profileRows.length === 0) {
        navigate({ to: "/resident-access" });
        return;
      }
      const myId = profileRows[0].id as string;

      const { data: conn, error: connErr } = await supabase
        .from("connections")
        .select("id, requester_id, addressee_id, status")
        .eq("id", connectionId)
        .maybeSingle();

      if (connErr || !conn) {
        toast.error("Conversation not found.");
        navigate({ to: "/messages" });
        return;
      }

      if (conn.requester_id !== myId && conn.addressee_id !== myId) {
        navigate({ to: "/messages" });
        return;
      }

      const peerId =
        conn.requester_id === myId ? conn.addressee_id : conn.requester_id;

      const [peerRes, msgRes] = await Promise.all([
        supabase
          .from("resident_profiles")
          .select("id, first_name, last_name")
          .eq("id", peerId)
          .maybeSingle(),
        supabase
          .from("direct_messages")
          .select(
            "id, connection_id, sender_id, recipient_id, body, read_at, created_at",
          )
          .eq("connection_id", connectionId)
          .order("created_at", { ascending: true })
          .limit(200),
      ]);

      if (cancelled) return;

      setMeId(myId);
      setPeer((peerRes.data as ProfileRow) ?? null);
      setMessages((msgRes.data ?? []) as MessageRow[]);
      setLoading(false);

      await markIncomingRead(myId);
      requestAnimationFrame(() => scrollToBottom(false));
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, navigate]);

  // Realtime: append new messages for this connection
  useEffect(() => {
    if (!meId) return;
    const channel = supabase
      .channel(`dm-thread-${connectionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `connection_id=eq.${connectionId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
          if (row.sender_id !== meId) {
            markIncomingRead(meId);
          }
          requestAnimationFrame(() => scrollToBottom(true));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, meId]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !meId || !peer || sending) return;

    setSending(true);
    const { data, error } = await supabase
      .from("direct_messages")
      .insert({
        connection_id: connectionId,
        sender_id: meId,
        recipient_id: peer.id,
        body,
      })
      .select(
        "id, connection_id, sender_id, recipient_id, body, read_at, created_at",
      )
      .single();
    setSending(false);

    if (error || !data) {
      toast.error("Could not send message.");
      return;
    }

    setDraft("");
    setMessages((prev) =>
      prev.some((m) => m.id === data.id) ? prev : [...prev, data as MessageRow],
    );
    requestAnimationFrame(() => scrollToBottom(true));
  };

  // Group messages: show sender name above first of sequence, timestamp below last
  const grouped = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const isFirstInGroup = !prev || prev.sender_id !== m.sender_id;
      const isLastInGroup = !next || next.sender_id !== m.sender_id;
      return { msg: m, isFirstInGroup, isLastInGroup };
    });
  }, [messages]);

  const peerName = peer ? displayName(peer.first_name, peer.last_name) : "Neighbor";
  const peerInitials = peer ? initialsFor(peer.first_name, peer.last_name) : "?";

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link to="/messages" aria-label="Back to messages">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {peerInitials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {peerName}
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="mx-auto max-w-md py-20 text-center text-sm text-muted-foreground">
            Say hello to {peerName} 👋
          </div>
        ) : (
          <ul className="mx-auto flex max-w-2xl flex-col gap-1">
            {grouped.map(({ msg, isFirstInGroup, isLastInGroup }) => {
              const mine = msg.sender_id === meId;
              const senderLabel = mine ? "You" : peerName;
              return (
                <li
                  key={msg.id}
                  className={cn(
                    "flex flex-col",
                    mine ? "items-end" : "items-start",
                    isFirstInGroup && "mt-3",
                  )}
                >
                  {isFirstInGroup && (
                    <span className="mb-1 px-1 text-xs text-muted-foreground">
                      {senderLabel}
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm shadow-sm",
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md",
                    )}
                  >
                    {msg.body}
                  </div>
                  {isLastInGroup && (
                    <span className="mt-1 px-1 text-[11px] text-muted-foreground">
                      {formatTime(msg.created_at)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-4 py-3"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${peerName}`}
          disabled={loading || sending}
          className="flex-1"
          maxLength={2000}
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || sending || !draft.trim()}
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
