import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  ExternalLink,
  Plus,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Trash2,
  Pencil,
  Users,
  TrendingUp,
  Search,
  CheckCircle2,
  XCircle,
  Lock,
  Globe,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { loadBuildingPulse, type BuildingPulse } from "@/lib/pulse-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/buildings/$buildingId/pulse")({
  head: () => ({ meta: [{ title: "Community Pulse Management Center" }] }),
  component: PulseAdminCenter,
});

// ---------- Types ----------
type Circle = {
  id: string;
  building_id: string;
  name: string;
  description: string | null;
  emoji: string;
  icon: string | null;
  color: string | null;
  category: string;
  circle_type: string;
  visibility: "public" | "private";
  join_requirement: "open" | "approval" | "invite";
  is_pinned: boolean;
  is_default: boolean;
  archived_at: string | null;
  member_count: number;
  moderator_id: string | null;
  created_at: string;
};

type JoinRequest = {
  id: string;
  circle_id: string;
  user_id: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  message: string | null;
  requested_at: string;
  circle_name?: string;
  requester_name?: string;
};

type ResidentOption = { id: string; first_name: string | null; last_name: string | null };

// ---------- Constants ----------
const COLOR_SWATCHES = [
  "#0F172A", "#B7A58D", "#C97A63", "#E11D48", "#F59E0B",
  "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6",
];

const ICON_LIBRARY = [
  "🍽️", "🐾", "👨‍👩‍👧", "🍷", "💼",
  "🚴", "📷", "📚", "💻", "🧘",
  "🏃", "🎨", "🎵", "🧑‍🍳", "🌱",
  "🏀", "🎾", "🎬", "✈️", "☕",
];

const CATEGORY_OPTIONS = [
  { value: "custom", label: "Custom" },
  { value: "resident", label: "Resident" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "sport", label: "Sport" },
  { value: "wellness", label: "Wellness" },
  { value: "foodies", label: "Foodies" },
  { value: "dog_parents", label: "Dog Parents" },
  { value: "entrepreneurs", label: "Entrepreneurs" },
  { value: "book_club", label: "Book Club" },
  { value: "new_residents", label: "New Residents" },
  { value: "volunteer", label: "Volunteer" },
  { value: "lgbtq", label: "LGBTQ+" },
];

const STARTER_CIRCLES = [
  { name: "Foodies", emoji: "🍽️", category: "foodies", color: "#C97A63" },
  { name: "Dog Lovers", emoji: "🐾", category: "dog_parents", color: "#B7A58D" },
  { name: "Parents", emoji: "👨‍👩‍👧", category: "lifestyle", color: "#F59E0B" },
  { name: "Wine Club", emoji: "🍷", category: "lifestyle", color: "#8B0000" },
  { name: "Entrepreneurs", emoji: "💼", category: "entrepreneurs", color: "#0F172A" },
  { name: "Cycling", emoji: "🚴", category: "sport", color: "#10B981" },
  { name: "Photography", emoji: "📷", category: "custom", color: "#3B82F6" },
  { name: "Book Club", emoji: "📚", category: "book_club", color: "#8B5CF6" },
  { name: "Remote Workers", emoji: "💻", category: "custom", color: "#14B8A6" },
];

// ---------- Root ----------
function PulseAdminCenter() {
  const { buildingId } = Route.useParams();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [residents, setResidents] = useState<ResidentOption[]>([]);
  const [pulse, setPulse] = useState<BuildingPulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Circle | "new" | null>(null);
  const [seeding, setSeeding] = useState(false);

  const refresh = async () => {
    const [c, r, res, p] = await Promise.all([
      (supabase as any)
        .from("groups")
        .select("*")
        .eq("building_id", buildingId)
        .order("is_pinned", { ascending: false })
        .order("member_count", { ascending: false }),
      (supabase as any)
        .from("circle_join_requests")
        .select("id, circle_id, user_id, status, message, requested_at, groups!inner(building_id,name)")
        .eq("groups.building_id", buildingId)
        .eq("status", "pending"),
      (supabase as any)
        .from("resident_profiles")
        .select("id, first_name, last_name, user_id")
        .eq("building_id", buildingId),
      loadBuildingPulse(buildingId),
    ]);
    setCircles((c.data ?? []) as Circle[]);
    const requestersUserIds = new Set<string>();
    (r.data ?? []).forEach((row: any) => requestersUserIds.add(row.user_id));
    const rp = (res.data ?? []) as any[];
    const uidToName = new Map<string, string>();
    rp.forEach((p) => {
      const nm = [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Neighbor";
      uidToName.set(p.user_id, nm);
    });
    setRequests(
      (r.data ?? []).map((row: any) => ({
        id: row.id,
        circle_id: row.circle_id,
        user_id: row.user_id,
        status: row.status,
        message: row.message,
        requested_at: row.requested_at,
        circle_name: row.groups?.name,
        requester_name: uidToName.get(row.user_id) ?? "Neighbor",
      })),
    );
    setResidents(rp.map((p) => ({ id: p.id, first_name: p.first_name, last_name: p.last_name })));
    setPulse(p);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const seedStarters = async () => {
    setSeeding(true);
    try {
      const existing = new Set(circles.map((c) => c.name.toLowerCase()));
      const rows = STARTER_CIRCLES.filter((s) => !existing.has(s.name.toLowerCase())).map((s) => ({
        building_id: buildingId,
        name: s.name,
        emoji: s.emoji,
        category: s.category,
        color: s.color,
        circle_type: "building_sponsored",
        visibility: "public",
        join_requirement: "open",
      }));
      if (rows.length === 0) {
        toast.info("All starter circles already exist.");
        return;
      }
      const { error } = await (supabase as any).from("groups").insert(rows);
      if (error) throw error;
      toast.success(`Added ${rows.length} starter circles.`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Could not seed starter circles");
    } finally {
      setSeeding(false);
    }
  };

  const togglePin = async (c: Circle) => {
    const { error } = await (supabase as any)
      .from("groups")
      .update({ is_pinned: !c.is_pinned })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(c.is_pinned ? "Unpinned." : "Pinned to featured.");
    await refresh();
  };

  const toggleArchive = async (c: Circle) => {
    const { error } = await (supabase as any)
      .from("groups")
      .update({ archived_at: c.archived_at ? null : new Date().toISOString() })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(c.archived_at ? "Circle restored." : "Circle archived.");
    await refresh();
  };

  const removeCircle = async (c: Circle) => {
    if (!confirm(`Permanently delete "${c.name}"? This removes all memberships.`)) return;
    const { error } = await (supabase as any).from("groups").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Circle deleted.");
    await refresh();
  };

  const decideRequest = async (id: string, decision: "approved" | "declined") => {
    const { error } = await (supabase as any).rpc("approve_circle_join", {
      _request_id: id,
      _decision: decision,
    });
    if (error) return toast.error(error.message);
    toast.success(decision === "approved" ? "Member approved." : "Request declined.");
    await refresh();
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return circles.filter((c) => {
      if (!showArchived && c.archived_at) return false;
      if (showArchived && !c.archived_at) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.description ?? "").toLowerCase().includes(term) ||
        c.category.toLowerCase().includes(term)
      );
    });
  }, [circles, q, showArchived]);

  const active = circles.filter((c) => !c.archived_at);
  const totalMembers = active.reduce((s, c) => s + (c.member_count ?? 0), 0);
  const featured = active.filter((c) => c.is_pinned).length;

  return (
    <div className="max-w-6xl space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Community Pulse
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
            Management Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Create and moderate the Circles that shape your community — each building has its own
            independent set.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link to="/pulse/$buildingId" params={{ buildingId }}>
              Resident view <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {circles.length === 0 && (
            <Button variant="outline" size="sm" onClick={seedStarters} disabled={seeding} className="gap-2">
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Seed starter circles
            </Button>
          )}
          <Button size="sm" onClick={() => setEditing("new")} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Create circle
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {/* Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Circles" value={String(active.length)} />
            <Metric label="Featured" value={String(featured)} />
            <Metric label="Total members" value={String(totalMembers)} />
            <Metric
              label="Pending approvals"
              value={String(requests.length)}
              tone={requests.length > 0 ? "accent" : "default"}
            />
          </div>

          <Tabs defaultValue="circles" className="space-y-4">
            <TabsList>
              <TabsTrigger value="circles">Circles</TabsTrigger>
              <TabsTrigger value="requests">
                Approvals {requests.length > 0 && <Badge className="ml-2" variant="secondary">{requests.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* --- Circles --- */}
            <TabsContent value="circles" className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search circles…"
                    className="pl-9"
                  />
                </div>
                <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
                  <button
                    className={`px-3 py-1.5 ${!showArchived ? "bg-muted" : "bg-card"}`}
                    onClick={() => setShowArchived(false)}
                    type="button"
                  >
                    Active
                  </button>
                  <button
                    className={`px-3 py-1.5 border-l border-border ${showArchived ? "bg-muted" : "bg-card"}`}
                    onClick={() => setShowArchived(true)}
                    type="button"
                  >
                    Archived
                  </button>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  {showArchived
                    ? "No archived circles."
                    : "No circles yet. Create one or seed starter circles above."}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((c) => (
                    <CircleCard
                      key={c.id}
                      circle={c}
                      moderator={residents.find((r) => r.id === c.moderator_id)}
                      onEdit={() => setEditing(c)}
                      onTogglePin={() => togglePin(c)}
                      onToggleArchive={() => toggleArchive(c)}
                      onDelete={() => removeCircle(c)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* --- Requests --- */}
            <TabsContent value="requests" className="space-y-3">
              {requests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No pending join requests.
                </div>
              ) : (
                requests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {r.requester_name} → {r.circle_name}
                      </div>
                      {r.message && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 max-w-md">
                          "{r.message}"
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Requested {new Date(r.requested_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => decideRequest(r.id, "declined")}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Decline
                      </Button>
                      <Button size="sm" className="gap-1.5" onClick={() => decideRequest(r.id, "approved")}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* --- Analytics --- */}
            <TabsContent value="analytics" className="space-y-6">
              <PulseSummary pulse={pulse} />
              <CircleLeaderboard circles={active} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {editing && (
        <CircleEditorDialog
          buildingId={buildingId}
          circle={editing === "new" ? null : editing}
          residents={residents}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------- Metric ----------
function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === "accent" ? "border-accent/40 bg-accent/5" : "border-border bg-card"
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// ---------- Circle card ----------
function CircleCard({
  circle,
  moderator,
  onEdit,
  onTogglePin,
  onToggleArchive,
  onDelete,
}: {
  circle: Circle;
  moderator: ResidentOption | undefined;
  onEdit: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const color = circle.color || "#0F172A";
  const modName = moderator
    ? [moderator.first_name, moderator.last_name].filter(Boolean).join(" ").trim()
    : null;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden group">
      <div className="p-4 flex items-start gap-3">
        <div
          className="h-11 w-11 rounded-xl grid place-items-center text-xl shrink-0"
          style={{ background: `${color}18`, color }}
        >
          {circle.icon || circle.emoji || "👥"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="text-sm font-semibold truncate">{circle.name}</div>
            {circle.is_pinned && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Pin className="h-2.5 w-2.5" /> Featured
              </Badge>
            )}
            {circle.archived_at && (
              <Badge variant="outline" className="text-[10px]">Archived</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {circle.description || "No description."}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            <Chip>
              {circle.visibility === "public" ? (
                <><Globe className="h-2.5 w-2.5" /> Public</>
              ) : (
                <><Lock className="h-2.5 w-2.5" /> Private</>
              )}
            </Chip>
            <Chip>
              <ShieldCheck className="h-2.5 w-2.5" />
              {circle.join_requirement === "open"
                ? "Open join"
                : circle.join_requirement === "approval"
                ? "Approval"
                : "Invite only"}
            </Chip>
            <Chip>
              <Users className="h-2.5 w-2.5" />
              {circle.member_count} member{circle.member_count === 1 ? "" : "s"}
            </Chip>
            {modName && <Chip>Moderator: {modName}</Chip>}
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-border bg-muted/30 flex flex-wrap items-center justify-end gap-1">
        <IconAction title={circle.is_pinned ? "Unpin" : "Pin as featured"} onClick={onTogglePin}>
          {circle.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </IconAction>
        <IconAction title="Edit" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction
          title={circle.archived_at ? "Restore" : "Archive"}
          onClick={onToggleArchive}
        >
          {circle.archived_at ? (
            <ArchiveRestore className="h-3.5 w-3.5" />
          ) : (
            <Archive className="h-3.5 w-3.5" />
          )}
        </IconAction>
        <IconAction title="Delete" onClick={onDelete} tone="danger">
          <Trash2 className="h-3.5 w-3.5" />
        </IconAction>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
      {children}
    </span>
  );
}

function IconAction({
  children,
  title,
  onClick,
  tone = "default",
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-7 w-7 grid place-items-center rounded-md transition-colors ${
        tone === "danger"
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:bg-card hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ---------- Editor ----------
function CircleEditorDialog({
  buildingId,
  circle,
  residents,
  onClose,
  onSaved,
}: {
  buildingId: string;
  circle: Circle | null;
  residents: ResidentOption[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(circle?.name ?? "");
  const [description, setDescription] = useState(circle?.description ?? "");
  const [icon, setIcon] = useState(circle?.icon ?? circle?.emoji ?? "👥");
  const [color, setColor] = useState(circle?.color ?? COLOR_SWATCHES[0]);
  const [category, setCategory] = useState(circle?.category ?? "custom");
  const [visibility, setVisibility] = useState<"public" | "private">(circle?.visibility ?? "public");
  const [joinRequirement, setJoinRequirement] = useState<"open" | "approval" | "invite">(
    circle?.join_requirement ?? "open",
  );
  const [moderatorId, setModeratorId] = useState<string | "none">(circle?.moderator_id ?? "none");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    const payload: any = {
      building_id: buildingId,
      name: name.trim(),
      description: description.trim() || null,
      emoji: icon || "👥",
      icon: icon || null,
      color,
      category,
      visibility,
      join_requirement: joinRequirement,
      moderator_id: moderatorId === "none" ? null : moderatorId,
    };
    const q = circle
      ? (supabase as any).from("groups").update(payload).eq("id", circle.id)
      : (supabase as any).from("groups").insert({ ...payload, circle_type: "building_sponsored" });
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(circle ? "Circle updated." : "Circle created.");
    await onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{circle ? `Edit ${circle.name}` : "Create circle"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
          {/* Preview */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-xl grid place-items-center text-2xl"
              style={{ background: `${color}22`, color }}
            >
              {icon}
            </div>
            <div>
              <div className="text-sm font-semibold">{name || "Circle name"}</div>
              <div className="text-xs text-muted-foreground">
                {description || "Short description shown to residents."}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Foodies"
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Description</Label>
            <Textarea
              id="c-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this circle about?"
              rows={2}
              maxLength={280}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_LIBRARY.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => setIcon(e)}
                  className={`h-9 w-9 rounded-md border text-lg grid place-items-center ${
                    icon === e ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  {e}
                </button>
              ))}
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 2))}
                className="w-16 text-center"
                placeholder="🙂"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full ring-2 ${
                    color === c ? "ring-primary" : "ring-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 rounded border border-border bg-transparent cursor-pointer"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — anyone in building</SelectItem>
                  <SelectItem value="private">Private — hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Join requirement</Label>
              <Select value={joinRequirement} onValueChange={(v) => setJoinRequirement(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open — instant join</SelectItem>
                  <SelectItem value="approval">Approval required</SelectItem>
                  <SelectItem value="invite">Invite only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Moderator</Label>
            <Select value={moderatorId} onValueChange={(v) => setModeratorId(v as any)}>
              <SelectTrigger><SelectValue placeholder="Choose a resident" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No moderator</SelectItem>
                {residents.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {[r.first_name, r.last_name].filter(Boolean).join(" ") || "Neighbor"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {circle ? "Save changes" : "Create circle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Analytics ----------
function PulseSummary({ pulse }: { pulse: BuildingPulse | null }) {
  if (!pulse) return null;
  const s = pulse.summary;
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Active residents (30d)" value={`${s.activeResidents} / ${s.totalResidents}`} />
        <Metric label="Introductions (30d)" value={String(s.newIntroductions)} />
        <Metric label="Accept rate" value={`${Math.round(s.introAcceptRate * 100)}%`} />
        <Metric label="Circle participation" value={`${Math.round(s.circleParticipationRate * 100)}%`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Engagement trend (30d)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pulse.engagementTrend}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#pg)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  );
}

function CircleLeaderboard({ circles }: { circles: Circle[] }) {
  const ranked = [...circles].sort((a, b) => b.member_count - a.member_count).slice(0, 12);
  const max = Math.max(1, ...ranked.map((c) => c.member_count));
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Circle leaderboard</CardTitle>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" /> by member count
        </span>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">No circles yet.</div>
        ) : (
          <div className="space-y-2">
            {ranked.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-lg grid place-items-center text-base shrink-0"
                  style={{ background: `${c.color || "#0F172A"}18`, color: c.color || "#0F172A" }}
                >
                  {c.icon || c.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {c.member_count}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${(c.member_count / max) * 100}%`,
                        background: c.color || "hsl(var(--primary))",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
