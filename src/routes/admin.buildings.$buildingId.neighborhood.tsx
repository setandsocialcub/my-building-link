import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, ExternalLink } from "lucide-react";
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
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/buildings/$buildingId/neighborhood")({
  head: () => ({ meta: [{ title: "Neighborhood Guide — Building Admin" }] }),
  component: NeighborhoodPage,
});

type Place = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  notes: string | null;
  url: string | null;
  order_index: number;
};

const CATEGORIES = ["Coffee", "Restaurant", "Bar", "Fitness", "Wellness", "Grocery", "Park", "Shopping", "Culture", "Transit"];

function NeighborhoodPage() {
  const { buildingId } = Route.useParams();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", category: "", address: "", notes: "", url: "" });

  const load = async () => {
    const { data } = await (supabase as any)
      .from("neighborhood_places")
      .select("*")
      .eq("building_id", buildingId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    setPlaces((data as Place[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const create = async () => {
    if (!draft.name.trim()) return toast.error("Name required");
    const { error } = await (supabase as any).from("neighborhood_places").insert({
      building_id: buildingId,
      name: draft.name.trim(),
      category: draft.category || null,
      address: draft.address.trim() || null,
      notes: draft.notes.trim() || null,
      url: draft.url.trim() || null,
      order_index: places.length,
    });
    if (error) return toast.error(error.message);
    setDraft({ name: "", category: "", address: "", notes: "", url: "" });
    setOpen(false);
    toast.success("Place added");
    await load();
  };

  const remove = async (p: Place) => {
    if (!confirm(`Remove ${p.name}?`)) return;
    await (supabase as any).from("neighborhood_places").delete().eq("id", p.id);
    await load();
  };

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Neighborhood Guide</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Local favorites</h1>
          <p className="text-sm text-muted-foreground mt-1">Curate the neighborhood for residents.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add place</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add a neighborhood place</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div>
                <Label>Category</Label>
                <select
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  <option value="">—</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><Label>Address</Label><Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
              <div><Label>Website</Label><Input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://" /></div>
              <div><Label>Notes</Label><Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Why residents love it." /></div>
              <div className="flex justify-end"><Button onClick={create} className="gap-2"><Plus className="h-4 w-4" /> Add</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <section className="rounded-2xl border border-border bg-card shadow-sm divide-y divide-border">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : places.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No places yet.</div>
        ) : (
          places.map((p) => (
            <div key={p.id} className="p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{p.name}</span>
                  {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                      Visit <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {p.address && <div className="text-xs text-muted-foreground mt-0.5">{p.address}</div>}
                {p.notes && <p className="text-sm mt-1">{p.notes}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(p)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
