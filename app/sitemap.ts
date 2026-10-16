import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const LANDING_UPDATED = "2026-10-16";
const LEGAL_UPDATED = "2026-10-12";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: LANDING_UPDATED },
    { url: `${SITE_URL}/daftar`, lastModified: LANDING_UPDATED },
    { url: `${SITE_URL}/privasi`, lastModified: LEGAL_UPDATED },
    { url: `${SITE_URL}/syarat`, lastModified: LEGAL_UPDATED },
  ];
}
