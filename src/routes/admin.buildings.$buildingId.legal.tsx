import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/buildings/$buildingId/legal")({
  head: () => ({ meta: [{ title: "Legal Documents — Building Admin" }] }),
  component: LegalPage,
});

function LegalPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Legal Documents</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Terms, privacy & community standards</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Legal documents are managed at the platform level and apply to all buildings. Manage current versions in the legal library.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 text-primary p-2">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-medium">Platform legal library</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Terms of Service, Privacy Policy, and Community Standards are versioned centrally so residents accept the current text.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/admin/legal">Open legal library <ExternalLink className="h-3.5 w-3.5" /></Link>
        </Button>
      </section>
    </div>
  );
}
