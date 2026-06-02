import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, FormEvent } from "react";
import { ArrowLeft, Flag, Loader2, Lock, Pin } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/forum/$threadId")({
  component: ThreadPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  building_updates: "Building Updates",
  lost_and_found: "Lost & Found",
  recommendations: "Recommendations",
  for_sale_free: "For Sale/Free",
  feedback: "Feedback & Suggestions",
};

type Thread = {
  id: string;
  building_id: string;
  author_id: string;
  category: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
};

type Reply = {
  id: string;
  thread_id: string;
  building_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type Profile = { id: string; first_name: string; last_name: string | null };

function initialsFor(first: string, last: string | null) {
  return ((first?.[0] ?? "?") + (last?.[0] ?? "")).toUpperCase();
}

function displayName(p: Profile | undefined) {
  if (!p) return "Resident";
  return p.last_name ? `${p.first_name} ${p.last_name[0]}.` : p.first_name;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [thread, setThread] = useState<Thread | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyAuthors, setReplyAuthors] = useState<Record<string, Profile>>({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }

      const { data: t, error: tErr } = await supabase
        .from("forum_threads")
        .select(
          "id, building_id, author_id, category, title, body, is_pinned, is_locked, created_at",
        )
        .eq("id", threadId)
        .maybeSingle();

      if (tErr || !t) {
        toast.error("Thread not found.");
        navigate({ to: "/forum" });
        return;
      }

      const [{ data: meProf }, { data: mgr }] = await Promise.all([
        supabase
          .from("resident_profiles")
          .select("id")
          .eq("user_id", auth.user.id)
          .eq("building_id", t.building_id)
          .maybeSingle(),
        supabase
          .from("property_managers")
          .select("id")
          .eq("user_id", auth.user.id)
          .eq("building_id", t.building_id)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      setThread(t as Thread);
      setMeId(meProf?.id ?? null);
      setIsManager(!!mgr);

      const [{ data: authorProf }, { data: rs }] = await Promise.all([
        supabase
          .from("resident_profiles")
          .select("id, first_name, last_name")
          .eq("id", t.author_id)
          .maybeSingle(),
        supabase
          .from("forum_replies")
          .select("id, thread_id, building_id, author_id, body, created_at")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;
      setAuthor((authorProf as Profile) ?? null);
      const rRows = (rs ?? []) as Reply[];
      setReplies(rRows);

      const ids = [...new Set(rRows.map((r) => r.author_id))];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("resident_profiles")
          .select("id, first_name, last_name")
          .in("id", ids);
        if (!cancelled && profs) {
          setReplyAuthors(
            Object.fromEntries((profs as Profile[]).map((p) => [p.id, p])),
          );
        }
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [threadId, navigate]);

  const handleReply = async (e: FormEvent) => {
    e.preventDefault();
    const b = draft.trim();
    if (!b || !meId || !thread || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("forum_replies")
      .insert({
        thread_id: thread.id,
        building_id: thread.building_id,
        author_id: meId,
        body: b,
      })
      .select("id, thread_id, building_id, author_id, body, created_at")
      .single();
    setSending(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not post reply.");
      return;
    }
    setReplies((prev) => [...prev, data as Reply]);
    setReplyAuthors((prev) => {
      if (prev[meId]) return prev;
      // best-effort: fetch self profile if missing
      return prev;
    });
    setDraft("");
  };

  const handleFlag = async (reply: Reply) => {
    if (!meId || !thread) return;
    const { error } = await supabase.from("message_flags").insert({
      building_id: thread.building_id,
      message_id: reply.id,
      message_type: "forum_reply",
      reporter_id: meId,
    });
    if (error) {
      toast.error("Could not flag reply.");
    } else {
      toast.success("Reply flagged for review.");
    }
  };

  const togglePin = async () => {
    if (!thread) return;
    const { data, error } = await supabase
      .from("forum_threads")
      .update({ is_pinned: !thread.is_pinned })
      .eq("id", thread.id)
      .select(
        "id, building_id, author_id, category, title, body, is_pinned, is_locked, created_at",
      )
      .single();
    if (error || !data) {
      toast.error("Could not update.");
      return;
    }
    setThread(data as Thread);
  };

  const toggleLock = async () => {
    if (!thread) return;
    const { data, error } = await supabase
      .from("forum_threads")
      .update({ is_locked: !thread.is_locked })
      .eq("id", thread.id)
      .select(
        "id, building_id, author_id, category, title, body, is_pinned, is_locked, created_at",
      )
      .single();
    if (error || !data) {
      toast.error("Could not update.");
      return;
    }
    setThread(data as Thread);
  };

  if (loading || !thread) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/forum">
            <ArrowLeft className="mr-1 h-4 w-4" /> Forum
          </Link>
        </Button>
        {isManager && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={togglePin}>
              <Pin className="mr-1 h-4 w-4" />
              {thread.is_pinned ? "Unpin" : "Pin"}
            </Button>
            <Button variant="outline" size="sm" onClick={toggleLock}>
              <Lock className="mr-1 h-4 w-4" />
              {thread.is_locked ? "Unlock" : "Lock"}
            </Button>
          </div>
        )}
      </div>

      <article className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{CATEGORY_LABEL[thread.category]}</Badge>
          {thread.is_pinned && (
            <span className="inline-flex items-center gap-1 text-xs font-medium">
              <Pin className="h-3 w-3" /> Pinned
            </span>
          )}
          {thread.is_locked && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Lock className="h-3 w-3" /> Locked
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {thread.title}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {displayName(author ?? undefined)} · {formatDate(thread.created_at)}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm text-foreground">
          {thread.body}
        </p>
      </article>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
        </h2>
        <ul className="space-y-3">
          {replies.map((r) => {
            const a = replyAuthors[r.author_id];
            return (
              <li
                key={r.id}
                className="flex gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {a ? initialsFor(a.first_name, a.last_name) : "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {displayName(a)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(r.created_at)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => handleFlag(r)}
                        aria-label="Flag reply"
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {r.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {thread.is_locked ? (
        <p className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          This thread is locked. New replies are disabled.
        </p>
      ) : (
        <form
          onSubmit={handleReply}
          className="mt-6 rounded-xl border border-border bg-card p-4"
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Write a reply…"
          />
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={sending || !draft.trim()}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Post Reply"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
