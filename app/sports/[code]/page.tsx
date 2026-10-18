import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { getPublicClubTypes } from "@/lib/club-type";
import { getActivePlans, getModules } from "@/lib/data/platform-pricing";
import { pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { JsonLdScript } from "@/components/landing/json-ld";
import { describe } from "@/components/landing/sport-copy";
import { SportPage } from "@/components/landing/sport-page";

async function load(code: string) {
  const [types, modules, plans] = await Promise.all([getPublicClubTypes(), getModules(), getActivePlans()]);
  const type = types.find((t) => t.code === code && t.status === "ready");
  return { type, others: types.filter((t) => t.status === "ready" && t.code !== code), modules, plans };
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const { type, modules } = await load(code);
  if (!type) return { title: "Halaman tidak ditemukan", robots: { index: false } };
  const ready = new Set(modules.filter((m) => m.status === "ready").map((m) => m.code));
  return pageMetadata({
    title: `Aplikasi manajemen ${type.name}`,
    description: `Aplikasi manajemen ${type.name} di ${APP_NAME}: ${describe(type, ready)}.`,
    path: `/sports/${type.code}`,
  });
}

export default async function SportRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { type, others, modules, plans } = await load(code);
  if (!type) notFound();
  const trialDays = Math.max(0, ...plans.map((p) => p.trialDays));
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: APP_NAME, item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Olahraga", item: `${SITE_URL}/#olahraga` },
      { "@type": "ListItem", position: 3, name: type.name, item: `${SITE_URL}/sports/${type.code}` },
    ],
  };
  return (
    <>
      <SportPage type={type} others={others} modules={modules} trialDays={trialDays} />
      <JsonLdScript data={breadcrumb} />
    </>
  );
}
