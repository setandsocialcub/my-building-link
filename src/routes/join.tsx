import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/resident-access",
      search: { code: search.code },
    });
  },
});
