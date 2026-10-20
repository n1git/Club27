import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { getPublicClubTypes } from "@/lib/club-type";
import { getModules } from "@/lib/data/platform-pricing";
import { pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { JsonLdScript } from "@/components/landing/json-ld";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader, SkipLink } from "@/components/landing/landing-header";
import { sportContent } from "@/components/landing/sport-content";
import { Wrap } from "@/components/landing/wrap";

const short = (name: string) => name.replace(/^(Klub|Studio)\s+/, "");

export async function generateMetadata(): Promise<Metadata> {
  const list = (await getPublicClubTypes()).filter((t) => t.status === "ready");
  const names = list.map((t) => short(t.name));
  const base = pageMetadata({
    title: `Aplikasi Manajemen Klub: ${names.slice(0, 4).join(", ")}, dan Lainnya`,
    description: `Ruzz mendukung ${list.length} jenis olahraga: ${names.slice(0, 10).join(", ")}${names.length > 10 ? ", dan lainnya" : ""}. Pilih olahraga Anda dan lihat fitur yang tersedia.`,
    path: "/s",
  });
  const image = { url: "/opengraph-image", width: 1200, height: 630 };
  return { ...base, openGraph: { ...base.openGraph, images: [image] }, twitter: { ...base.twitter, images: [image] } };
}

export default async function SportsIndex() {
  const [types, modules] = await Promise.all([getPublicClubTypes(), getModules()]);
  const ready = new Set(modules.filter((m) => m.status === "ready").map((m) => m.code));
  const list = types.filter((t) => t.status === "ready");
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: APP_NAME, item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Olahraga", item: `${SITE_URL}/s` },
        ],
      },
      {
        "@type": "CollectionPage",
        name: `Olahraga yang didukung ${APP_NAME}`,
        url: `${SITE_URL}/s`,
        inLanguage: "id",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: list.length,
          itemListElement: list.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: t.name,
            url: `${SITE_URL}/s/${t.code}`,
          })),
        },
      },
    ],
  };
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink />
      <LandingHeader />
      <main id="konten" className="flex flex-1 flex-col">
        <section aria-labelledby="olahraga-judul" className="pb-16 pt-8 sm:pb-24">
          <Wrap>
            <nav aria-label="Jejak halaman" className="text-sm text-muted-foreground">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link href="/" className="hover:text-foreground hover:underline">
                    Beranda
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li aria-current="page">Olahraga</li>
              </ol>
            </nav>
            <h1 id="olahraga-judul" className="mt-6 max-w-[20ch] text-balance font-display text-[44px] uppercase leading-[0.98] sm:text-6xl lg:text-[72px]">
              Satu aplikasi untuk {list.length} olahraga.
            </h1>
            <p className="mt-5 max-w-[56ch] text-pretty text-lg text-muted-foreground sm:text-[19px]">
              Pilih jenis olahraga klub Anda saat mendaftar. Istilah, modul, dan saran fasilitas menyesuaikan. Setiap halaman di bawah menjelaskan fitur yang tersedia untuk olahraga itu.
            </p>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t, i) => {
                const content = sportContent(t, (m) => t.modules.includes(m) && ready.has(m));
                return (
                  <li key={t.code}>
                    <Link
                      href={`/s/${t.code}`}
                      className="group flex h-full flex-col gap-3 rounded-[24px] bg-card p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                    >
                      <span className="font-display text-3xl leading-none text-accent-foreground" aria-hidden>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2 className="text-[22px] font-bold leading-tight">{t.name}</h2>
                      <p className="text-pretty text-muted-foreground">{content.tagline}</p>
                      <span className="mt-auto inline-flex items-center gap-2 pt-2 font-bold">
                        Lihat fitur
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            <p className="mt-10 max-w-[60ch] text-muted-foreground">
              Olahraga Anda tidak ada di daftar? Pilih <b className="text-foreground">Lainnya</b> saat mendaftar. Jenis olahraga baru ditambahkan lewat data.
            </p>
          </Wrap>
        </section>
      </main>
      <LandingFooter />
      <JsonLdScript data={data} />
    </div>
  );
}
