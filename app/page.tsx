import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/roles";
import { getPublicClubTypes } from "@/lib/club-type";
import { getActivePlans } from "@/lib/data/platform-pricing";
import { LandingHeader, SkipLink } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Hero } from "@/components/landing/hero";
import { PricingSection } from "@/components/landing/pricing-section";
import { FreeSection } from "@/components/landing/free-section";
import { SportsSection } from "@/components/landing/sports-section";
import { JoinSection } from "@/components/landing/join-section";
import { BusinessSection } from "@/components/landing/business-section";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { JsonLd } from "@/components/landing/json-ld";

export const metadata: Metadata = pageMetadata({
  absoluteTitle: `${APP_NAME}: catat latihan, ajak teman, gabung klub`,
  description:
    "Akun gratis untuk mencatat latihan, berteman, ikut peringkat dan tantangan, dan bergabung ke klub dengan kode, untuk banyak olahraga. Punya klub? Kelola anggota, jadwal, booking fasilitas, tagihan, kasir, dan buku kas dari akun yang sama.",
  path: "/",
});

export default async function Home() {
  const session = await getSession();
  if (session) redirect(roleHome(session.app_role));
  const [plans, clubTypes] = await Promise.all([getActivePlans(), getPublicClubTypes()]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink />
      <LandingHeader />
      <main id="konten" className="flex flex-1 flex-col">
        <Hero sports={clubTypes.filter((t) => t.status === "ready")} />
        <FreeSection />
        <SportsSection types={clubTypes} />
        <JoinSection />
        <BusinessSection types={clubTypes} />
        <PricingSection plans={plans} />
        <Faq plans={plans} />
      </main>
      <div className="dark bg-background text-foreground">
        <FinalCta />
        <LandingFooter />
      </div>
      <JsonLd plans={plans} />
    </div>
  );
}
