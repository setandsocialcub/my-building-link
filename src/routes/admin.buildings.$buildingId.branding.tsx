import { createFileRoute } from "@tanstack/react-router";

import { WhiteLabelStudio } from "@/components/WhiteLabelStudio";

export const Route = createFileRoute("/admin/buildings/$buildingId/branding")({
  head: () => ({
    meta: [
      { title: "White Label Studio — Super Admin" },
      { name: "description", content: "Configure enterprise white-label branding for a building." },
    ],
  }),
  component: AdminBrandingPage,
});

function AdminBrandingPage() {
  const { buildingId } = Route.useParams();
  return (
    <div className="max-w-[1400px]">
      <WhiteLabelStudio buildingId={buildingId} role="admin" />
    </div>
  );
}
