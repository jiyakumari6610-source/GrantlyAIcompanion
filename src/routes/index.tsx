import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/grantly/pages/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grantly AI — Your Future Deserves Funding" },
      { name: "description", content: "AI-powered scholarship discovery, eligibility matching, document intelligence and application tracking for Indian students." },
      { property: "og:title", content: "Grantly AI — Your Future Deserves Funding" },
      { property: "og:description", content: "AI-powered scholarship discovery, eligibility matching, document intelligence and application tracking for Indian students." },
    ],
  }),
  component: LandingPage,
});
