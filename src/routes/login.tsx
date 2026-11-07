import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/grantly/pages/LoginPage";
import { GuestRoute } from "@/grantly/AppLayout";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Grantly AI" },
      { name: "description", content: "Sign in to your Grantly AI scholarship workspace." },
      { property: "og:title", content: "Sign in — Grantly AI" },
      { property: "og:description", content: "Sign in to your Grantly AI scholarship workspace." },
    ],
  }),
  component: () => (
    <GuestRoute>
      <LoginPage />
    </GuestRoute>
  ),
});
