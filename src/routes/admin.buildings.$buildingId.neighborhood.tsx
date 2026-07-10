import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
  Star,
  StarOff,
  EyeOff,
  Check,
  Gift,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { CONCIERGE_CATEGORIES } from "@/lib/concierge";

export const Route = createFileRoute("/admin/buildings/$buildingId/neighborhood")({
  head: () => ({ meta: [{ title: "Community Concierge™ — Admin" }] }),
  component: ConciergeAdminPage,
});

type Place = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  description: string | null;
  notes: string | null;
  url: string | null;
  reservation_url: string | null;
  image_url: string | null;
  tags: string[];
  is_featured: boolean;
  is_perk: boolean;
  perk_description: string | null;
  source: string;
  status: string;
  submitted_by: string | null;
  order_index: number;
  created_at: string;
};

function ConciergeAdminPage() {
  const { buildingId } = Route.useParams();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"approved" | "pending" | "hidden">("approved");
  const [draft, setDraft] = useState({
    name: "",
    category: "",
    address: "",
    description: "",
    url: "",
    reservation_url: "",
    image_url: "",
    is_perk: false,
    perk_description: "",
    is_featured: false,
  });

  const load = async () => {
    const { data } = await supabase
      .from("neighborhood_places")
      .select("*")
      .eq("building_id", buildingId)
      .order("is_featured", { ascending: false })
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false });
    setPlaces((data as Place[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const pending = useMemo(() => places.filter((p) => p.status === "pending"), [places]);
  const approved = useMemo(() => places.filter((p) => p.status === "approved"), [places]);
  const hidden = useMemo(() => places.filter((p) => p.status === "hidden"), [places]);

  const create = async () => {
    if (!draft.name.trim()) return toast.error("Name required");
    const { error } = await supabase.from("neighborhood_places").insert({
      building_id: buildingId,
      source: "manager",
      status: "approved",
      name: draft.name.trim(),
      category: draft.category || null,
      address: draft.address.trim() || null,
      description: draft.description.trim() || null,
      url: draft.url.trim() || null,
      reservation_url: draft.reservation_url.trim() || null,
      image_url: draft.image_url.trim() || null,
      is_perk: draft.is_perk,
      perk_description: draft.is_perk ? draft.perk_description.trim() || null : null,
      is_featured: draft.is_featured,
      order_index: places.length,
    });
    if (error) return toast.error(error.message);
    setDraft({
      name: "",
      category: "",
      address: "",
      description: "",
      url: "",
      reservation_url: "",
      image_url: "",
      is_perk: false,
      perk_description: "",
      is_featured: false,
    });
    setOpen(false);
    toast.success("Added to Concierge");
    await load();
  };

  const patch = async (p: Place, changes: Partial<Place>) => {
    const { error } = await supabase
      .from("neighborhood_places")
      .update(changes)
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    await load();
  };

  const remove = async (p: Place) => {
    if (!confirm(`Remove ${p.name}?`)) return;
    await supabase.from("neighborhood_places").delete().eq("id", p.id);
    await load();
  };

  const renderList = (list: Place[], emptyText: string) =>
    loading ? (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    ) : list.length === 0 ? (
      <div className="py-16 text-center text-sm text-muted-foreground">{emptyText}</div>
    ) : (
      <div className="divide-y divide-border">
        {list.map((p) => (
          <div key={p.id} className="p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{p.name}</span>
                {p.category && (
                  <Badge variant="outline" className="text-[10px]">
                    {p.category}
                  </Badge>
                )}
                {p.is_featured && (
                  <Badge className="text-[10px] bg-primary text-primary-foreground gap-1">
                    <Star className="h-3 w-3" /> Featured
                  </Badge>
                )}
                {p.is_perk && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Gift className="h-3 w-3" /> Perk
                  </Badge>
                )}
                {p.source === "resident" && (
                  <Badge variant="outline" className="text-[10px]">
                    Resident submission
                  </Badge>
                )}
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    Visit <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {p.address && (
                <div className="text-xs text-muted-foreground mt-0.5">{p.address}</div>
              )}
              {(p.description || p.notes) && (
                <p className="text-sm mt-1">{p.description || p.notes}</p>
              )}
              {p.is_perk && p.perk_description && (
                <p className="text-xs text-primary mt-1">🎁 {p.perk_description}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              {p.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => patch(p, { status: "approved" })}
                  className="gap-1"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </Button>
              )}
              {p.status === "approved" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => patch(p, { is_featured: !p.is_featured })}
                    className="gap-1"
                  >
                    {p.is_featured ? (
                      <>
                        <StarOff className="h-3.5 w-3.5" /> Unfeature
                      </>
                    ) : (
                      <>
                        <Star className="h-3.5 w-3.5" /> Feature
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => patch(p, { status: "hidden" })}
                    className="gap-1"
                  >
                    <EyeOff className="h-3.5 w-3.5" /> Hide
                  </Button>
                </>
              )}
              {p.status === "hidden" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => patch(p, { status: "approved" })}
                  className="gap-1"
                >
                  <Check className="h-3.5 w-3.5" /> Restore
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(p)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Community Concierge™
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
            Curate your neighborhood
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Feature businesses, approve resident recommendations, and create exclusive perks.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add recommendation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add a Concierge recommendation</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Category</Label>
                <select
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  <option value="">—</option>
                  {CONCIERGE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Why residents will love it."
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Website</Label>
                  <Input
                    value={draft.url}
                    onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                    placeholder="https://"
                  />
                </div>
                <div>
                  <Label>Reservation link</Label>
                  <Input
                    value={draft.reservation_url}
                    onChange={(e) =>
                      setDraft({ ...draft, reservation_url: e.target.value })
                    }
                    placeholder="OpenTable, Resy, …"
                  />
                </div>
              </div>
              <div>
                <Label>Cover image URL</Label>
                <Input
                  value={draft.image_url}
                  onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                  placeholder="https://…jpg"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Feature on Concierge home</div>
                  <div className="text-xs text-muted-foreground">
                    Show as today's pick.
                  </div>
                </div>
                <Switch
                  checked={draft.is_featured}
                  onCheckedChange={(v) => setDraft({ ...draft, is_featured: v })}
                />
              </div>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Resident perk</div>
                    <div className="text-xs text-muted-foreground">
                      Highlight an exclusive discount or offer.
                    </div>
                  </div>
                  <Switch
                    checked={draft.is_perk}
                    onCheckedChange={(v) => setDraft({ ...draft, is_perk: v })}
                  />
                </div>
                {draft.is_perk && (
                  <Textarea
                    rows={2}
                    value={draft.perk_description}
                    onChange={(e) =>
                      setDraft({ ...draft, perk_description: e.target.value })
                    }
                    placeholder="e.g. 15% off for OONAH residents — mention 'concierge' at checkout."
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create} className="gap-2">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="approved">Approved · {approved.length}</TabsTrigger>
          <TabsTrigger value="pending">
            Pending {pending.length > 0 && <Badge className="ml-2">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="hidden">Hidden · {hidden.length}</TabsTrigger>
        </TabsList>
        <TabsContent value="approved">
          <section className="rounded-2xl border border-border bg-card shadow-sm mt-3">
            {renderList(approved, "No approved recommendations yet.")}
          </section>
        </TabsContent>
        <TabsContent value="pending">
          <section className="rounded-2xl border border-border bg-card shadow-sm mt-3">
            {renderList(pending, "No pending resident submissions.")}
          </section>
        </TabsContent>
        <TabsContent value="hidden">
          <section className="rounded-2xl border border-border bg-card shadow-sm mt-3">
            {renderList(hidden, "Nothing hidden.")}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
