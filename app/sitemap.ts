import type { MetadataRoute } from "next";
import { getPublicClubTypes } from "@/lib/club-type";
import { SITE_URL } from "@/lib/site";

const LANDING_UPDATED = "2026-10-21";
const LEGAL_UPDATED = "2026-10-20";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const types = (await getPublicClubTypes()).filter((t) => t.status === "ready");
  return [
    { url: `${SITE_URL}/`, lastModified: LANDING_UPDATED },
    { url: `${SITE_URL}/s`, lastModified: LANDING_UPDATED },
    ...types.map((t) => ({ url: `${SITE_URL}/s/${t.code}`, lastModified: LANDING_UPDATED })),
    { url: `${SITE_URL}/signup`, lastModified: LANDING_UPDATED },
    { url: `${SITE_URL}/privacy`, lastModified: LEGAL_UPDATED },
    { url: `${SITE_URL}/terms`, lastModified: LEGAL_UPDATED },
  ];
}
