import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/grantly/pages/DashboardPage";
import { ProtectedApp } from "@/grantly/AppLayout";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    error_description: typeof search.error_description === "string" ? search.error_description : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Dashboard — Grantly AI" },
      { name: "description", content: "Your scholarship matches, deadlines and funding gap at a glance." },
      { property: "og:title", content: "Dashboard — Grantly AI" },
      { property: "og:description", content: "Your scholarship matches, deadlines and funding gap at a glance." },
    ],
  }),
  component: () => (
    <ProtectedApp>
      <DashboardPage />
    </ProtectedApp>
  ),
});
