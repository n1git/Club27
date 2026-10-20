import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { getPublicClubTypes } from "@/lib/club-type";
import { getActivePlans, getModules } from "@/lib/data/platform-pricing";
import { pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { JsonLdScript } from "@/components/landing/json-ld";
import { commonFaq, sportContent } from "@/components/landing/sport-content";
import { SportPage } from "@/components/landing/sport-page";

async function load(code: string) {
  const [types, modules, plans] = await Promise.all([getPublicClubTypes(), getModules(), getActivePlans()]);
  const type = types.find((t) => t.code === code && t.status === "ready");
  const ready = new Set(modules.filter((m) => m.status === "ready").map((m) => m.code));
  const has = (module: string) => !!type && type.modules.includes(module) && ready.has(module);
  return { type, others: types.filter((t) => t.status === "ready" && t.code !== code), modules, plans, has };
}

function summary(tagline: string, intro: string) {
  const first = intro.split(/(?<=\.)\s/)[0];
  const full = `${tagline} ${first}`;
  return full.length <= 160 ? full : tagline;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const { type, has } = await load(code);
  if (!type) return { title: "Halaman tidak ditemukan", robots: { index: false } };
  const content = sportContent(type, has);
  return pageMetadata({
    title: `Aplikasi Manajemen ${type.name}`,
    description: summary(content.tagline, content.intro),
    path: `/s/${type.code}`,
  });
}

export default async function SportRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { type, others, modules, plans, has } = await load(code);
  if (!type) notFound();
  const content = sportContent(type, has);
  const faq = [...content.faq, ...commonFaq(type, plans)];
  const url = `${SITE_URL}/s/${type.code}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: APP_NAME, item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Olahraga", item: `${SITE_URL}/s` },
          { "@type": "ListItem", position: 3, name: type.name, item: url },
        ],
      },
      {
        "@type": "WebPage",
        "@id": `${url}#page`,
        url,
        name: `Aplikasi Manajemen ${type.name}`,
        description: content.tagline,
        inLanguage: "id",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${url}#app` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#app`,
        name: `${APP_NAME} untuk ${type.name}`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "id",
        url,
        description: content.intro,
        publisher: { "@id": `${SITE_URL}/#organization` },
        offers: plans.map((p) => ({
          "@type": "Offer",
          name: p.name,
          priceCurrency: "IDR",
          price: p.pricePerUserMonth,
          url: `${SITE_URL}/signup?jenis=${type.code}`,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
  return (
    <>
      <SportPage type={type} others={others} modules={modules} plans={plans} />
      <JsonLdScript data={data} />
    </>
  );
}
