import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Save, Eye, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { renderMarkdownToHtml } from "@/lib/legal";
import {
  BUILDING_LEGAL_META,
  BUILDING_LEGAL_ORDER,
  fetchBuildingLegalDocs,
  publishBuildingLegalDoc,
  type BuildingLegalDoc,
  type BuildingLegalType,
} from "@/lib/building-legal";

export const Route = createFileRoute("/admin/buildings/$buildingId/legal")({
  head: () => ({ meta: [{ title: "Legal Center — Building Admin" }] }),
  component: LegalCenter,
});

function LegalCenter() {
  const { buildingId } = Route.useParams();
  const [active, setActive] = useState<BuildingLegalType>("privacy");
  const [docs, setDocs] = useState<Record<BuildingLegalType, BuildingLegalDoc | null>>(
    {} as Record<BuildingLegalType, BuildingLegalDoc | null>,
  );
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const rows = await fetchBuildingLegalDocs(buildingId);
    const map = {} as Record<BuildingLegalType, BuildingLegalDoc | null>;
    for (const t of BUILDING_LEGAL_ORDER) map[t] = null;
    for (const r of rows) map[r.doc_type] = r;
    setDocs(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  return (
    <div className="max-w-[1400px]">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Legal Center</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
          Documents for this building
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Publish and version building-specific policies. Residents accept updated Privacy Policy
          and Terms of Use the next time they open the app.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <nav className="rounded-2xl border border-border bg-card p-2 shadow-sm self-start">
          {BUILDING_LEGAL_ORDER.map((type) => {
            const meta = BUILDING_LEGAL_META[type];
            const doc = docs[type];
            const isActive = active === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActive(type)}
                className={cn(
                  "w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <span className="text-lg leading-none pt-0.5">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{meta.title}</span>
                    {meta.required && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/40 text-primary">
                        Required
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {doc ? `v${doc.version} · ${new Date(doc.updated_at).toLocaleDateString()}` : "Not published"}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {loading ? (
            <div className="grid place-items-center py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <DocEditor
              key={active}
              buildingId={buildingId}
              docType={active}
              current={docs[active] ?? null}
              onSaved={(d) => setDocs((prev) => ({ ...prev, [active]: d }))}
            />
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-5 flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 text-primary p-2">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="text-sm text-muted-foreground">
          Building documents apply only to residents of this building. Platform-wide legal
          content lives in the{" "}
          <Link to="/admin/legal" className="underline text-foreground">
            platform legal library
          </Link>
          .
        </div>
      </div>
    </div>
  );
}

function DocEditor({
  buildingId,
  docType,
  current,
  onSaved,
}: {
  buildingId: string;
  docType: BuildingLegalType;
  current: BuildingLegalDoc | null;
  onSaved: (doc: BuildingLegalDoc) => void;
}) {
  const meta = BUILDING_LEGAL_META[docType];
  const [title, setTitle] = useState(current?.title ?? meta.title);
  const [content, setContent] = useState(current?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setTitle(current?.title ?? meta.title);
    setContent(current?.content ?? "");
    setPreview(false);
  }, [current, meta.title]);

  const dirty = useMemo(() => {
    if (!current) return title.trim().length > 0 || content.trim().length > 0;
    return title !== current.title || content !== current.content;
  }, [current, title, content]);

  const save = async () => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!content.trim()) {
      toast.error("Content is required.");
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const next = await publishBuildingLegalDoc({
        buildingId,
        docType,
        title,
        content,
        currentVersion: current?.version ?? 0,
        userId: auth.user?.id ?? null,
      });
      onSaved(next);
      toast.success(`Published ${meta.title} v${next.version}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="p-6 border-b border-border flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">{meta.icon}</span>
            <h2 className="font-serif text-2xl font-semibold">{meta.title}</h2>
            {current ? (
              <Badge variant="secondary">
                v{current.version} · Updated {new Date(current.updated_at).toLocaleDateString()}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Draft
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{meta.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setPreview((p) => !p)}
          >
            <Eye className="h-4 w-4" />
            {preview ? "Edit" : "Preview"}
          </Button>
          <Button onClick={save} disabled={saving || !dirty} className="gap-2" size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {current ? "Publish new version" : "Publish"}
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="p-8">
          <article
            className="prose prose-neutral dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content) }}
          />
          {!content && (
            <p className="text-sm text-muted-foreground italic">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-content">
              Content{" "}
              <span className="text-muted-foreground font-normal">
                (Markdown — # ## ### - **bold**)
              </span>
            </Label>
            <Textarea
              id="doc-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-sm min-h-[440px]"
              placeholder={`# ${meta.title}\n\nWrite the policy for your residents here.`}
            />
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Residents see the published version — drafts stay private until you publish.
          </p>
        </div>
      )}
    </section>
  );
}
