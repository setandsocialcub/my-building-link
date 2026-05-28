import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Hash,
  Loader2,
  Plus,
  Send,
  Users,
  Bell,
  X,
  Megaphone,
  Flag,
  Pin,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/building/$buildingId")({
  validateSearch: (s: Record<string, unknown>) => ({
    c: typeof s.c === "string" ? s.c : undefined,
  }),
  component: BuildingHub,
});

const INTEREST_TAGS = [
  "Wellness & Fitness",
  "Professional Networking",
  "Sports",
  "Running",
  "Gaming",
  "Food & Cooking",
  "Pets",
  "Arts & Culture",
] as const;

type Channel = {
  id: string;
  name: string;
  interest_tag: string;
  created_at: string;
};

type Message = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type Sender = {
  id: string;
  first_name: string;
  interest_tags: string[];
};

type Notification = {
  id: string;
  message: string;
  channel_id: string | null;
  read: boolean;
  created_at: string;
};

function BuildingHub() {
  const { buildingId } = Route.useParams();
  const { c: selectedChannelId } = useSearch({ from: Route.id });
  const navigate = useNavigate({ from: Route.fullPath });

  const [building, setBuilding] = useState<{ name: string; city: string } | null>(null);
  const [me, setMe] = useState<{ id: string; first_name: string } | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Identify resident from localStorage (set during onboarding)
  useEffect(() => {
    const profileId =
      typeof window !== "undefined"
        ? localStorage.getItem(`resident_profile_${buildingId}`)
        : null;
    if (!profileId) {
      navigate({ to: "/onboarding/$buildingId", params: { buildingId } });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("resident_profiles")
        .select("id, first_name")
        .eq("id", profileId)
        .maybeSingle();
      if (!data) {
        navigate({ to: "/onboarding/$buildingId", params: { buildingId } });
        return;
      }
      setMe(data);
    })();
  }, [buildingId, navigate]);

  // Load building + channels
  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: ch }] = await Promise.all([
        supabase.from("buildings").select("name, city").eq("id", buildingId).maybeSingle(),
        supabase
          .from("channels")
          .select("id, name, interest_tag, created_at")
          .eq("building_id", buildingId)
          .order("created_at", { ascending: true }),
      ]);
      setBuilding(b);
      setChannels(ch ?? []);
    })();
  }, [buildingId]);

  // Realtime: new channels in this building
  useEffect(() => {
    const channel = supabase
      .channel(`building-${buildingId}-channels`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channels",
          filter: `building_id=eq.${buildingId}`,
        },
        (payload) => {
          const c = payload.new as Channel;
          setChannels((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [buildingId]);

  // Load + subscribe notifications for me
  useEffect(() => {
    if (!me) return;
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
          toast(n.message, {
            action: n.channel_id
              ? {
                  label: "Join",
                  onClick: () =>
                    navigate({
                      to: "/building/$buildingId",
                      params: { buildingId },
                      search: { c: n.channel_id ?? undefined },
                    }),
                }
              : undefined,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [me, buildingId, navigate]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!me || unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("recipient_id", me.id)
      .eq("read", false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-content-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{building?.name ?? "Hub"}</div>
              {building && (
                <div className="text-xs text-muted-foreground">{building.city}</div>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {me && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Signed in as <span className="text-foreground font-medium">{me.first_name}</span>
              </span>
            )}
            <button
              onClick={() => {
                setShowNotifs((v) => !v);
                if (!showNotifs) void markAllRead();
              }}
              className="relative h-9 w-9 grid place-content-center rounded-md hover:bg-muted cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          </div>
        </div>

        {showNotifs && (
          <div className="absolute right-4 top-14 w-80 max-h-96 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <span className="text-sm font-medium">Notifications</span>
              <button
                onClick={() => setShowNotifs(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="p-6 text-sm text-center text-muted-foreground">No alerts yet.</p>
            ) : (
              <ul className="divide-y divide-border">
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
                          setShowNotifs(false);
                        }
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 cursor-pointer"
                    >
                      <p className="text-sm">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Channels
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New
            </Button>
          </div>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No channels yet. Start the first one.
            </p>
          ) : (
            <ul className="space-y-1">
              {channels.map((c) => {
                const active = c.id === selectedChannelId;
                return (
                  <li key={c.id}>
                    <Link
                      to="/building/$buildingId"
                      params={{ buildingId }}
                      search={{ c: c.id }}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted text-foreground",
                      )}
                    >
                      <Hash className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Main */}
        <main className="min-h-[60vh]">
          {selectedChannelId && me ? (
            <ChannelView
              key={selectedChannelId}
              channelId={selectedChannelId}
              meId={me.id}
              channel={channels.find((c) => c.id === selectedChannelId) ?? null}
            />
          ) : (
            <EmptyState onCreate={() => setShowCreate(true)} />
          )}
        </main>
      </div>

      {me && (
        <CreateChannelDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          buildingId={buildingId}
          me={me}
          onCreated={(id) =>
            navigate({
              to: "/building/$buildingId",
              params: { buildingId },
              search: { c: id },
            })
          }
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="h-full rounded-2xl border border-dashed border-border p-12 text-center grid place-content-center">
      <Users className="h-8 w-8 mx-auto text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold">Welcome to the Community Hub</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        Pick a channel on the left, or start a new interest group to summon neighbors who share it.
      </p>
      <div className="mt-5">
        <Button onClick={onCreate}>
          <Plus /> Start a new group
        </Button>
      </div>
    </div>
  );
}

function ChannelView({
  channelId,
  meId,
  channel,
}: {
  channelId: string;
  meId: string;
  channel: Channel | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [senders, setSenders] = useState<Record<string, Sender>>({});
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadSenders = async (ids: string[]) => {
    const missing = ids.filter((id) => !senders[id]);
    if (missing.length === 0) return;
    const { data } = await supabase
      .from("resident_public_profiles")
      .select("id, first_name, interest_tags")
      .in("id", missing);
    if (data) {
      setSenders((prev) => {
        const next = { ...prev };
        for (const s of data) {
          if (s.id) next[s.id] = s as Sender;
        }
        return next;
      });
    }
  };

  // Initial load
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("channel_messages")
        .select("id, channel_id, sender_id, body, created_at")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(200);
      const msgs = data ?? [];
      setMessages(msgs);
      await loadSenders([...new Set(msgs.map((m) => m.sender_id))]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Realtime subscription
  useEffect(() => {
    const sub = supabase
      .channel(`channel-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          await loadSenders([m.sender_id]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    const { error } = await supabase.from("channel_messages").insert({
      channel_id: channelId,
      sender_id: meId,
      body: trimmed,
    });
    if (error) {
      toast.error("Could not send. Try again.");
    } else {
      setBody("");
    }
    setSending(false);
  };

  return (
    <section className="flex flex-col h-[calc(100vh-9rem)] rounded-2xl border border-border bg-card overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-center gap-2">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{channel?.name ?? "Channel"}</h2>
          {channel && (
            <p className="text-xs text-muted-foreground">{channel.interest_tag}</p>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center pt-10">
            No messages yet — say hi 👋
          </p>
        ) : (
          messages.map((m) => {
            const s = senders[m.sender_id];
            const isMe = m.sender_id === meId;
            return (
              <div key={m.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                <div className="flex items-center gap-2 mb-1 text-xs">
                  <span className="font-medium text-foreground">
                    {s?.first_name ?? "Resident"}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {s?.interest_tags && s.interest_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5 max-w-md">
                    {s.interest_tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal text-[10px] py-0">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-md rounded-2xl px-4 py-2 text-sm",
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm",
                  )}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="border-t border-border p-3 flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Message #${channel?.name ?? ""}`}
          maxLength={2000}
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !body.trim()}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </section>
  );
}

function CreateChannelDialog({
  open,
  onOpenChange,
  buildingId,
  me,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  buildingId: string;
  me: { id: string; first_name: string };
  onCreated: (channelId: string) => void;
}) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setTag("");
  };

  const tokens = useMemo(
    () =>
      name
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 2),
    [name],
  );

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !tag) return;
    setSubmitting(true);

    // 1) Create channel
    const { data: ch, error: chErr } = await supabase
      .from("channels")
      .insert({
        building_id: buildingId,
        name: trimmedName,
        interest_tag: tag,
        created_by: me.id,
      })
      .select("id")
      .single();

    if (chErr || !ch) {
      toast.error(chErr?.message ?? "Could not create channel.");
      setSubmitting(false);
      return;
    }

    // 2) Summon engine — find matching residents in this building
    const { data: matches } = await supabase
      .from("resident_profiles")
      .select("id, interest_tags")
      .eq("building_id", buildingId);

    const recipientIds = new Set<string>();
    recipientIds.add(me.id); // creator is always a member
    for (const r of matches ?? []) {
      const tags = (r.interest_tags ?? []) as string[];
      const lowerTags = tags.map((t) => t.toLowerCase());
      const matchTag = lowerTags.includes(tag.toLowerCase());
      const matchName = tokens.some((tok) =>
        lowerTags.some((t) => t.includes(tok)),
      );
      if (matchTag || matchName) recipientIds.add(r.id);
    }

    const memberRows = [...recipientIds].map((pid) => ({
      channel_id: ch.id,
      profile_id: pid,
    }));
    await supabase.from("channel_members").insert(memberRows);

    // 3) Notify everyone except creator
    const notifRows = [...recipientIds]
      .filter((pid) => pid !== me.id)
      .map((pid) => ({
        building_id: buildingId,
        recipient_id: pid,
        channel_id: ch.id,
        message: `${me.first_name} just started a ${trimmedName} group for your building. Click to join the chat.`,
      }));
    if (notifRows.length > 0) {
      await supabase.from("notifications").insert(notifRows);
    }

    toast.success(
      notifRows.length > 0
        ? `Summoned ${notifRows.length} neighbor${notifRows.length === 1 ? "" : "s"}.`
        : "Channel created.",
    );

    reset();
    setSubmitting(false);
    onOpenChange(false);
    onCreated(ch.id);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new group</DialogTitle>
          <DialogDescription>
            Pick an interest. Neighbors who share it will be summoned automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="groupName">Group name</Label>
            <Input
              id="groupName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Volleyball Team"
              maxLength={80}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Interest tag</Label>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tag" />
              </SelectTrigger>
              <SelectContent>
                {INTEREST_TAGS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={submitting || !name.trim() || !tag}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" /> Summoning…
              </>
            ) : (
              <>
                <Plus /> Create & summon
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
