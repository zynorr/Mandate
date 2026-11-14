import type { MetadataRoute } from "next";
import { getAppConfig } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppConfig().auth.publicUrl ?? "http://localhost:3000";
  return [
    {
      url: new URL("/", baseUrl).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
