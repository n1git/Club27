import { headers } from "next/headers";
import { APP_NAME } from "@/lib/config";
import type { PricingPlan } from "@/lib/pricing";
import { LEGAL_OPERATORS, LEGAL_OPERATORS_URL } from "@/lib/legal";
import { getContact, SITE_URL } from "@/lib/site";

export async function JsonLdScript({ data }: { data: unknown }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export async function JsonLd({ plans }: { plans: PricingPlan[] }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const contact = getContact();
  const organizationId = `${SITE_URL}/#organization`;
  const organization = {
    "@type": "Organization",
    "@id": organizationId,
    name: APP_NAME,
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/brand/logo-a-on-light.png`, width: 1200, height: 600 },
    parentOrganization: { "@type": "Organization", name: LEGAL_OPERATORS, url: LEGAL_OPERATORS_URL },
    ...(contact.email || contact.whatsapp
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            availableLanguage: "id",
            ...(contact.email ? { email: contact.email } : {}),
            ...(contact.whatsapp ? { telephone: `+${contact.whatsapp}` } : {}),
          },
        }
      : {}),
  };
  const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: APP_NAME,
    url: `${SITE_URL}/`,
    inLanguage: "id",
    publisher: { "@id": organizationId },
  };
  const application = {
    "@type": "SoftwareApplication",
    name: APP_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}/`,
    inLanguage: "id",
    publisher: { "@id": organizationId },
    description:
      "Satu aplikasi untuk mengelola klub olahraga: anggota, jadwal dan booking fasilitas, tagihan, kasir, dan buku kas.",
    offers: plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      priceCurrency: "IDR",
      price: p.pricePerUserMonth,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: p.pricePerUserMonth,
        priceCurrency: "IDR",
        unitText: "seat per bulan",
      },
      url: `${SITE_URL}/signup?plan=${p.code}`,
    })),
  };
  const data = { "@context": "https://schema.org", "@graph": [organization, website, application] };
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
