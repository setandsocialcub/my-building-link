import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Megaphone, Shield, Flag, Loader2, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/manager/$buildingId")({
  component: ManagerDashboard,
});

type Announcement = { id: string; body: string; created_at: string };
type FlaggedRow = {
  id: string;
  message_id: string;
  channel_id: string;
  status: string;
  created_at: string;
  message?: { id: string; body: string; sender_id: string; created_at: string } | null;
  channel?: { name: string } | null;
  sender_name?: string;
};

function ManagerDashboard() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const [building, setBuilding] = useState<{ name: string; city: string } | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/manager" });
        return;
      }
      const { data: mgr } = await supabase
        .from("property_managers")
        .select("id")
        .eq("user_id", user.id)
        .eq("building_id", buildingId)
        .maybeSingle();
      if (!mgr) {
        navigate({ to: "/manager" });
        return;
      }
      setManagerId(mgr.id);
      const { data: b } = await supabase
        .rpc("get_building_info", { _building_id: buildingId })
        .maybeSingle();
      if (b) setBuilding({ name: b.name, city: b.city });
    })();
  }, [buildingId, navigate]);

  if (!managerId) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/manager" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-content-center">
              <Shield className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{building?.name ?? "Building"}</div>
              <div className="text-xs text-muted-foreground">Property Manager</div>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/manager" });
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <Tabs defaultValue="announcements">
          <TabsList>
            <TabsTrigger value="announcements">
              <Megaphone className="h-4 w-4" /> Announcements
            </TabsTrigger>
            <TabsTrigger value="flags">
              <Flag className="h-4 w-4" /> Flagged Content
            </TabsTrigger>
          </TabsList>
          <TabsContent value="announcements" className="mt-6">
            <AnnouncementsPanel buildingId={buildingId} managerId={managerId} />
          </TabsContent>
          <TabsContent value="flags" className="mt-6">
            <FlagsPanel buildingId={buildingId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AnnouncementsPanel({
  buildingId,
  managerId,
}: {
  buildingId: string;
  managerId: string;
}) {
  const [list, setList] = useState<Announcement[]>([]);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, body, created_at")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false });
    setList(data ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    const { error } = await supabase.from("announcements").insert({
      building_id: buildingId,
      manager_id: managerId,
      body: trimmed,
    });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    toast.success("Announcement posted to all residents.");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    setList((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={post}
        className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm"
      >
        <label className="text-sm font-medium">New official announcement</label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g. Elevator maintenance tomorrow from 9am–12pm."
          maxLength={4000}
          rows={3}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={posting || !body.trim()}>
            {posting ? <Loader2 className="animate-spin" /> : <Megaphone />} Broadcast
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Posted
        </h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          list.map((a) => (
            <article
              key={a.id}
              className="rounded-xl border border-border bg-card p-4 flex items-start gap-3"
            >
              <div className="flex-1">
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function FlagsPanel({ buildingId }: { buildingId: string }) {
  const [rows, setRows] = useState<FlaggedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: flags } = await supabase
      .from("message_flags")
      .select("id, message_id, channel_id, status, created_at")
      .eq("building_id", buildingId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const flagRows = flags ?? [];
    const msgIds = [...new Set(flagRows.map((f) => f.message_id))];
    const chanIds = [...new Set(flagRows.map((f) => f.channel_id))];

    const [{ data: msgs }, { data: chans }] = await Promise.all([
      msgIds.length
        ? supabase
            .from("channel_messages")
            .select("id, body, sender_id, created_at")
            .in("id", msgIds)
        : Promise.resolve({ data: [] as any[] }),
      chanIds.length
        ? supabase.from("channels").select("id, name").in("id", chanIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const senderIds = [...new Set((msgs ?? []).map((m: any) => m.sender_id))];
    const { data: senders } = senderIds.length
      ? await supabase
          .from("resident_public_profiles")
          .select("id, first_name")
          .in("id", senderIds)
      : { data: [] as any[] };

    const msgMap = new Map((msgs ?? []).map((m: any) => [m.id, m]));
    const chanMap = new Map((chans ?? []).map((c: any) => [c.id, c]));
    const senderMap = new Map((senders ?? []).map((s: any) => [s.id, s.first_name]));

    setRows(
      flagRows.map((f) => {
        const m = msgMap.get(f.message_id) ?? null;
        return {
          ...f,
          message: m,
          channel: chanMap.get(f.channel_id) ?? null,
          sender_name: m ? senderMap.get(m.sender_id) ?? "Resident" : "Resident",
        };
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    const sub = supabase
      .channel(`flags-${buildingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_flags",
          filter: `building_id=eq.${buildingId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const dismiss = async (flagId: string) => {
    await supabase
      .from("message_flags")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", flagId);
    setRows((prev) => prev.filter((r) => r.id !== flagId));
    toast.success("Flag dismissed.");
  };

  const removeMessage = async (row: FlaggedRow) => {
    // Delete the message — cascades flag rows.
    await supabase.from("channel_messages").delete().eq("id", row.message_id);
    // Mark any sibling flags as removed for the audit trail (best-effort; may have cascaded already)
    await supabase
      .from("message_flags")
      .update({ status: "removed", resolved_at: new Date().toISOString() })
      .eq("message_id", row.message_id);
    setRows((prev) => prev.filter((r) => r.message_id !== row.message_id));
    toast.success("Message removed.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <Flag className="h-8 w-8 mx-auto text-muted-foreground" />
        <h3 className="mt-3 font-semibold">Queue is clear</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Residents haven't flagged any messages. Nice and quiet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <article key={r.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <Badge variant="secondary">#{r.channel?.name ?? "channel"}</Badge>
            <span>by {r.sender_name}</span>
            <span>· flagged {new Date(r.created_at).toLocaleString()}</span>
          </div>
          {r.message ? (
            <p className="text-sm bg-muted rounded-lg px-3 py-2">{r.message.body}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">Message no longer available.</p>
          )}
          <div className="mt-3 flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => dismiss(r.id)}>
              <Check className="h-4 w-4" /> Dismiss flag
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => removeMessage(r)}
              disabled={!r.message}
            >
              <Trash2 className="h-4 w-4" /> Delete message
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
