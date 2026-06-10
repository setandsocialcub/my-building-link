import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import {
  fetchLegalDocument,
  renderMarkdownToHtml,
  type LegalDocument,
  type LegalSlug,
} from "@/lib/legal";
import { LegalFooter } from "@/components/LegalFooter";

export function LegalDocView({
  slug,
  fallbackTitle,
}: {
  slug: LegalSlug;
  fallbackTitle: string;
}) {
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLegalDocument(slug).then((d) => {
      if (cancelled) return;
      setDoc(d);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !doc ? (
          <div>
            <h1 className="font-serif text-3xl">{fallbackTitle}</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              This document hasn't been published yet. Please check back soon.
            </p>
          </div>
        ) : (
          <article>
            <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 font-medium">
                Version {doc.version}
              </span>
              <span>·</span>
              <span>
                Last updated{" "}
                {new Date(doc.updated_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div
              className="text-sm text-foreground/90"
              // Renderer escapes user-controlled text; only allows the limited
              // markdown subset documented in src/lib/legal.ts.
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(doc.content) }}
            />
          </article>
        )}

        <LegalFooter />
      </div>
    </main>
  );
}
