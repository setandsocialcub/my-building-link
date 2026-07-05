import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, X, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/buildings/$buildingId/")({
  head: () => ({
    meta: [{ title: "Building Information — Super Admin" }],
  }),
  component: BuildingInformationPage,
});

type Info = {
  name: string;
  city: string;
  address: string;
  description: string;
  property_type: string;
  unit_count: number | null;
  floor_count: number | null;
  amenities: string[];
  contact_email: string;
  contact_phone: string;
  website: string;
  community_intro: string;
};

const EMPTY: Info = {
  name: "",
  city: "",
  address: "",
  description: "",
  property_type: "",
  unit_count: null,
  floor_count: null,
  amenities: [],
  contact_email: "",
  contact_phone: "",
  website: "",
  community_intro: "",
};

function BuildingInformationPage() {
  const { buildingId } = Route.useParams();
  const [info, setInfo] = useState<Info>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amenityDraft, setAmenityDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("buildings")
        .select(
          "name, city, address, description, property_type, unit_count, floor_count, amenities, contact_email, contact_phone, website, community_intro",
        )
        .eq("id", buildingId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setInfo({
          ...EMPTY,
          ...data,
          amenities: (data.amenities as string[] | null) ?? [],
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  const update = <K extends keyof Info>(k: K, v: Info[K]) =>
    setInfo((p) => ({ ...p, [k]: v }));

  const addAmenity = () => {
    const t = amenityDraft.trim();
    if (!t) return;
    if (info.amenities.includes(t)) {
      setAmenityDraft("");
      return;
    }
    update("amenities", [...info.amenities, t]);
    setAmenityDraft("");
  };

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("buildings")
      .update({
        name: info.name.trim(),
        city: info.city.trim() || null,
        address: info.address.trim() || null,
        description: info.description.trim() || null,
        property_type: info.property_type || null,
        unit_count: info.unit_count,
        floor_count: info.floor_count,
        amenities: info.amenities,
        contact_email: info.contact_email.trim() || null,
        contact_phone: info.contact_phone.trim() || null,
        website: info.website.trim() || null,
        community_intro: info.community_intro.trim() || null,
      })
      .eq("id", buildingId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Building information saved");
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Information</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Building profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Core details residents and managers see across the app.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Property name">
            <Input value={info.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="City">
            <Input value={info.city} onChange={(e) => update("city", e.target.value)} />
          </Field>
          <Field label="Address" full>
            <Input value={info.address} onChange={(e) => update("address", e.target.value)} placeholder="Street, city, postal code" />
          </Field>
          <Field label="Property type">
            <Select value={info.property_type || undefined} onValueChange={(v) => update("property_type", v)}>
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="luxury_highrise">Luxury High-Rise</SelectItem>
                <SelectItem value="boutique">Boutique Residence</SelectItem>
                <SelectItem value="family">Family Community</SelectItem>
                <SelectItem value="student">Student Housing</SelectItem>
                <SelectItem value="senior">Senior Living</SelectItem>
                <SelectItem value="coliving">Co-Living</SelectItem>
                <SelectItem value="mixed_use">Mixed-Use Community</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Units">
              <Input
                type="number"
                value={info.unit_count ?? ""}
                onChange={(e) => update("unit_count", e.target.value ? Number(e.target.value) : null)}
              />
            </Field>
            <Field label="Floors">
              <Input
                type="number"
                value={info.floor_count ?? ""}
                onChange={(e) => update("floor_count", e.target.value ? Number(e.target.value) : null)}
              />
            </Field>
          </div>
          <Field label="Description" full>
            <Textarea rows={3} value={info.description} onChange={(e) => update("description", e.target.value)} placeholder="Short description shown on the building homepage." />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
        <h2 className="font-serif text-lg font-semibold">Amenities</h2>
        <div className="flex flex-wrap gap-2">
          {info.amenities.length === 0 && (
            <span className="text-xs text-muted-foreground italic">No amenities added yet.</span>
          )}
          {info.amenities.map((a) => (
            <Badge key={a} variant="secondary" className="gap-1 pl-2.5 pr-1 py-1">
              {a}
              <button
                type="button"
                className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5"
                onClick={() => update("amenities", info.amenities.filter((x) => x !== a))}
                aria-label={`Remove ${a}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={amenityDraft}
            onChange={(e) => setAmenityDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAmenity();
              }
            }}
            placeholder="e.g. Rooftop pool, Coworking lounge, EV charging"
          />
          <Button type="button" variant="outline" onClick={addAmenity} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-lg font-semibold">Contact & links</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Contact email">
            <Input type="email" value={info.contact_email} onChange={(e) => update("contact_email", e.target.value)} />
          </Field>
          <Field label="Contact phone">
            <Input value={info.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} />
          </Field>
          <Field label="Website" full>
            <Input value={info.website} onChange={(e) => update("website", e.target.value)} placeholder="https://" />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Community introduction</h2>
          <p className="text-xs text-muted-foreground">
            Welcome message shown to new residents in onboarding.
          </p>
        </div>
        <Textarea
          rows={5}
          value={info.community_intro}
          onChange={(e) => update("community_intro", e.target.value)}
          placeholder="Welcome to our community…"
        />
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save information
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
