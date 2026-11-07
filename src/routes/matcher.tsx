import { createFileRoute } from "@tanstack/react-router";
import { MatcherPage } from "@/grantly/pages/MatcherPage";
import { ProtectedApp } from "@/grantly/AppLayout";

export const Route = createFileRoute("/matcher")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AI Matcher — Grantly AI" },
      { name: "description", content: "See how your profile matches every verified scholarship." },
      { property: "og:title", content: "AI Matcher — Grantly AI" },
      { property: "og:description", content: "See how your profile matches every verified scholarship." },
    ],
  }),
  component: () => (
    <ProtectedApp>
      <MatcherPage />
    </ProtectedApp>
  ),
});
