import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/buildings/$buildingId/danger")({
  head: () => ({ meta: [{ title: "Danger zone — Building Admin" }] }),
  component: DangerPage,
});

function DangerPage() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("active");
  const [name, setName] = useState<string>("");
  const [confirm, setConfirm] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("buildings")
        .select("name, status")
        .eq("id", buildingId)
        .maybeSingle();
      if (cancelled || !data) return;
      setName(data.name as string);
      setStatus((data.status as string) ?? "active");
    })();
    return () => { cancelled = true; };
  }, [buildingId]);

  const archive = async () => {
    setWorking(true);
    const { error } = await (supabase as any)
      .from("buildings")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", buildingId);
    setWorking(false);
    if (error) return toast.error(error.message);
    setStatus("archived");
    toast.success("Building archived");
  };

  const unarchive = async () => {
    setWorking(true);
    const { error } = await (supabase as any)
      .from("buildings")
      .update({ status: "active", archived_at: null })
      .eq("id", buildingId);
    setWorking(false);
    if (error) return toast.error(error.message);
    setStatus("active");
    toast.success("Building restored");
  };

  const remove = async () => {
    if (confirm !== name) return toast.error("Type the building name exactly to confirm");
    setWorking(true);
    const { error } = await (supabase as any).from("buildings").delete().eq("id", buildingId);
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success("Building deleted");
    navigate({ to: "/admin" });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-destructive">Danger zone</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Archive or delete building</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Archiving hides the building from resident and manager surfaces. Deletion is permanent.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 p-2">
            <Archive className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-medium">Archive</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Marks the building as archived without deleting data. Reversible.
            </p>
          </div>
        </div>
        {status === "archived" ? (
          <Button variant="outline" onClick={unarchive} disabled={working} className="gap-2">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
            Restore building
          </Button>
        ) : (
          <Button variant="outline" onClick={archive} disabled={working} className="gap-2">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            Archive building
          </Button>
        )}
      </section>

      <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-destructive/10 text-destructive p-2">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-medium text-destructive">Delete permanently</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              This deletes the building, its residents, events, circles, and all related data. It cannot be undone.
            </p>
          </div>
        </div>
        <div>
          <Label className="text-xs">Type <span className="font-mono font-semibold">{name}</span> to confirm</Label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" />
        </div>
        <Button variant="destructive" onClick={remove} disabled={working || confirm !== name} className="gap-2">
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete this building
        </Button>
      </section>
    </div>
  );
}
