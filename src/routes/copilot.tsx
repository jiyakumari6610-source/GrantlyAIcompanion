import { createFileRoute } from "@tanstack/react-router";
import { CopilotPage } from "@/grantly/pages/CopilotPage";
import { ProtectedApp } from "@/grantly/AppLayout";

export const Route = createFileRoute("/copilot")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Copilot — Grantly AI" },
      { name: "description", content: "Ask Grantly Copilot about eligibility, documents and deadlines in English or Hindi." },
      { property: "og:title", content: "Copilot — Grantly AI" },
      { property: "og:description", content: "Ask Grantly Copilot about eligibility, documents and deadlines in English or Hindi." },
    ],
  }),
  component: () => (
    <ProtectedApp>
      <CopilotPage />
    </ProtectedApp>
  ),
});
