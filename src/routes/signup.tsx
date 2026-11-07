import { createFileRoute } from "@tanstack/react-router";
import { SignupPage } from "@/grantly/pages/SignupPage";
import { GuestRoute } from "@/grantly/AppLayout";

export const Route = createFileRoute("/signup")({
  ssr: false,
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
