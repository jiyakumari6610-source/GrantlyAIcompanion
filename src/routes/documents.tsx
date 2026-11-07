import { createFileRoute } from "@tanstack/react-router";
import { DocumentsPage } from "@/grantly/pages/DocumentsPage";
import { ProtectedApp } from "@/grantly/AppLayout";

export const Route = createFileRoute("/documents")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Document Intelligence — Grantly AI" },
      { name: "description", content: "Upload and AI-check your scholarship documents in a private vault." },
      { property: "og:title", content: "Document Intelligence — Grantly AI" },
      { property: "og:description", content: "Upload and AI-check your scholarship documents in a private vault." },
    ],
  }),
  component: () => (
    <ProtectedApp>
      <DocumentsPage />
    </ProtectedApp>
  ),
});
