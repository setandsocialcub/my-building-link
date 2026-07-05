import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Upload,
  Palette,
  Image as ImageIcon,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Send,
  Trash2,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_BRANDING,
  mergeDraft,
  type BrandingFields,
  type BuildingBranding,
} from "@/lib/branding";
import { useBranding } from "@/components/BrandingProvider";

type Field = keyof BrandingFields;

type AssetField =
  | "logo_url"
  | "hero_image_url"
  | "cover_image_url"
  | "app_icon_url"
  | "community_icon_url"
  | "splash_screen_image_url"
  | "favicon_url"
  | "login_screen_image_url"
  | "playbook_cover_image_url"
  | "email_logo_url";

type Asset = {
  field: AssetField;
  label: string;
  hint: string;
  group: "identity" | "app" | "email";
};

const ASSETS: Asset[] = [
  { field: "logo_url", label: "Property logo", hint: "Shown in navigation and dashboard headers.", group: "identity" },
  { field: "cover_image_url", label: "Cover image", hint: "Wide banner used on public building pages.", group: "identity" },
  { field: "hero_image_url", label: "Hero image", hint: "Featured on the resident homepage.", group: "identity" },
  { field: "community_icon_url", label: "Community icon", hint: "Compact mark used in dense surfaces and tab icons.", group: "identity" },
  { field: "playbook_cover_image_url", label: "Playbook cover", hint: "Cover image on the Community Playbook™.", group: "identity" },
  { field: "favicon_url", label: "Favicon", hint: "Browser tab icon (32×32 or 64×64 PNG).", group: "app" },
  { field: "app_icon_url", label: "App icon", hint: "PWA install & home-screen icon (512×512 PNG).", group: "app" },
  { field: "splash_screen_image_url", label: "Splash screen", hint: "Shown briefly when the installed app launches.", group: "app" },
  { field: "login_screen_image_url", label: "Login screen", hint: "Background artwork on the sign-in screen.", group: "app" },
  { field: "email_logo_url", label: "Email logo", hint: "Logo used on transactional emails.", group: "email" },
];

const TEXT_FIELDS: Field[] = [
  "community_name",
  "community_tagline",
  "custom_tagline",
  "welcome_message",
  "homepage_headline",
  "homepage_subheadline",
  "primary_color",
  "secondary_color",
  "accent_color",
  "email_primary_color",
  "email_accent_color",
  "app_name",
  "app_short_name",
  "custom_domain",
];

const ASSET_FIELDS: Field[] = ASSETS.map((a) => a.field);

const FIELDS: Field[] = [...TEXT_FIELDS, ...ASSET_FIELDS];


const emptyDraft = (b: BuildingBranding | null): Record<Field, string> => {
  const source = mergeDraft(b, b?.draft ?? null) ?? (b as any);
  const out = {} as Record<Field, string>;
  FIELDS.forEach((k) => {
    const v = source?.[k as keyof typeof source];
    out[k] = (typeof v === "string" ? v : "") ?? "";
  });
  return out;
};

export function BrandingEditor({ buildingId }: { buildingId: string }) {
  const { setPreviewDraft, previewing } = useBranding();
  const [branding, setBranding] = useState<BuildingBranding | null>(null);
  const [draft, setDraft] = useState<Record<Field, string>>(() => emptyDraft(null));
  const [poweredBy, setPoweredBy] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [uploading, setUploading] = useState<Asset["field"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
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
      setDraft(emptyDraft(b));
      setPoweredBy(b?.enable_powered_by_footer !== false);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      setPreviewDraft(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  // Compute draft payload (only fields that differ from published live values)
  const draftPayload = useMemo<Partial<BrandingFields>>(() => {
    const out: Partial<BrandingFields> = {};
    FIELDS.forEach((k) => {
      const v = draft[k]?.trim() ?? "";
      const live = (branding?.[k as keyof BuildingBranding] as string | null | undefined) ?? "";
      const norm = v === "" ? null : v;
      const liveNorm = live === "" ? null : live;
      if (norm !== liveNorm) (out as any)[k] = norm;
    });
    return out;
  }, [draft, branding]);

  const hasPendingChanges = Object.keys(draftPayload).length > 0;
  const savedDraft = (branding?.draft ?? null) as Partial<BrandingFields> | null;
  const hasSavedDraft = !!savedDraft && Object.keys(savedDraft).length > 0;

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
      const { data: signed, error: sErr } = await supabase.storage
        .from("branding")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error("Could not sign URL");
      update(field, signed.signedUrl);
      toast.success("Uploaded to draft.");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    const { data, error } = await (supabase as any)
      .from("building_branding")
      .update({
        draft: draftPayload,
        draft_updated_at: new Date().toISOString(),
      })
      .eq("building_id", buildingId)
      .select("*")
      .maybeSingle();
    setSavingDraft(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setBranding(data as BuildingBranding);
      setDraft(emptyDraft(data as BuildingBranding));
    }
    toast.success("Draft saved. Residents still see the published version.");
  };

  const publish = async () => {
    setPublishing(true);
    const merged = mergeDraft(branding, draftPayload);
    const payload: Record<string, any> = {
      draft: null,
      draft_updated_at: null,
      published_at: new Date().toISOString(),
      enable_powered_by_footer: poweredBy,
    };
    FIELDS.forEach((k) => {
      const v = (merged?.[k as keyof BuildingBranding] as string | null | undefined) ?? null;
      payload[k] = v && String(v).trim() ? v : null;
    });
    const { data, error } = await (supabase as any)
      .from("building_branding")
      .update(payload)
      .eq("building_id", buildingId)
      .select("*")
      .maybeSingle();
    setPublishing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setBranding(data as BuildingBranding);
      setDraft(emptyDraft(data as BuildingBranding));
      setPoweredBy((data as BuildingBranding).enable_powered_by_footer !== false);
    }
    setPreviewDraft(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("branding:changed"));
    }
    toast.success("Branding published to all residents.");
  };

  const discardDraft = async () => {
    setDiscarding(true);
    const { data, error } = await (supabase as any)
      .from("building_branding")
      .update({ draft: null, draft_updated_at: null })
      .eq("building_id", buildingId)
      .select("*")
      .maybeSingle();
    setDiscarding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setBranding(data as BuildingBranding);
      setDraft(emptyDraft(data as BuildingBranding));
    }
    setPreviewDraft(null);
    toast.success("Draft discarded.");
  };

  const togglePreview = () => {
    if (previewing) {
      setPreviewDraft(null);
    } else {
      // Apply the in-form draft (including unsaved edits) for local preview
      setPreviewDraft(draftPayload);
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

  const publishedAt = branding?.published_at
    ? new Date(branding.published_at).toLocaleString()
    : null;
  const draftUpdatedAt = branding?.draft_updated_at
    ? new Date(branding.draft_updated_at).toLocaleString()
    : null;

  // Effective values used by the live preview (draft on top of published branding)
  const previewBranding = useMemo(() => {
    const overlay: any = { ...(branding ?? {}) };
    FIELDS.forEach((k) => {
      const v = draft[k]?.trim();
      if (v) overlay[k] = v;
      else if (v === "") overlay[k] = null;
    });
    return overlay as BuildingBranding;
  }, [draft, branding]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-8 min-w-0">

      {/* Status bar */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {hasSavedDraft || hasPendingChanges ? (
            <Badge variant="secondary" className="gap-1.5">
              <CircleDot className="h-3 w-3" /> Draft in progress
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Published
            </Badge>
          )}
          {previewing && (
            <Badge className="gap-1.5 bg-accent text-accent-foreground">
              <Eye className="h-3 w-3" /> Previewing draft
            </Badge>
          )}
          <div className="text-xs text-muted-foreground">
            {publishedAt && <span>Last published: {publishedAt}</span>}
            {publishedAt && draftUpdatedAt && <span className="mx-2">·</span>}
            {draftUpdatedAt && <span>Draft saved: {draftUpdatedAt}</span>}
            {!publishedAt && !draftUpdatedAt && <span>No changes yet.</span>}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Residents only see published branding.
        </div>
      </div>

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
            <p className="text-xs text-muted-foreground">
              e.g. The Parker Community · One Ocean Community · Flow Living
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="community_tagline">Community tagline</Label>
            <Input
              id="community_tagline"
              value={draft.community_tagline ?? ""}
              onChange={(e) => update("community_tagline", e.target.value)}
              placeholder={DEFAULT_BRANDING.community_tagline}
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

      {/* Homepage messaging */}
      <section className="space-y-4">
        <header>
          <h2 className="font-serif text-xl text-foreground">Homepage messaging</h2>
          <p className="text-sm text-muted-foreground">
            The headline and supporting line at the top of the resident homepage.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="homepage_headline">Headline</Label>
            <Input
              id="homepage_headline"
              value={draft.homepage_headline ?? ""}
              onChange={(e) => update("homepage_headline", e.target.value)}
              placeholder={DEFAULT_BRANDING.homepage_headline}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="homepage_subheadline">Subheadline</Label>
            <Input
              id="homepage_subheadline"
              value={draft.homepage_subheadline ?? ""}
              onChange={(e) => update("homepage_subheadline", e.target.value)}
              placeholder={DEFAULT_BRANDING.homepage_subheadline}
              maxLength={200}
            />
          </div>
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
            Logo, cover, hero, community icon, and playbook cover. PNG, JPG, WebP or SVG — max 5MB.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ASSETS.filter((a) => a.group === "identity").map((a) => (
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

      {/* Community colors */}
      <section className="space-y-4">
        <header>
          <h2 className="font-serif text-xl text-foreground flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            Community colors
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

      {/* App assets */}
      <section className="space-y-4">
        <header>
          <h2 className="font-serif text-xl text-foreground flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            App assets
          </h2>
          <p className="text-sm text-muted-foreground">
            Favicon, installable app icon, splash & login screens.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ASSETS.filter((a) => a.group === "app").map((a) => (
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

      {/* Email branding */}
      <section className="space-y-4">
        <header>
          <h2 className="font-serif text-xl text-foreground flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            Email branding
          </h2>
          <p className="text-sm text-muted-foreground">
            Logo and colors applied to transactional emails sent to residents.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          {ASSETS.filter((a) => a.group === "email").map((a) => (
            <AssetUploader
              key={a.field}
              asset={a}
              value={draft[a.field] ?? ""}
              uploading={uploading === a.field}
              onUpload={(f) => handleUpload(a.field, f)}
              onClear={() => resetField(a.field)}
            />
          ))}
          <ColorField
            label="Email primary"
            value={draft.email_primary_color ?? ""}
            placeholder={draft.primary_color || DEFAULT_BRANDING.primary_color}
            onChange={(v) => update("email_primary_color", v)}
          />
          <ColorField
            label="Email accent"
            value={draft.email_accent_color ?? ""}
            placeholder={draft.accent_color || DEFAULT_BRANDING.accent_color}
            onChange={(v) => update("email_accent_color", v)}
          />
        </div>
      </section>


      {/* Installable app */}
      <section className="space-y-4">
        <header>
          <h2 className="font-serif text-xl text-foreground">Installable app</h2>
          <p className="text-sm text-muted-foreground">
            When residents add this community to their home screen, it appears with
            your branded name and icon.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="app_name">App name</Label>
            <Input
              id="app_name"
              value={draft.app_name ?? ""}
              onChange={(e) => update("app_name", e.target.value)}
              placeholder={draft.community_name || DEFAULT_BRANDING.app_name}
              maxLength={45}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app_short_name">Short name (≤12 chars)</Label>
            <Input
              id="app_short_name"
              value={draft.app_short_name ?? ""}
              onChange={(e) => update("app_short_name", e.target.value)}
              placeholder={(draft.community_name || DEFAULT_BRANDING.app_short_name).slice(0, 12)}
              maxLength={12}
            />
          </div>
        </div>
      </section>

      {/* Custom domain (advanced) */}
      <section className="space-y-4">
        <header>
          <h2 className="font-serif text-xl text-foreground">Custom domain</h2>
          <p className="text-sm text-muted-foreground">
            Optional. Reserve a custom domain for this community (e.g. <code>app.parker.com</code>).
            DNS setup is coordinated separately by the Residence team.
          </p>
        </header>
        <Input
          value={draft.custom_domain ?? ""}
          onChange={(e) => update("custom_domain", e.target.value)}
          placeholder="app.your-building.com"
          maxLength={253}
        />
      </section>

      {/* Footer attribution */}
      <section className="space-y-4">
        <header>
          <h2 className="font-serif text-xl text-foreground">Footer attribution</h2>
          <p className="text-sm text-muted-foreground">
            Show a subtle "Powered by Residence" line in resident footers.
          </p>
        </header>
        <label className="inline-flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={poweredBy}
            onChange={(e) => setPoweredBy(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          Show "Powered by Residence" in footer
        </label>
      </section>

      {/* Actions */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 pt-3 pb-4 bg-background/95 backdrop-blur border-t border-border flex flex-wrap items-center justify-end gap-2">
        <Button
          variant={previewing ? "default" : "outline"}
          onClick={togglePreview}
          className="gap-2"
          type="button"
        >
          {previewing ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {previewing ? "Stop preview" : "Preview draft"}
        </Button>
        {(hasSavedDraft || hasPendingChanges) && (
          <Button
            variant="ghost"
            onClick={discardDraft}
            disabled={discarding || publishing}
            className="gap-2"
            type="button"
          >
            {discarding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Discard draft
          </Button>
        )}
        <Button
          variant="outline"
          onClick={saveDraft}
          disabled={savingDraft || publishing || !hasPendingChanges}
          className="gap-2"
          type="button"
        >
          {savingDraft ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save draft
        </Button>
        <Button
          onClick={publish}
          disabled={publishing || (!hasPendingChanges && !hasSavedDraft)}
          className="gap-2"
          type="button"
        >
          {publishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Publish to residents
        </Button>
      </div>
      </div>

      {/* Live preview panel */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <LivePreview branding={previewBranding} />
      </aside>
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
