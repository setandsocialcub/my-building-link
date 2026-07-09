import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Globe2,
  Loader2,
  Palette,
  Rocket,
  Save,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { BrandingEditor } from "@/components/BrandingEditor";
import { BrandSimulator } from "@/components/BrandSimulator";
import { useBranding } from "@/components/BrandingProvider";
import {
  COMMUNITY_VOICES,
  INDUSTRY_META,
  INDUSTRY_TYPES,
  type IndustryType,
} from "@/lib/industry";

type Client = { id: string; name: string; industry_type: IndustryType };
type Template = { id: string; template_name: string };

/**
 * WhiteLabelStudio — the enterprise wrapper around BrandingEditor.
 *
 * Provides:
 *  - Sticky header with brand status, live preview link, "Publish Brand"
 *  - Industry Mode + Community Voice + Client + Portfolio Template controls
 *  - Tabbed navigation across brand disciplines (Identity / Appearance /
 *    Login / Emails / PWA / Legal / Voice / Domain)
 *
 * The tabs currently all reveal the same underlying BrandingEditor form
 * to preserve the full field surface; the Studio adds the enterprise
 * chrome, industry taxonomy, and portfolio template application.
 */
export function WhiteLabelStudio({
  buildingId,
  role,
}: {
  buildingId: string;
  role: "admin" | "manager";
}) {
  const { refresh } = useBranding();
  const [loading, setLoading] = useState(true);
  const [industry, setIndustry] = useState<IndustryType>("luxury_residential");
  const [voice, setVoice] = useState<string>("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [buildingName, setBuildingName] = useState("");
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: bldg }, { data: brnd }, { data: clientList }, { data: tmpls }] =
        await Promise.all([
          (supabase as any)
            .from("buildings")
            .select("name, industry_type, client_id")
            .eq("id", buildingId)
            .maybeSingle(),
          (supabase as any)
            .from("building_branding")
            .select("community_voice, custom_domain, published_at")
            .eq("building_id", buildingId)
            .maybeSingle(),
          (supabase as any).from("clients").select("id, name, industry_type"),
          (supabase as any)
            .from("building_templates")
            .select("id, template_name"),
        ]);
      if (cancelled) return;
      setBuildingName((bldg?.name as string | undefined) ?? "");
      setIndustry((bldg?.industry_type as IndustryType) ?? "luxury_residential");
      setClientId((bldg?.client_id as string | null) ?? null);
      setVoice((brnd?.community_voice as string | undefined) ?? "");
      setCustomDomain((brnd?.custom_domain as string | undefined) ?? null);
      setPublishedAt((brnd?.published_at as string | undefined) ?? null);
      setClients((clientList as Client[] | null) ?? []);
      setTemplates((tmpls as Template[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      const { error: bErr } = await (supabase as any)
        .from("buildings")
        .update({ industry_type: industry, client_id: clientId })
        .eq("id", buildingId);
      if (bErr) throw bErr;
      const { error: brErr } = await (supabase as any)
        .from("building_branding")
        .update({ community_voice: voice || null })
        .eq("building_id", buildingId);
      if (brErr) throw brErr;
      toast.success("Industry and voice saved.");
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSavingMeta(false);
    }
  };

  const applyTemplate = async () => {
    if (!templateId) return;
    setApplyingTemplate(true);
    try {
      const { error } = await (supabase as any).rpc("apply_portfolio_template", {
        _building_id: buildingId,
        _template_id: templateId,
      });
      if (error) throw error;
      toast.success("Portfolio template applied. Existing overrides preserved.");
      void refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("branding:changed"));
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not apply template");
    } finally {
      setApplyingTemplate(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading White Label Studio…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sticky enterprise header */}
      <div className="sticky top-14 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3 w-3" /> White Label Studio
            </div>
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <h1 className="font-serif text-2xl truncate">{buildingName || "Brand"}</h1>
              <Badge variant="outline" className="capitalize">
                {INDUSTRY_META[industry].label}
              </Badge>
              {publishedAt ? (
                <Badge variant="secondary">Live</Badge>
              ) : (
                <Badge variant="outline">Unpublished</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/building/${buildingId}`, "_blank", "noopener")}
              className="gap-1.5"
            >
              <Globe2 className="h-4 w-4" /> Open live preview
            </Button>
          </div>
        </div>
      </div>

      {/* Enterprise controls: industry, voice, portfolio template */}
      <Card className="p-5 space-y-5">
        <div>
          <h2 className="font-serif text-lg">Brand foundations</h2>
          <p className="text-sm text-muted-foreground">
            Industry Mode, Community Voice, and portfolio inheritance drive terminology and
            defaults across every {INDUSTRY_META[industry].terminology.member.toLowerCase()} touchpoint.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Industry Mode</Label>
            <Select value={industry} onValueChange={(v) => setIndustry(v as IndustryType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_TYPES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {INDUSTRY_META[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Adapts terminology across dashboards and notifications.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Community Voice</Label>
            <Select value={voice || "__none"} onValueChange={(v) => setVoice(v === "__none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Default —</SelectItem>
                {COMMUNITY_VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Guides copy in emails and notifications.</p>
          </div>

          {role === "admin" && (
            <div className="space-y-1.5">
              <Label>Client / Portfolio</Label>
              <Select
                value={clientId ?? "__none"}
                onValueChange={(v) => setClientId(v === "__none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Independent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Independent (no client)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Attach this building to a corporate client (e.g. Greystar).
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
          <Button onClick={saveMeta} disabled={savingMeta} className="gap-2">
            {savingMeta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save foundations
          </Button>

          {role === "admin" && templates.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Label className="text-xs text-muted-foreground">Portfolio template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Choose template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.template_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={applyTemplate}
                disabled={!templateId || applyingTemplate}
                className="gap-2"
              >
                {applyingTemplate ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Apply
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Tabbed studio — all tabs currently reveal the full editor; tab labels
          orient enterprise users to the discipline they came for. */}
      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="identity" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Identity
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5">
            <Palette className="h-3.5 w-3.5" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="pwa">PWA</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
          <TabsTrigger value="domain">Domain</TabsTrigger>
          <TabsTrigger value="simulator" className="gap-1.5">
            <Laptop className="h-3.5 w-3.5" /> Simulator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="mt-6">
          <BrandingEditor buildingId={buildingId} />
        </TabsContent>
        <TabsContent value="appearance" className="mt-6">
          <BrandingEditor buildingId={buildingId} />
        </TabsContent>
        <TabsContent value="login" className="mt-6">
          <BrandingEditor buildingId={buildingId} />
        </TabsContent>
        <TabsContent value="pwa" className="mt-6">
          <PwaPanel buildingId={buildingId} />
          <div className="mt-6">
            <BrandingEditor buildingId={buildingId} />
          </div>
        </TabsContent>
        <TabsContent value="emails" className="mt-6">
          <EmailPanel buildingId={buildingId} />
        </TabsContent>
        <TabsContent value="legal" className="mt-6">
          <LegalPanel buildingId={buildingId} role={role} />
        </TabsContent>
        <TabsContent value="domain" className="mt-6">
          <DomainPanel customDomain={customDomain} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PwaPanel({ buildingId }: { buildingId: string }) {
  const manifestUrl = `/api/public/manifest/${buildingId}`;
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-serif text-lg">Installed app</h3>
      <p className="text-sm text-muted-foreground">
        This building has its own PWA manifest, so residents who install the app to their home
        screen see this community's name, icon, and theme color — not "OONAH".
      </p>
      <div className="rounded-md border border-border bg-muted/40 p-3 text-xs font-mono">
        {manifestUrl}
      </div>
      <p className="text-xs text-muted-foreground">
        Update app name, icon, splash and theme in the Identity and Appearance tabs — the manifest
        regenerates automatically on Publish.
      </p>
    </Card>
  );
}

function EmailPanel({ buildingId: _buildingId }: { buildingId: string }) {
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-serif text-lg">Email white-label</h3>
      <p className="text-sm text-muted-foreground">
        Sender name, reply-to, and footer text are stored on this building's branding and used
        whenever transactional email templates are enabled for this workspace.
      </p>
      <p className="text-xs text-muted-foreground">
        To connect a custom sender domain (e.g. <span className="font-mono">notify@yourcommunity.com</span>),
        an admin must first configure email infrastructure in Cloud → Emails. Once verified, this
        building's emails will use its own branded template.
      </p>
    </Card>
  );
}

function LegalPanel({
  buildingId,
  role,
}: {
  buildingId: string;
  role: "admin" | "manager";
}) {
  const to = role === "admin"
    ? `/admin/buildings/${buildingId}/legal`
    : `/manager/${buildingId}`;
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-serif text-lg">Legal & policies</h3>
      <p className="text-sm text-muted-foreground">
        Privacy policy, terms of use, house rules, pet policy, and other community documents are
        managed in the Legal Documents workspace.
      </p>
      <a
        href={to}
        className="text-sm text-primary underline underline-offset-4"
      >
        Open Legal Documents →
      </a>
    </Card>
  );
}

function DomainPanel({ customDomain }: { customDomain: string | null }) {
  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-serif text-lg">Custom domain</h3>
      {customDomain ? (
        <p className="text-sm">
          Connected: <span className="font-mono">{customDomain}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          No custom domain connected yet. Residents currently reach this community at the shared
          workspace URL.
        </p>
      )}
      <div className="rounded-md border border-border bg-muted/40 p-4 space-y-2 text-sm">
        <div className="font-medium">How to connect</div>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>Open Project Settings → Domains.</li>
          <li>Enter the domain (e.g. residents.yourbrand.com) and follow DNS instructions.</li>
          <li>SSL is provisioned automatically once DNS verifies.</li>
        </ol>
      </div>
    </Card>
  );
}
