import { createFileRoute } from "@tanstack/react-router";
import { LegalDocView } from "@/components/LegalDocView";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Residence" },
      {
        name: "description",
        content:
          "How Residence collects, uses, and protects resident data, and the privacy controls available to you.",
      },
    ],
  }),
  component: () => <LegalDocView slug="privacy" fallbackTitle="Privacy Policy" />,
});
