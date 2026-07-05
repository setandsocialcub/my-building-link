import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/buildings/$buildingId/events")({
  head: () => ({ meta: [{ title: "Events — Building Admin" }] }),
  component: EventsPage,
});

type Event = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  capacity: number | null;
  cover_emoji: string | null;
  status: string;
  created_at: string;
};

function EventsPage() {
  const { buildingId } = Route.useParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", location: "", starts_at: "", capacity: "", cover_emoji: "🎉" });

  const load = async () => {
    const { data } = await (supabase as any)
      .from("events")
      .select("*")
      .eq("building_id", buildingId)
      .order("starts_at", { ascending: false });
    setEvents((data as Event[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? events : events.filter((e) => e.status === statusFilter)),
    [events, statusFilter],
  );

  const createEvent = async () => {
    if (!draft.title.trim() || !draft.starts_at) {
      toast.error("Title and start time are required");
      return;
    }
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await (supabase as any).from("events").insert({
      building_id: buildingId,
      created_by: sess.session?.user?.id ?? null,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      location: draft.location.trim() || null,
      starts_at: new Date(draft.starts_at).toISOString(),
      capacity: draft.capacity ? Number(draft.capacity) : null,
      cover_emoji: draft.cover_emoji || null,
      status: "published",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    setDraft({ title: "", description: "", location: "", starts_at: "", capacity: "", cover_emoji: "🎉" });
    toast.success("Event created");
    await load();
  };

  const cancelEvent = async (e: Event) => {
    await (supabase as any).from("events").update({ status: "cancelled" }).eq("id", e.id);
    toast.success("Event cancelled");
    await load();
  };

  const deleteEvent = async (e: Event) => {
    if (!confirm(`Delete "${e.title}"?`)) return;
    await (supabase as any).from("events").delete().eq("id", e.id);
    toast.success("Event deleted");
    await load();
  };

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Events</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Building events</h1>
          <p className="text-sm text-muted-foreground mt-1">Create, publish, and cancel resident experiences.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> New event</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create event</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div><Label>Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
                  <div className="w-20"><Label>Emoji</Label><Input value={draft.cover_emoji} onChange={(e) => setDraft({ ...draft, cover_emoji: e.target.value })} /></div>
                </div>
                <div><Label>Starts at</Label><Input type="datetime-local" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} /></div>
                <div><Label>Location</Label><Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></div>
                <div><Label>Capacity (optional)</Label><Input type="number" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
                <div className="flex justify-end">
                  <Button onClick={createEvent} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No events yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Event</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="pl-6 font-medium">
                    <span className="mr-2">{e.cover_emoji ?? "🎉"}</span>{e.title}
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(e.starts_at), "MMM d, p")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.location ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.capacity ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{e.status}</Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right space-x-1">
                    {e.status !== "cancelled" && (
                      <Button size="sm" variant="ghost" onClick={() => cancelEvent(e)} className="gap-1.5">
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteEvent(e)} className="gap-1.5 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
