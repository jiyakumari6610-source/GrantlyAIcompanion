import { createFileRoute } from "@tanstack/react-router";
import { SignupPage } from "@/grantly/pages/SignupPage";
import { GuestRoute } from "@/grantly/AppLayout";

export const Route = createFileRoute("/signup")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    error_description: typeof search.error_description === "string" ? search.error_description : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Create account — Grantly AI" },
      { name: "description", content: "Create your free Grantly AI account and start matching with scholarships." },
      { property: "og:title", content: "Create account — Grantly AI" },
      { property: "og:description", content: "Create your free Grantly AI account and start matching with scholarships." },
    ],
  }),
  component: () => (
    <GuestRoute>
      <SignupPage />
    </GuestRoute>
  ),
});
