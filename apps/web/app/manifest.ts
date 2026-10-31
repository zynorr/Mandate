import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mandate — Agent authorization evidence",
    short_name: "Mandate",
    description:
      "Review approved agent intents against BOT Chain evidence.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f7f3eb",
    theme_color: "#003626",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
