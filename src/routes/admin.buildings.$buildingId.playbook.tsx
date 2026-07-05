import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/buildings/$buildingId/playbook")({
  head: () => ({ meta: [{ title: "Community Playbook — Building Admin" }] }),
  component: PlaybookPage,
});

type Item = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  order_index: number;
  completed_at: string | null;
};

const SEED: Array<{ title: string; description: string; category: string }> = [
  { title: "Set the community welcome message", description: "Warm intro shown to every new resident.", category: "Onboarding" },
  { title: "Publish the first building event", description: "Anchor the first month with a hosted experience.", category: "Experiences" },
  { title: "Seed 3 recommended circles", description: "Kickstart resident-led interest groups.", category: "Circles" },
  { title: "Invite the first 10 residents", description: "Reach quorum for meaningful matching.", category: "Residents" },
  { title: "Configure branding & colors", description: "White-label the resident experience.", category: "Branding" },
  { title: "Complete the neighborhood guide", description: "Add 8+ local favorites.", category: "Neighborhood" },
];

function PlaybookPage() {
  const { buildingId } = Route.useParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const load = async () => {
    const { data } = await (supabase as any)
      .from("building_playbook_items")
      .select("*")
      .eq("building_id", buildingId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    let rows = (data as Item[]) ?? [];
    if (rows.length === 0) {
      const seed = SEED.map((s, i) => ({ ...s, building_id: buildingId, order_index: i }));
      const { data: inserted } = await (supabase as any)
        .from("building_playbook_items")
        .insert(seed)
        .select("*");
      rows = ((inserted as Item[]) ?? []).sort((a, b) => a.order_index - b.order_index);
    }
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const toggle = async (item: Item) => {
    const { data: sess } = await supabase.auth.getSession();
    const patch = item.completed_at
      ? { completed_at: null, completed_by: null }
      : { completed_at: new Date().toISOString(), completed_by: sess.session?.user?.id ?? null };
    await (supabase as any).from("building_playbook_items").update(patch).eq("id", item.id);
    await load();
  };

  const addItem = async () => {
    if (!newTitle.trim()) return;
    await (supabase as any).from("building_playbook_items").insert({
      building_id: buildingId,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      order_index: items.length,
    });
    setNewTitle("");
    setNewDesc("");
    toast.success("Playbook item added");
    await load();
  };

  const removeItem = async (item: Item) => {
    await (supabase as any).from("building_playbook_items").delete().eq("id", item.id);
    await load();
  };

  const total = items.length;
  const done = items.filter((i) => i.completed_at).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Community Playbook™</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Launch checklist</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A guided plan for launching and sustaining a thriving resident community.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{done} of {total} complete</span>
          </div>
          <Badge variant="outline">{pct}%</Badge>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm divide-y divide-border">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="p-4 flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggle(item)}
                className="mt-0.5 shrink-0"
                aria-label={item.completed_at ? "Mark incomplete" : "Mark complete"}
              >
                {item.completed_at ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium ${item.completed_at ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                  {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
                </div>
                {item.description && <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeItem(item)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold">Add a playbook item</h2>
        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Item title" />
        <Textarea rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional description" />
        <div className="flex justify-end">
          <Button onClick={addItem} className="gap-2"><Plus className="h-4 w-4" /> Add item</Button>
        </div>
      </section>
    </div>
  );
}
