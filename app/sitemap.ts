import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/daftar`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privasi`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/syarat`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
