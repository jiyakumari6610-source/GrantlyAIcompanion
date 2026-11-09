import { createFileRoute } from "@tanstack/react-router";
import { OnboardingPage } from "@/grantly/pages/OnboardingPage";
import { ProtectedRoute } from "@/grantly/components/ProtectedRoute";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    error_description: typeof search.error_description === "string" ? search.error_description : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Set up your profile — Grantly AI" },
      { name: "description", content: "Tell Grantly AI about your studies so we can match you with scholarships." },
      { property: "og:title", content: "Set up your profile — Grantly AI" },
      { property: "og:description", content: "Tell Grantly AI about your studies so we can match you with scholarships." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <OnboardingPage />
    </ProtectedRoute>
  ),
});
