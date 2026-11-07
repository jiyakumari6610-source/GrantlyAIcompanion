import { createFileRoute } from "@tanstack/react-router";
import { ApplicationsPage } from "@/grantly/pages/ApplicationsPage";
import { ProtectedApp } from "@/grantly/AppLayout";

export const Route = createFileRoute("/applications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Applications — Grantly AI" },
      { name: "description", content: "Track every scholarship application from saved to awarded." },
      { property: "og:title", content: "Applications — Grantly AI" },
      { property: "og:description", content: "Track every scholarship application from saved to awarded." },
    ],
  }),
  component: () => (
    <ProtectedApp>
      <ApplicationsPage />
    </ProtectedApp>
  ),
});
