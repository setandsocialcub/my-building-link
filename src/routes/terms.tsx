import { createFileRoute } from "@tanstack/react-router";
import { LegalDocView } from "@/components/LegalDocView";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Residence" },
      {
        name: "description",
        content: "The terms that govern your use of the Residence platform.",
      },
    ],
  }),
  component: () => <LegalDocView slug="terms" fallbackTitle="Terms of Use" />,
});
