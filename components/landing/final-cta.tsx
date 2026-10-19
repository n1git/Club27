import Link from "next/link";
import { ArrowDot, ctaClass } from "./cta";
import { Wrap } from "./wrap";

export function FinalCta() {
  return (
    <section aria-labelledby="mulai-judul" className="rounded-t-[32px] bg-background pt-16 text-foreground sm:rounded-t-[40px] sm:pt-24">
      <Wrap>
        <h2 id="mulai-judul" className="max-w-[16ch] text-balance font-display text-5xl font-normal uppercase leading-[0.98] sm:text-7xl lg:text-[92px]">
          Mulai dari akun gratis. Naik kelas saat <span className="text-primary">klub siap.</span>
        </h2>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="flex flex-col items-start gap-1.5 rounded-[28px] bg-primary p-6 text-primary-foreground sm:p-9">
            <h3 className="text-[26px] font-bold">Anggota dan atlet</h3>
            <p className="mb-[22px] max-w-[38ch] text-[#2c3300]">Catat latihan, ajak teman, dan gabung klub dengan kode.</p>
            <Link href="/signup/account" className={`${ctaClass("ink")} w-full sm:w-auto`}>
              Buat akun gratis <ArrowDot />
            </Link>
          </div>
          <div className="flex flex-col items-start gap-1.5 rounded-[28px] bg-card p-6 sm:p-9">
            <h3 className="text-[26px] font-bold">Pemilik klub</h3>
            <p className="mb-[22px] max-w-[38ch] text-muted-foreground">Anggota, jadwal, booking, kasir, dan buku kas dalam satu organisasi.</p>
            <Link href="/signup" className={`${ctaClass("line")} w-full sm:w-auto`}>
              Daftarkan klub
            </Link>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
