import type { MetadataRoute } from "next";
import { getPublicClubTypes } from "@/lib/club-type";
import { SITE_URL } from "@/lib/site";

const LANDING_UPDATED = "2026-10-16";
const LEGAL_UPDATED = "2026-10-12";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const types = (await getPublicClubTypes()).filter((t) => t.status === "ready");
  return [
    { url: `${SITE_URL}/`, lastModified: LANDING_UPDATED },
    ...types.map((t) => ({ url: `${SITE_URL}/olahraga/${t.code}`, lastModified: LANDING_UPDATED })),
    { url: `${SITE_URL}/daftar`, lastModified: LANDING_UPDATED },
    { url: `${SITE_URL}/privasi`, lastModified: LEGAL_UPDATED },
    { url: `${SITE_URL}/syarat`, lastModified: LEGAL_UPDATED },
  ];
}
