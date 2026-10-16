import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/roles";
import { getPublicClubTypes } from "@/lib/club-type";
import { getActivePlans, getModules } from "@/lib/data/platform-pricing";
import { LandingHeader, SkipLink } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Hero } from "@/components/landing/hero";
import { SportsSection } from "@/components/landing/sports-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { MultiClub } from "@/components/landing/multi-club";
import { PricingSection } from "@/components/landing/pricing-section";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { JsonLd } from "@/components/landing/json-ld";

export const metadata: Metadata = pageMetadata({
  absoluteTitle: `${APP_NAME}: aplikasi manajemen klub olahraga`,
  description:
    "Aplikasi manajemen klub olahraga: kelola anggota, jadwal, booking fasilitas, tagihan, kasir, dan buku kas dalam satu tempat.",
  path: "/",
});

export default async function Home() {
  const session = await getSession();
  if (session) redirect(roleHome(session.app_role));
  const [plans, modules, clubTypes] = await Promise.all([getActivePlans(), getModules(), getPublicClubTypes()]);
  const trialDays = Math.max(0, ...plans.map((p) => p.trialDays));
  const readyModules = modules.filter((m) => m.status === "ready").map((m) => m.code);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink />
      <LandingHeader />
      <main id="konten" className="flex flex-1 flex-col">
        <Hero trialDays={trialDays} />
        <SportsSection types={clubTypes} readyModules={readyModules} />
        <FeaturesSection modules={modules} />
        <HowItWorks />
        <MultiClub plans={plans} />
        <PricingSection plans={plans} modules={modules} />
        <Faq plans={plans} />
        <FinalCta trialDays={trialDays} />
      </main>
      <LandingFooter />
      <JsonLd plans={plans} />
    </div>
  );
}
