import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/events")({
  component: EventsPage,
});

type EventRow = {
  id: string;
  building_id: string;
  created_by: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  capacity: number | null;
  cover_emoji: string;
  status: "pending" | "published";
};

type RsvpStatus = "going" | "maybe" | "not_going";

type RsvpRow = {
  id: string;
  event_id: string;
  profile_id: string;
  status: RsvpStatus;
};

const COVER_EMOJIS = ["🏢", "🎉", "🍕", "🎬", "🧘", "🏋️", "🐶", "🎨"];

function formatWhen(iso: string) {
  const d = new Date(iso);
  return format(d, "EEEE, MMM d · p");
}

function EventsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [showPast, setShowPast] = useState(false);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("19:00");
  const [capacity, setCapacity] = useState("");
  const [emoji, setEmoji] = useState(COVER_EMOJIS[0]);

  const loadAll = async (meProfileId: string, bId: string) => {
    const [{ data: evs }, { data: rs }] = await Promise.all([
      supabase
        .from("events")
        .select(
          "id, building_id, created_by, title, description, location, starts_at, capacity, cover_emoji, status",
        )
        .eq("building_id", bId)
        .order("starts_at", { ascending: true }),
      supabase
        .from("event_rsvps")
        .select("id, event_id, profile_id, status")
        .eq("building_id", bId),
    ]);
    setEvents(((evs ?? []) as EventRow[]));
    setRsvps(((rs ?? []) as RsvpRow[]));
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
        .select("id, building_id")
        .eq("user_id", auth.user.id)
        .limit(1);
      if (!profileRows || profileRows.length === 0) {
        toast.error("Join a building first.");
        navigate({ to: "/resident-access" });
        return;
      }
      const me = profileRows[0];
      const { data: mgr } = await supabase
        .from("property_managers")
        .select("id")
        .eq("user_id", auth.user.id)
        .eq("building_id", me.building_id)
        .maybeSingle();

      if (cancelled) return;
      setMeId(me.id);
      setBuildingId(me.building_id);
      setIsManager(!!mgr);
      await loadAll(me.id, me.building_id);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const now = Date.now();
  const upcoming = useMemo(
    () => events.filter((e) => new Date(e.starts_at).getTime() >= now),
    [events, now],
  );
  const past = useMemo(
    () =>
      events
        .filter((e) => new Date(e.starts_at).getTime() < now)
        .sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1)),
    [events, now],
  );

  const rsvpFor = (eventId: string) =>
    rsvps.find((r) => r.event_id === eventId && r.profile_id === meId) ?? null;

  const goingCount = (eventId: string) =>
    rsvps.filter((r) => r.event_id === eventId && r.status === "going").length;

  const handleRsvp = async (event: EventRow, status: RsvpStatus) => {
    if (!meId || !buildingId) return;
    const existing = rsvpFor(event.id);

    if (existing && existing.status === status) {
      // Toggle off
      const { error } = await supabase.from("event_rsvps").delete().eq("id", existing.id);
      if (error) {
        toast.error("Could not update RSVP.");
        return;
      }
      setRsvps((prev) => prev.filter((r) => r.id !== existing.id));
      return;
    }

    if (existing) {
      const { data, error } = await supabase
        .from("event_rsvps")
        .update({ status })
        .eq("id", existing.id)
        .select("id, event_id, profile_id, status")
        .single();
      if (error || !data) {
        toast.error("Could not update RSVP.");
        return;
      }
      setRsvps((prev) =>
        prev.map((r) => (r.id === existing.id ? (data as RsvpRow) : r)),
      );
    } else {
      const { data, error } = await supabase
        .from("event_rsvps")
        .insert({
          event_id: event.id,
          profile_id: meId,
          building_id: buildingId,
          status,
        })
        .select("id, event_id, profile_id, status")
        .single();
      if (error || !data) {
        toast.error("Could not RSVP.");
        return;
      }
      setRsvps((prev) => [...prev, data as RsvpRow]);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setDate(undefined);
    setTime("19:00");
    setCapacity("");
    setEmoji(COVER_EMOJIS[0]);
  };

  const handleCreate = async () => {
    if (!meId || !buildingId) return;
    if (!title.trim() || !date) {
      toast.error("Title and date are required.");
      return;
    }
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    const starts = new Date(date);
    starts.setHours(hh || 0, mm || 0, 0, 0);

    setSubmitting(true);
    const { error } = await supabase.from("events").insert({
      building_id: buildingId,
      created_by: meId,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      starts_at: starts.toISOString(),
      capacity: capacity ? parseInt(capacity, 10) : null,
      cover_emoji: emoji,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      isManager ? "Event published." : "Your suggestion was submitted.",
    );
    setOpen(false);
    resetForm();
    await loadAll(meId, buildingId);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Events
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What's happening in your building.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No upcoming events. Be the first to host one.
            </div>
          ) : (
            <ul className="space-y-4">
              {upcoming.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  myRsvp={rsvpFor(ev.id)?.status ?? null}
                  goingCount={goingCount(ev.id)}
                  onRsvp={(s) => handleRsvp(ev, s)}
                />
              ))}
            </ul>
          )}

          {past.length > 0 && (
            <section className="mt-10">
              <button
                onClick={() => setShowPast((s) => !s)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground"
              >
                <span>Past events ({past.length})</span>
                {showPast ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {showPast && (
                <ul className="mt-4 space-y-4">
                  {past.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      myRsvp={rsvpFor(ev.id)?.status ?? null}
                      goingCount={goingCount(ev.id)}
                      onRsvp={(s) => handleRsvp(ev, s)}
                      past
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create event</DialogTitle>
          </DialogHeader>

          {!isManager && (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Your event suggestion will be reviewed by the property manager
              before publishing.
            </p>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Cover
              </label>
              <div className="flex flex-wrap gap-2">
                {COVER_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg border text-xl",
                      emoji === e
                        ? "border-primary bg-accent/40"
                        : "border-border bg-card",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Rooftop pizza night"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="What to expect, what to bring…"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Location
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                placeholder="Rooftop"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Time
                </label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Capacity (optional)
              </label>
              <Input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isManager ? (
                "Publish"
              ) : (
                "Submit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventCard({
  event,
  myRsvp,
  goingCount,
  onRsvp,
  past = false,
}: {
  event: EventRow;
  myRsvp: RsvpStatus | null;
  goingCount: number;
  onRsvp: (status: RsvpStatus) => void;
  past?: boolean;
}) {
  const statusLabel: Record<RsvpStatus, string> = {
    going: "Going",
    maybe: "Maybe",
    not_going: "Not going",
  };

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-4 border-b border-border bg-muted/30 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-background text-3xl">
          {event.cover_emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold text-foreground">
              {event.title}
            </h3>
            {event.status === "pending" && (
              <Badge variant="outline">Pending review</Badge>
            )}
            {myRsvp && (
              <Badge variant="secondary">{statusLabel[myRsvp]}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatWhen(event.starts_at)}
          </p>
          {event.location && (
            <p className="text-sm text-muted-foreground">{event.location}</p>
          )}
        </div>
      </div>
      <div className="space-y-4 p-5">
        {event.description && (
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {event.description}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {goingCount} going{event.capacity ? ` · ${event.capacity} cap` : ""}
          </p>
          {!past && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={myRsvp === "going" ? "default" : "outline"}
                onClick={() => onRsvp("going")}
              >
                Going ✓
              </Button>
              <Button
                size="sm"
                variant={myRsvp === "maybe" ? "default" : "outline"}
                onClick={() => onRsvp("maybe")}
              >
                Maybe ~
              </Button>
              <Button
                size="sm"
                variant={myRsvp === "not_going" ? "default" : "outline"}
                onClick={() => onRsvp("not_going")}
              >
                Not Going ✗
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
