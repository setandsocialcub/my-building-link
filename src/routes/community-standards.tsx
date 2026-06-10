import { createFileRoute } from "@tanstack/react-router";
import { LegalDocView } from "@/components/LegalDocView";

export const Route = createFileRoute("/community-standards")({
  head: () => ({
    meta: [
      { title: "Community Standards — Residence" },
      {
        name: "description",
        content:
          "How we keep Residence safe, respectful, and useful for every neighbor.",
      },
    ],
  }),
  component: () => (
    <LegalDocView slug="community-standards" fallbackTitle="Community Standards" />
  ),
});
