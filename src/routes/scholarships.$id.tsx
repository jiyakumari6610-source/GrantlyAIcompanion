import { createFileRoute } from "@tanstack/react-router";
import { ScholarshipDetailPage } from "@/grantly/pages/ScholarshipDetailPage";
import { AppLayout } from "@/grantly/AppLayout";

export const Route = createFileRoute("/scholarships/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Scholarship details — Grantly AI" },
      { name: "description", content: "Eligibility, required documents and application steps for this scholarship." },
      { property: "og:title", content: "Scholarship details — Grantly AI" },
      { property: "og:description", content: "Eligibility, required documents and application steps for this scholarship." },
    ],
  }),
  component: () => (
    <AppLayout>
      <ScholarshipDetailPage />
    </AppLayout>
  ),
});
