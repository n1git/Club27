import Link from "next/link";
import { ArrowDot, ctaClass } from "./cta";
import { PhoneStage } from "./phone-stage";
import { Wrap } from "./wrap";

export function Hero() {
  return (
    <section aria-labelledby="hero-judul" className="pb-12 pt-6 sm:pb-[72px]">
      <Wrap className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12">
        <div>
          <h1 id="hero-judul" className="max-w-[14ch] text-balance font-display text-[50px] lg:max-w-none font-normal uppercase leading-[0.98] tracking-[-0.005em] sm:text-[64px] lg:text-[78px]">
            Buat akun gratis.{" "}
            <span className="bg-[linear-gradient(transparent_62%,var(--primary)_62%_92%,transparent_92%)] px-0.5 dark:bg-none dark:text-primary">Ajak teman.</span>
          </h1>
          <p className="mt-5 max-w-[44ch] text-pretty text-lg text-muted-foreground sm:text-[19px]">
            Catat latihan, pasang target mingguan, dan lihat kabar teman berlatih. Tanpa organisasi, tanpa kartu.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/signup/account" className={ctaClass("solid")}>
              Buat akun gratis <ArrowDot />
            </Link>
            <Link href="/signup" className={ctaClass("line")}>
              Daftarkan klub
            </Link>
          </div>
        </div>
        <PhoneStage />
      </Wrap>
    </section>
  );
}
