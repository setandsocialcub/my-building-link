import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { renderMarkdownToHtml } from "@/lib/legal";
import { fetchLegalDocument, type LegalDocument } from "@/lib/legal";
import { fetchBuildingLegalDoc, type BuildingLegalDoc } from "@/lib/building-legal";

type ResolvedDoc = {
  scope: "building" | "platform";
  title: string;
  content: string;
  version: number;
};

type AcceptanceState = {
  privacy: ResolvedDoc | null;
  terms: ResolvedDoc | null;
  acceptedPrivacyVersion: number | null;
  acceptedTermsVersion: number | null;
};

/**
 * Renders a modal that blocks the app until the resident has accepted the
 * current Privacy Policy and Terms of Use. Never asks again unless one of
 * the documents has been re-published (version bumped).
 */
export function LegalAcceptanceGate({
  buildingId,
  residentProfileId,
  buildingName,
  onAccepted,
}: {
  buildingId: string;
  residentProfileId: string;
  buildingName?: string | null;
  onAccepted?: () => void;
}) {
  const [state, setState] = useState<AcceptanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [readPrivacy, setReadPrivacy] = useState(false);
  const [readTerms, setReadTerms] = useState(false);
  const [expanded, setExpanded] = useState<"privacy" | "terms" | null>(null);
  const [submitting, setSubmitting] = useState<null | "accept" | "decline">(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [buildingPrivacy, buildingTerms, platformPrivacy, platformTerms, profileRow] =
        await Promise.all([
          fetchBuildingLegalDoc(buildingId, "privacy"),
          fetchBuildingLegalDoc(buildingId, "terms"),
          fetchLegalDocument("privacy"),
          fetchLegalDocument("terms"),
          (supabase as any)
            .from("resident_profiles")
            .select("accepted_terms_version, accepted_privacy_version")
            .eq("id", residentProfileId)
            .maybeSingle(),
        ]);
      if (cancelled) return;
      setState({
        privacy: resolveDoc(buildingPrivacy, platformPrivacy, "Privacy Policy"),
        terms: resolveDoc(buildingTerms, platformTerms, "Terms of Use"),
        acceptedPrivacyVersion:
          (profileRow?.data as { accepted_privacy_version?: number | null } | null)
            ?.accepted_privacy_version ?? null,
        acceptedTermsVersion:
          (profileRow?.data as { accepted_terms_version?: number | null } | null)
            ?.accepted_terms_version ?? null,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, residentProfileId]);

  const needsAcceptance = useMemo(() => {
    if (!state) return false;
    const p = state.privacy;
    const t = state.terms;
    const privacyStale = p ? (state.acceptedPrivacyVersion ?? -1) < p.version : false;
    const termsStale = t ? (state.acceptedTermsVersion ?? -1) < t.version : false;
    return privacyStale || termsStale;
  }, [state]);

  if (loading || !state || !needsAcceptance) return null;

  const canAccept = readPrivacy && readTerms && !submitting;

  const acceptAll = async () => {
    if (!state.privacy || !state.terms) return;
    setSubmitting("accept");
    const now = new Date().toISOString();
    const { error } = await (supabase as any)
      .from("resident_profiles")
      .update({
        accepted_privacy_at: now,
        accepted_privacy_version: state.privacy.version,
        accepted_terms_at: now,
        accepted_terms_version: state.terms.version,
      })
      .eq("id", residentProfileId);
    setSubmitting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Thanks — welcome in.");
    onAccepted?.();
    setState(null);
  };

  const declineAll = async () => {
    setSubmitting("decline");
    await supabase.auth.signOut();
    setSubmitting(null);
    if (typeof window !== "undefined") window.location.href = "/";
  };

  return (
    <Dialog open onOpenChange={() => { /* blocking */ }}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary grid place-items-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Welcome to OONAH
              </p>
              <h2 className="font-serif text-2xl font-semibold leading-tight">
                Please review &amp; accept
              </h2>
              {buildingName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  For your community at {buildingName}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {(["privacy", "terms"] as const).map((slug) => {
            const doc = slug === "privacy" ? state.privacy : state.terms;
            const readFlag = slug === "privacy" ? readPrivacy : readTerms;
            const setRead = slug === "privacy" ? setReadPrivacy : setReadTerms;
            if (!doc) return null;
            const isOpen = expanded === slug;
            return (
              <div key={slug} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <Checkbox
                    id={`accept-${slug}`}
                    checked={readFlag}
                    onCheckedChange={(v) => setRead(v === true)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={`accept-${slug}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      I have read and accept the {doc.title}
                    </label>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Version {doc.version} · {doc.scope === "building" ? "Building-specific" : "Platform"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(isOpen ? null : slug)}
                  >
                    {isOpen ? "Hide" : "Read more"}
                  </Button>
                </div>
                {isOpen && (
                  <ScrollArea className="max-h-[280px] border-t border-border bg-muted/30">
                    <div
                      className="p-5 text-sm leading-relaxed prose prose-sm prose-neutral dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(doc.content) }}
                    />
                  </ScrollArea>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-border bg-muted/20 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground max-w-xs">
            Your acceptance is timestamped. You'll only see this again if the documents are updated.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={declineAll}
              disabled={submitting !== null}
            >
              {submitting === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline"}
            </Button>
            <Button type="button" onClick={acceptAll} disabled={!canAccept}>
              {submitting === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept & continue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function resolveDoc(
  building: BuildingLegalDoc | null,
  platform: LegalDocument | null,
  fallbackTitle: string,
): ResolvedDoc | null {
  if (building) {
    return {
      scope: "building",
      title: building.title || fallbackTitle,
      content: building.content,
      version: building.version,
    };
  }
  if (platform) {
    return {
      scope: "platform",
      title: platform.title || fallbackTitle,
      content: platform.content,
      version: platform.version,
    };
  }
  return null;
}
