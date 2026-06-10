import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  LEGAL_META,
  fetchLegalDocument,
  type LegalDocument,
  type LegalSlug,
} from "@/lib/legal";

export const Route = createFileRoute("/admin/legal")({
  component: AdminLegalRoute,
});

const SLUGS: LegalSlug[] = ["privacy", "terms", "community-standards"];

function AdminLegalRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "denied" | "ok">("loading");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/super-admin-login" });
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setState(role ? "ok" : "denied");
    })();
  }, [navigate]);

  if (state === "loading") {
    return (
      <main className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="min-h-screen grid place-items-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need a Super Admin account to manage legal content.
          </p>
          <Button asChild className="mt-4">
            <Link to="/super-admin-login">Sign in as admin</Link>
          </Button>
        </div>
      </main>
    );
  }

  return <AdminLegalEditor />;
}

function AdminLegalEditor() {
  const [active, setActive] = useState<LegalSlug>("privacy");

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-10">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>

        <header className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Super Admin · Legal
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Legal & Compliance
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Edit the Privacy Policy, Terms of Use, and Community Standards. Saving
            publishes a new version — the version number is incremented and the
            last updated date is reset.
          </p>
        </header>

        <div className="flex flex-wrap gap-2 mb-6">
          {SLUGS.map((slug) => (
            <button
              key={slug}
              onClick={() => setActive(slug)}
              className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${
                active === slug
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {LEGAL_META[slug].title}
            </button>
          ))}
        </div>

        <LegalDocEditor key={active} slug={active} />
      </div>
    </main>
  );
}

function LegalDocEditor({ slug }: { slug: LegalSlug }) {
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLegalDocument(slug).then((d) => {
      if (cancelled) return;
      setDoc(d);
      setTitle(d?.title ?? LEGAL_META[slug].title);
      setContent(d?.content ?? "");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const dirty = useMemo(
    () => !!doc && (title !== doc.title || content !== doc.content),
    [doc, title, content],
  );

  const save = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required.");
      return;
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const nextVersion = (doc?.version ?? 0) + 1;

    // Mark all prior versions for this slug as not current, then insert a new current row.
    const updates = (supabase as any)
      .from("legal_documents")
      .update({ is_current: false })
      .eq("slug", slug)
      .eq("is_current", true);
    const { error: clearErr } = await updates;
    if (clearErr) {
      setSaving(false);
      toast.error(clearErr.message);
      return;
    }

    const { data: inserted, error: insErr } = await (supabase as any)
      .from("legal_documents")
      .insert({
        slug,
        version: nextVersion,
        title: title.trim(),
        content,
        is_current: true,
        updated_by: auth?.user?.id ?? null,
      })
      .select("id, slug, version, title, content, updated_at")
      .single();
    setSaving(false);
    if (insErr || !inserted) {
      toast.error(insErr?.message ?? "Could not save.");
      return;
    }
    setDoc(inserted as LegalDocument);
    toast.success(`Published version ${(inserted as LegalDocument).version}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 font-medium">
            Version {doc?.version ?? 1}
          </span>
          {doc && (
            <span>
              · Last updated{" "}
              {new Date(doc.updated_at).toLocaleString()}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="legal-title">Title</Label>
          <Input
            id="legal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="legal-content">
            Content <span className="text-muted-foreground font-normal">(Markdown — # ## ### - **bold**)</span>
          </Label>
          <Textarea
            id="legal-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="font-mono text-sm min-h-[420px]"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Link
            to={LEGAL_META[slug].route}
            className="text-sm text-muted-foreground hover:text-foreground"
            target="_blank"
          >
            Preview live page →
          </Link>
          <Button onClick={save} disabled={saving || !dirty} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Publish new version
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
