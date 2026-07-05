import { createFileRoute } from "@tanstack/react-router";

import { BrandingEditor } from "@/components/BrandingEditor";

export const Route = createFileRoute("/admin/buildings/$buildingId/branding")({
  head: () => ({
    meta: [
      { title: "Building Branding — Super Admin" },
      { name: "description", content: "Configure white-label branding for a building." },
    ],
  }),
  component: AdminBrandingPage,
});

function AdminBrandingPage() {
  const { buildingId } = Route.useParams();
  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Branding</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">White label branding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the branded resident experience for this building. Branding is isolated —
          residents only see their own building's branding.
        </p>
      </header>
      <BrandingEditor buildingId={buildingId} />
    </div>
  );
}
