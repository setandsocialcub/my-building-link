import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Palette, Image as ImageIcon, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_BRANDING, type BuildingBranding } from "@/lib/branding";

type Field =
  | "community_name"
  | "welcome_message"
  | "custom_tagline"
  | "primary_color"
  | "secondary_color"
  | "accent_color"
  | "logo_url"
  | "hero_image_url"
  | "app_icon_url";

type Asset = {
  field: "logo_url" | "hero_image_url" | "app_icon_url";
  label: string;
  hint: string;
};

const ASSETS: Asset[] = [
  { field: "logo_url", label: "Logo", hint: "Shown in navigation and dashboard headers." },
  { field: "hero_image_url", label: "Hero image", hint: "Featured on the resident homepage." },
  { field: "app_icon_url", label: "App icon", hint: "Used on the PWA install screen and home-screen icon (512×512 PNG)." },
];

export function BrandingEditor({ buildingId }: { buildingId: string }) {
  const [branding, setBranding] = useState<BuildingBranding | null>(null);
  const [draft, setDraft] = useState<Partial<Record<Field, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Asset["field"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Ensure a row exists (the trigger handles new buildings, but be safe)
      await (supabase as any)
        .from("building_branding")
        .upsert({ building_id: buildingId }, { onConflict: "building_id", ignoreDuplicates: true });
      const { data } = await (supabase as any)
        .from("building_branding")
        .select("*")
        .eq("building_id", buildingId)
        .maybeSingle();
      if (cancelled) return;
      const b = (data as BuildingBranding | null) ?? null;
      setBranding(b);
      setDraft({
        community_name: b?.community_name ?? "",
        welcome_message: b?.welcome_message ?? "",
        custom_tagline: b?.custom_tagline ?? "",
        primary_color: b?.primary_color ?? "",
        secondary_color: b?.secondary_color ?? "",
        accent_color: b?.accent_color ?? "",
        logo_url: b?.logo_url ?? "",
        hero_image_url: b?.hero_image_url ?? "",
        app_icon_url: b?.app_icon_url ?? "",
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  const update = (field: Field, value: string) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const handleUpload = async (field: Asset["field"], file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB).");
      return;
    }
    setUploading(field);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${buildingId}/${field}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("branding")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // Private bucket → long-lived signed URL (1 year, max allowed)
      const { data: signed, error: sErr } = await supabase.storage
        .from("branding")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error("Could not sign URL");
      update(field, signed.signedUrl);
      toast.success("Uploaded.");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    setSaving(true);
    const payload: Record<string, string | null> = {};
    (Object.keys(draft) as Field[]).forEach((k) => {
      const v = draft[k]?.trim() ?? "";
      payload[k] = v === "" ? null : v;
    });
    const { error } = await (supabase as any)
      .from("building_branding")
      .update(payload)
      .eq("building_id", buildingId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Branding saved.");
    setBranding({ ...(branding as BuildingBranding), ...(payload as any) });
    // Notify provider in-tab
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("branding:changed"));
    }
  };

  const resetField = (field: Field) => update(field, "");

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading branding…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Identity */}
      <section className="space-y-4">
        <header>
          <h2 className="font-serif text-xl text-foreground">Community identity</h2>
          <p className="text-sm text-muted-foreground">
            The name, message, and tagline residents see throughout the app.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="community_name">Community name</Label>
            <Input
              id="community_name"
              value={draft.community_name ?? ""}
              onChange={(e) => update("community_name", e.target.value)}
              placeholder={DEFAULT_BRANDING.community_name}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom_tagline">Tagline</Label>
            <Input
              id="custom_tagline"
              value={draft.custom_tagline ?? ""}
              onChange={(e) => update("custom_tagline", e.target.value)}
              placeholder={DEFAULT_BRANDING.custom_tagline}
              maxLength={120}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="welcome_message">Welcome message</Label>
          <Textarea
            id="welcome_message"
            value={draft.welcome_message ?? ""}
            onChange={(e) => update("welcome_message", e.target.value)}
            placeholder={DEFAULT_BRANDING.welcome_message}
            rows={2}
            maxLength={240}
          />
        </div>
      </section>

      {/* Visual identity */}
      <section className="space-y-4">
        <header>
          <h2 className="font-serif text-xl text-foreground flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            Visual identity
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload your logo, hero image, and app icon. PNG or JPG, max 5MB.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          {ASSETS.map((a) => (
            <AssetUploader
              key={a.field}
              asset={a}
              value={draft[a.field] ?? ""}
              uploading={uploading === a.field}
              onUpload={(f) => handleUpload(a.field, f)}
              onClear={() => resetField(a.field)}
            />
          ))}
        </div>
      </section>

      {/* Colors */}
      <section className="space-y-4">
        <header>
          <h2 className="font-serif text-xl text-foreground flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            Brand colors
          </h2>
          <p className="text-sm text-muted-foreground">
            Apply your palette across buttons, accents, and surfaces.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField
            label="Primary"
            value={draft.primary_color ?? ""}
            placeholder={DEFAULT_BRANDING.primary_color}
            onChange={(v) => update("primary_color", v)}
          />
          <ColorField
            label="Secondary"
            value={draft.secondary_color ?? ""}
            placeholder={DEFAULT_BRANDING.secondary_color}
            onChange={(v) => update("secondary_color", v)}
          />
          <ColorField
            label="Accent"
            value={draft.accent_color ?? ""}
            placeholder={DEFAULT_BRANDING.accent_color}
            onChange={(v) => update("accent_color", v)}
          />
        </div>
      </section>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save branding
        </Button>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const v = value || placeholder;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(v) ? v : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent"
          aria-label={`${label} color picker`}
        />
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function AssetUploader({
  asset,
  value,
  uploading,
  onUpload,
  onClear,
}: {
  asset: Asset;
  value: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold">{asset.label}</div>
        <div className="text-xs text-muted-foreground">{asset.hint}</div>
      </div>
      <div className="grid place-items-center h-32 rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={asset.label} className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Upload
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
