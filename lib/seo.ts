import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";

export function pageMetadata({
  title,
  absoluteTitle,
  description,
  path,
}: {
  title?: string;
  absoluteTitle?: string;
  description: string;
  path: string;
}): Metadata {
  const shown = absoluteTitle ?? `${title} · ${APP_NAME}`;
  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "id_ID", siteName: APP_NAME, title: shown, description, url: path },
    twitter: { card: "summary_large_image", title: shown, description },
  };
}
