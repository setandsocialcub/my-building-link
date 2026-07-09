import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Filter,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  PRIORITIES,
  STATUS_META,
  submissionTypeMeta,
  type Priority,
  type Status,
  type SubmissionType,
} from "@/lib/community-voice";

export const Route = createFileRoute("/manager/$buildingId/community-voice")({
  head: () => ({ meta: [{ title: "Community Voice — Manager Dashboard" }] }),
  component: ManagerCommunityVoice,
});

type Row = {
  id: string;
  building_id: string;
  submitter_id: string | null;
  is_anonymous: boolean;
  submission_type: SubmissionType;
  category: string | null;
  priority: Priority;
  subject: string;
  description: string;
  attachment_urls: string[];
  recognized_staff_name: string | null;
  status: Status;
  first_viewed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type UpdateRow = {
  id: string;
  submission_id: string;
  author_role: "manager" | "resident" | "system";
  body: string;
  new_status: Status | null;
  created_at: string;
};

const STATUS_FILTERS: { id: Status | "open" | "all"; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "received", label: "Received" },
  { id: "viewed", label: "Viewed" },
  { id: "in_progress", label: "In progress" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

function ManagerCommunityVoice() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<Status | "open" | "all">("open");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [selected, setSelected] = useState<Row | null>(null);
  const [thread, setThread] = useState<UpdateRow[]>([]);
  const [reply, setReply] = useState("");
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/manager-auth" });
        return;
      }
      setUserId(auth.user.id);
      const { data: mgr } = await supabase
        .from("property_managers")
        .select("id")
        .eq("user_id", auth.user.id)
        .eq("building_id", buildingId)
        .maybeSingle();
      setAuthorized(!!mgr);
    })();
  }, [buildingId, navigate]);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("community_voice_submissions")
      .select("*")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (authorized) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, buildingId]);

  const openSubmission = async (row: Row) => {
    setSelected(row);
    setReply("");
    setPendingStatus(null);
    // Auto-mark as viewed once opened
    if (row.status === "received") {
      await (supabase as any)
        .from("community_voice_submissions")
        .update({ status: "viewed" })
        .eq("id", row.id);
      row.status = "viewed";
    }
    const { data } = await (supabase as any)
      .from("community_voice_updates")
      .select("*")
      .eq("submission_id", row.id)
      .order("created_at", { ascending: true });
    setThread((data as UpdateRow[]) ?? []);
  };

  const postReply = async () => {
    if (!selected || !userId) return;
    if (!reply.trim() && !pendingStatus) return;
    const { error } = await (supabase as any).from("community_voice_updates").insert({
      submission_id: selected.id,
      author_id: userId,
      author_role: "manager",
      body: reply.trim() || `Status updated to ${STATUS_META[pendingStatus!].label}.`,
      new_status: pendingStatus,
      visible_to_resident: true,
    });
    if (error) return toast.error(error.message);
    if (pendingStatus) {
      await (supabase as any)
        .from("community_voice_submissions")
        .update({ status: pendingStatus })
        .eq("id", selected.id);
    }
    toast.success("Reply sent to resident.");
    setReply("");
    setPendingStatus(null);
    await openSubmission({ ...selected, status: pendingStatus ?? selected.status });
    await load();
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "open") {
        if (r.status === "resolved" || r.status === "closed") return false;
      } else if (statusFilter !== "all") {
        if (r.status !== statusFilter) return false;
      }
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      return true;
    });
  }, [rows, statusFilter, categoryFilter, priorityFilter]);

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status !== "resolved" && r.status !== "closed").length;
    const urgent = rows.filter((r) => r.priority === "urgent" && r.status !== "resolved" && r.status !== "closed").length;
    const suggestions = rows.filter((r) => r.submission_type === "improvement" || r.submission_type === "event_suggestion").length;
    const recognitions = rows.filter((r) => r.submission_type === "recognition").length;
    return { open, urgent, suggestions, recognitions };
  }, [rows]);

  if (authorized === null) {
    return (
      <main className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-md">
          <h1 className="font-semibold">Manager access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't have manager access for this building.
          </p>
          <Button asChild className="mt-4">
            <Link to="/manager">Enter manager code</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/manager/$buildingId" params={{ buildingId }}>
                <ArrowLeft className="h-4 w-4" /> Dashboard
              </Link>
            </Button>
            <div className="leading-tight min-w-0">
              <div className="text-xs uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Community Voice™
              </div>
              <div className="text-sm font-semibold truncate">Resident conversations</div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Open conversations" value={stats.open} tone="text-blue-500" />
          <StatCard label="Urgent" value={stats.urgent} tone="text-red-500" />
          <StatCard label="Ideas & suggestions" value={stats.suggestions} tone="text-amber-500" />
          <StatCard label="Recognitions" value={stats.recognitions} tone="text-emerald-500" />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
            <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}>
            <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="grid place-items-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No conversations match your filters.
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-[70vh] overflow-auto">
                {filtered.map((r) => {
                  const meta = submissionTypeMeta(r.submission_type);
                  const status = STATUS_META[r.status];
                  const prio = PRIORITIES.find((p) => p.id === r.priority)!;
                  const active = selected?.id === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => void openSubmission(r)}
                        className={cn(
                          "w-full text-left p-4 hover:bg-muted/40 transition-colors",
                          active && "bg-primary/5",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg leading-none mt-0.5">{meta.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{r.subject}</span>
                              <Badge variant="outline" className={cn("border-0 text-[10px]", prio.tone)}>
                                {prio.label}
                              </Badge>
                            </div>
                            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                              <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                              {r.category && <span>· {r.category}</span>}
                              {r.is_anonymous && <span>· Anonymous</span>}
                            </div>
                          </div>
                          <Badge variant="outline" className={cn("border-0 text-[10px]", status.tone)}>
                            {status.emoji}
                          </Badge>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 min-h-[400px]">
            {!selected ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                Select a conversation to review and respond.
              </div>
            ) : (
              <SubmissionDetail
                row={selected}
                thread={thread}
                reply={reply}
                onReplyChange={setReply}
                pendingStatus={pendingStatus}
                onPendingStatus={setPendingStatus}
                onPost={postReply}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-center gap-2">
          <TrendingUp className={cn("h-4 w-4", tone)} />
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SubmissionDetail({
  row,
  thread,
  reply,
  onReplyChange,
  pendingStatus,
  onPendingStatus,
  onPost,
}: {
  row: Row;
  thread: UpdateRow[];
  reply: string;
  onReplyChange: (v: string) => void;
  pendingStatus: Status | null;
  onPendingStatus: (s: Status | null) => void;
  onPost: () => void;
}) {
  const meta = submissionTypeMeta(row.submission_type);
  const status = STATUS_META[row.status];
  const prio = PRIORITIES.find((p) => p.id === row.priority)!;
  return (
    <div className="space-y-4">
      <header>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl">{meta.emoji}</span>
          <h2 className="text-lg font-semibold">{row.subject}</h2>
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
          <Badge variant="outline" className={cn("border-0", status.tone)}>
            {status.emoji} {status.label}
          </Badge>
          <Badge variant="outline" className={cn("border-0", prio.tone)}>{prio.label}</Badge>
          {row.category && <span className="text-muted-foreground">· {row.category}</span>}
          {row.recognized_staff_name && (
            <span className="text-muted-foreground">· Recognizing {row.recognized_staff_name}</span>
          )}
          <span className="text-muted-foreground">
            · {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
          </span>
          {row.is_anonymous && <span className="text-muted-foreground">· Anonymous</span>}
        </div>
      </header>

      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <p className="text-sm whitespace-pre-wrap">{row.description}</p>
        {row.attachment_urls.length > 0 && (
          <AttachmentList paths={row.attachment_urls} />
        )}
      </section>

      <section className="space-y-2 max-h-64 overflow-auto">
        {thread.map((u) => (
          <div
            key={u.id}
            className={cn(
              "rounded-lg p-3 text-sm",
              u.author_role === "manager"
                ? "bg-primary/5 border border-primary/20"
                : "bg-card border border-border",
            )}
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {u.author_role === "manager" ? "Management" : u.author_role === "resident" ? "Resident" : "System"}{" "}
              · {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
            </div>
            {u.new_status && (
              <Badge variant="outline" className={cn("mb-1.5 border-0 text-[10px]", STATUS_META[u.new_status].tone)}>
                {STATUS_META[u.new_status].emoji} {STATUS_META[u.new_status].label}
              </Badge>
            )}
            <p className="whitespace-pre-wrap">{u.body}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3 pt-3 border-t border-border">
        <Textarea
          value={reply}
          onChange={(e) => onReplyChange(e.target.value)}
          rows={3}
          placeholder="Send a hospitality-first update to the resident…"
        />
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Update status:</span>
            <Select
              value={pendingStatus ?? ""}
              onValueChange={(v) => onPendingStatus((v || null) as Status | null)}
            >
              <SelectTrigger className="h-8 w-44"><SelectValue placeholder="No change" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viewed">👀 Viewed</SelectItem>
                <SelectItem value="in_progress">🔄 In progress</SelectItem>
                <SelectItem value="resolved">✅ Resolved</SelectItem>
                <SelectItem value="closed">🗂️ Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onPost} className="gap-2" size="sm">
            <Send className="h-3.5 w-3.5" />
            Send to resident
          </Button>
        </div>
      </section>
    </div>
  );
}

function AttachmentList({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<{ path: string; url: string }[]>([]);
  useEffect(() => {
    (async () => {
      const out: { path: string; url: string }[] = [];
      for (const p of paths) {
        const { data } = await supabase.storage
          .from("community-voice")
          .createSignedUrl(p, 60 * 60);
        if (data?.signedUrl) out.push({ path: p, url: data.signedUrl });
      }
      setUrls(out);
    })();
  }, [paths]);
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {urls.map((u) => (
        <a
          key={u.path}
          href={u.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1 text-xs hover:bg-muted"
        >
          <MessageCircle className="h-3 w-3" />
          {u.path.split("/").pop()}
        </a>
      ))}
    </div>
  );
}
