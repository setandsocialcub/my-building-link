import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Pin, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/forum")({
  component: ForumPage,
});

const CATEGORIES: { value: string; label: string }[] = [
  { value: "building_updates", label: "Building Updates" },
  { value: "lost_and_found", label: "Lost & Found" },
  { value: "recommendations", label: "Recommendations" },
  { value: "for_sale_free", label: "For Sale/Free" },
  { value: "feedback", label: "Feedback & Suggestions" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
);

type ThreadRow = {
  id: string;
  category: string;
  title: string;
  body: string;
  author_id: string;
  reply_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
};

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

function ForumPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string>("all");

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

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
        .select("id, building_id")
        .eq("user_id", auth.user.id)
        .limit(1);
      if (!profileRows || profileRows.length === 0) {
        toast.error("Join a building first.");
        navigate({ to: "/resident-access" });
        return;
      }
      const me = profileRows[0];
      if (cancelled) return;
      setMeId(me.id);
      setBuildingId(me.building_id);

      const { data: ts } = await supabase
        .from("forum_threads")
        .select(
          "id, category, title, body, author_id, reply_count, is_pinned, is_locked, created_at",
        )
        .eq("building_id", me.building_id)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (cancelled) return;
      const rows = (ts ?? []) as ThreadRow[];
      setThreads(rows);

      const authorIds = [...new Set(rows.map((r) => r.author_id))];
      if (authorIds.length) {
        const { data: profs } = await supabase
          .from("resident_profiles")
          .select("id, first_name")
          .in("id", authorIds);
        if (!cancelled && profs) {
          setAuthors(Object.fromEntries(profs.map((p) => [p.id, p.first_name])));
        }
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const filtered = useMemo(() => {
    if (filter === "all") return threads;
    return threads.filter((t) => t.category === filter);
  }, [threads, filter]);

  const handleCreate = async () => {
    if (!meId || !buildingId) return;
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      toast.error("Title and body are required.");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("forum_threads")
      .insert({
        building_id: buildingId,
        author_id: meId,
        category,
        title: t,
        body: b,
      })
      .select(
        "id, category, title, body, author_id, reply_count, is_pinned, is_locked, created_at",
      )
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not post.");
      return;
    }
    setThreads((prev) => [data as ThreadRow, ...prev]);
    setOpen(false);
    setTitle("");
    setBody("");
    setCategory(CATEGORIES[0].value);
    navigate({ to: "/forum/$threadId", params: { threadId: data.id } });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Neighborhood Forum
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Building-wide discussion for verified residents.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Post
        </Button>
      </header>

      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="all" className="data-[state=active]:bg-accent">
            All
          </TabsTrigger>
          {CATEGORIES.map((c) => (
            <TabsTrigger
              key={c.value}
              value={c.value}
              className="data-[state=active]:bg-accent"
            >
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No posts yet. Start the conversation.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((t) => (
            <li key={t.id}>
              <Link
                to="/forum/$threadId"
                params={{ threadId: t.id }}
                className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/20"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{CATEGORY_LABEL[t.category]}</Badge>
                  {t.is_pinned && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-foreground">
                      <Pin className="h-3 w-3" /> Pinned
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-base font-semibold text-foreground">
                  {t.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {t.body}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{authors[t.author_id] ?? "Resident"}</span>
                  <span>
                    {t.reply_count}{" "}
                    {t.reply_count === 1 ? "reply" : "replies"} · {timeAgo(t.created_at)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="What's on your mind?"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Body
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                rows={6}
                placeholder="Share the details…"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {body.length}/2000
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
