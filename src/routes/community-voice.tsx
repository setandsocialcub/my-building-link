import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MessageCircle, Paperclip, Send, ShieldAlert, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ResidentPageShell } from "@/components/ResidentPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  PRIORITIES,
  STATUS_META,
  SUBMISSION_TYPES,
  submissionTypeMeta,
  type Priority,
  type Status,
  type SubmissionType,
} from "@/lib/community-voice";

export const Route = createFileRoute("/community-voice")({
  head: () => ({
    meta: [
      { title: "Community Voice — Notify Management" },
      { name: "description", content: "Send private conversations, concerns, suggestions and recognitions to your management team." },
    ],
  }),
  component: CommunityVoicePage,
});

type Submission = {
  id: string;
  submission_type: SubmissionType;
  category: string | null;
  priority: Priority;
  subject: string;
  description: string;
  status: Status;
  attachment_urls: string[];
  recognized_staff_name: string | null;
  is_anonymous: boolean;
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

function CommunityVoicePage() {
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("new");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setLoading(false);
        return;
      }
      setUserId(auth.user.id);
      const { data } = await supabase
        .from("resident_profiles")
        .select("building_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      setBuildingId((data?.building_id as string | undefined) ?? null);
      setLoading(false);
    })();
  }, []);

  return (
    <ResidentPageShell title="Community Voice™" subtitle="Direct line to management">
      <div className="max-w-3xl space-y-6">
        <header>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Community Voice™
          </div>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
            Notify management
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A private conversation between you and your management team. Nothing here is shared
            with other residents. Share concerns, suggest improvements, recognize staff, or simply
            let the team know what's on your mind.
          </p>
        </header>

        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !buildingId || !userId ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Join a community to use Community Voice.
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="new">New submission</TabsTrigger>
              <TabsTrigger value="mine">My conversations</TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="mt-6">
              <NewSubmissionForm
                buildingId={buildingId}
                userId={userId}
                onSubmitted={() => setTab("mine")}
              />
            </TabsContent>
            <TabsContent value="mine" className="mt-6">
              <MySubmissions userId={userId} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ResidentPageShell>
  );
}

function NewSubmissionForm({
  buildingId,
  userId,
  onSubmitted,
}: {
  buildingId: string;
  userId: string;
  onSubmitted: () => void;
}) {
  const [type, setType] = useState<SubmissionType>("concern");
  const [category, setCategory] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("general");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [staffName, setStaffName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const meta = useMemo(() => submissionTypeMeta(type), [type]);

  const reset = () => {
    setType("concern");
    setCategory("");
    setPriority("general");
    setSubject("");
    setDescription("");
    setStaffName("");
    setAnonymous(false);
    setFiles([]);
  };

  const onSelectFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= 5) break;
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`${f.name} is over 20MB`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const uploadAttachments = async (): Promise<string[]> => {
    if (files.length === 0) return [];
    const urls: string[] = [];
    for (const file of files) {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error } = await supabase.storage.from("community-voice").upload(path, file);
      if (error) throw error;
      urls.push(path);
    }
    return urls;
  };

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error("Please add a subject and describe what's happening.");
      return;
    }
    if (meta.requiresCategory && !category) {
      toast.error("Please choose a category.");
      return;
    }
    if (meta.requiresStaffName && !staffName.trim()) {
      toast.error("Please share the staff member's name.");
      return;
    }
    setSubmitting(true);
    try {
      const attachment_urls = await uploadAttachments();
      const { error } = await (supabase as any).from("community_voice_submissions").insert({
        building_id: buildingId,
        submitter_id: userId,
        is_anonymous: anonymous,
        submission_type: type,
        category: meta.requiresCategory ? category : null,
        priority,
        subject: subject.trim(),
        description: description.trim(),
        recognized_staff_name: meta.requiresStaffName ? staffName.trim() : null,
        attachment_urls,
      });
      if (error) throw error;
      toast.success("Received — management has been notified.");
      reset();
      onSubmitted();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <section>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          What would you like to share?
        </label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUBMISSION_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={cn(
                "text-left rounded-xl border p-3 transition-colors",
                type === t.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:bg-muted",
              )}
            >
              <div className="text-sm font-medium flex items-center gap-2">
                <span>{t.emoji}</span>
                {t.label}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
            </button>
          ))}
        </div>
      </section>

      {meta.requiresCategory && (
        <section>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Category</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </section>
      )}

      {meta.requiresStaffName && (
        <section>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Staff member's name
          </label>
          <Input
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            placeholder="Who made your day?"
            className="mt-2"
          />
        </section>
      )}

      <section>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Priority
        </label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPriority(p.id)}
              className={cn(
                "text-left rounded-lg border p-2.5 transition-colors",
                priority === p.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:bg-muted",
              )}
            >
              <div className={cn("inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full", p.tone)}>
                {p.label}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
            </button>
          ))}
        </div>
        {priority === "urgent" && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300 flex gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              If this is a life-safety emergency requiring police, fire, or medical assistance,
              please call 911 or your local emergency number first, then notify management here.
            </span>
          </div>
        )}
      </section>

      <section>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Subject</label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          placeholder="A short summary — e.g., Pool water is cloudy"
          className="mt-2"
        />
      </section>

      <section>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Tell management more
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Share the details that will help management understand and respond."
          className="mt-2"
        />
      </section>

      <section>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Attachments (optional)
        </label>
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <label className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs cursor-pointer hover:bg-muted">
            <Paperclip className="h-3.5 w-3.5" />
            Add photos, videos, or docs
            <input
              type="file"
              multiple
              accept="image/*,video/*,application/pdf"
              className="hidden"
              onChange={(e) => onSelectFiles(e.target.files)}
            />
          </label>
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-[11px]">
              {f.name}
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Submit anonymously
          <span className="text-xs text-muted-foreground">
            (Management will still be able to respond to you here.)
          </span>
        </label>
        <Button onClick={submit} disabled={submitting} className="gap-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send to management
        </Button>
      </section>
    </div>
  );
}

function MySubmissions({ userId }: { userId: string }) {
  const [items, setItems] = useState<Submission[]>([]);
  const [updates, setUpdates] = useState<Record<string, UpdateRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("community_voice_submissions")
      .select("*")
      .eq("submitter_id", userId)
      .order("created_at", { ascending: false });
    const rows = (data as Submission[]) ?? [];
    setItems(rows);
    if (rows.length > 0) {
      const { data: ups } = await (supabase as any)
        .from("community_voice_updates")
        .select("*")
        .in("submission_id", rows.map((r) => r.id))
        .order("created_at", { ascending: true });
      const grouped: Record<string, UpdateRow[]> = {};
      for (const u of (ups as UpdateRow[]) ?? []) {
        (grouped[u.submission_id] ||= []).push(u);
      }
      setUpdates(grouped);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const sendReply = async (submissionId: string) => {
    if (!reply.trim()) return;
    const { error } = await (supabase as any).from("community_voice_updates").insert({
      submission_id: submissionId,
      author_id: userId,
      author_role: "resident",
      body: reply.trim(),
    });
    if (error) return toast.error(error.message);
    setReply("");
    await load();
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        You haven't shared anything with management yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((s) => {
        const meta = submissionTypeMeta(s.submission_type);
        const status = STATUS_META[s.status];
        const isOpen = open === s.id;
        const thread = updates[s.id] ?? [];
        return (
          <li key={s.id} className="rounded-2xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : s.id)}
              className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
            >
              <span className="text-xl leading-none mt-0.5">{meta.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{s.subject}</span>
                  <Badge variant="outline" className={cn("border-0 text-[10px]", status.tone)}>
                    {status.emoji} {status.label}
                  </Badge>
                  {s.category && (
                    <span className="text-[10px] text-muted-foreground">{s.category}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })} · {meta.label}
                </p>
              </div>
              <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
            </button>
            {isOpen && (
              <div className="border-t border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm whitespace-pre-wrap">{s.description}</p>
                {s.attachment_urls.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {s.attachment_urls.length} attachment{s.attachment_urls.length === 1 ? "" : "s"}
                  </div>
                )}
                <div className="space-y-2">
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
                        {u.author_role === "manager" ? "Management" : "You"} ·{" "}
                        {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                      </div>
                      {u.new_status && (
                        <Badge variant="outline" className={cn("mb-1.5 border-0 text-[10px]", STATUS_META[u.new_status].tone)}>
                          {STATUS_META[u.new_status].emoji} {STATUS_META[u.new_status].label}
                        </Badge>
                      )}
                      <p className="whitespace-pre-wrap">{u.body}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Input
                    value={open === s.id ? reply : ""}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to management…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply(s.id);
                      }
                    }}
                  />
                  <Button size="sm" onClick={() => void sendReply(s.id)} className="gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
      <li className="text-center pt-2">
        <Link to="/announcements" className="text-xs text-muted-foreground hover:text-foreground">
          Looking for community-wide updates? Visit Community Updates.
        </Link>
      </li>
    </ul>
  );
}
