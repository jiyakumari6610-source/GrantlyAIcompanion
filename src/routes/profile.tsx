import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/grantly/pages/ProfilePage";
import { ProtectedApp } from "@/grantly/AppLayout";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Profile — Grantly AI" },
      { name: "description", content: "Manage your student profile used for scholarship matching." },
      { property: "og:title", content: "Profile — Grantly AI" },
      { property: "og:description", content: "Manage your student profile used for scholarship matching." },
    ],
  }),
  component: () => (
    <ProtectedApp>
      <ProfilePage />
    </ProtectedApp>
  ),
});
