import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { PublicClubType } from "@/lib/club-type";
import type { PlatformModule } from "@/lib/data/platform-pricing";
import { FEATURES } from "./features-section";
import { LandingFooter } from "./landing-footer";
import { LandingHeader, SkipLink } from "./landing-header";
import { describe } from "./sport-copy";

export function SportPage({
  type,
  others,
  modules,
  trialDays,
}: {
  type: PublicClubType;
  others: PublicClubType[];
  modules: PlatformModule[];
  trialDays: number;
}) {
  const ready = new Set(modules.filter((m) => m.status === "ready").map((m) => m.code));
  const features = FEATURES.filter((f) => type.modules.includes(f.module) && ready.has(f.module));
  const terms: [string, string][] = [
    ["Anggota", type.terms.member],
    ["Pelatih", type.terms.coach],
    ["Kunjungan", type.terms.visit],
    ["Fasilitas", type.terms.resource],
    ["Sesi", type.terms.session],
    ["Lokasi", type.terms.location],
  ];
  const cta = trialDays > 0 ? `Coba gratis ${trialDays} hari` : `Daftarkan ${type.name}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink />
      <LandingHeader />
      <main id="konten" className="flex flex-1 flex-col">
        <section className="dark border-b border-border bg-background text-foreground">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <nav aria-label="Jejak halaman" className="text-sm text-muted-foreground">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link href="/" className="hover:text-foreground hover:underline">
                    Beranda
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li>
                  <Link href="/#olahraga" className="hover:text-foreground hover:underline">
                    Olahraga
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="text-foreground">
                  {type.name}
                </li>
              </ol>
            </nav>
            <h1 className="mt-6 max-w-3xl text-balance font-display text-5xl uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Aplikasi manajemen {type.name}
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              Kelola {describe(type, ready)} dalam satu aplikasi.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={`/daftar?jenis=${type.code}`} className={buttonVariants({ size: "lg", className: "h-12 px-6 text-base" })}>
                {cta}
              </Link>
              <Link href="/#harga" className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-6 text-base" })}>
                Lihat harga
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="fitur-judul" className="py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 id="fitur-judul" className="max-w-2xl text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Yang tersedia untuk {type.name}
            </h2>
            <ul className="mt-10 flex flex-col divide-y divide-border border-t border-foreground/80">
              {features.map((f) => (
                <li key={f.title} className="grid gap-2 py-5 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-8">
                  <div className="flex items-start gap-3">
                    <f.icon className="mt-0.5 size-5 shrink-0 text-accent-foreground" aria-hidden />
                    <h3 className="font-heading text-lg font-semibold leading-snug">{f.title}</h3>
                  </div>
                  <p className="text-pretty text-muted-foreground">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="istilah-judul" className="border-y border-border bg-muted/50 py-16 sm:py-24">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20">
            <div>
              <h2 id="istilah-judul" className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Istilah yang sesuai jenis klub
              </h2>
              <p className="mt-4 text-pretty text-muted-foreground">
                Saat Anda memilih {type.name} saat mendaftar, menu dan halaman memakai istilah berikut.
              </p>
            </div>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {terms.map(([label, value]) => (
                <div key={label} className="border-t border-border pt-3">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-heading text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {others.length > 0 ? (
          <section aria-labelledby="lainnya-judul" className="py-16 sm:py-20">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <h2 id="lainnya-judul" className="font-heading text-2xl font-semibold tracking-tight">
                Jenis klub lainnya
              </h2>
              <ul className="mt-6 flex flex-wrap gap-3">
                {others.map((o) => (
                  <li key={o.code}>
                    <Link href={`/olahraga/${o.code}`} className={buttonVariants({ variant: "outline", className: "gap-2" })}>
                      {o.name}
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </main>
      <LandingFooter />
    </div>
  );
}
