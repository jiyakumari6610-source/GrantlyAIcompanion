import { createFileRoute } from "@tanstack/react-router";
import { ScholarshipsPage } from "@/grantly/pages/ScholarshipsPage";
import { AppLayout } from "@/grantly/AppLayout";

export const Route = createFileRoute("/scholarships/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Scholarships — Grantly AI" },
      { name: "description", content: "Browse verified Indian government and institutional scholarships." },
      { property: "og:title", content: "Scholarships — Grantly AI" },
      { property: "og:description", content: "Browse verified Indian government and institutional scholarships." },
    ],
  }),
  component: () => (
    <AppLayout>
      <ScholarshipsPage />
    </AppLayout>
  ),
});
