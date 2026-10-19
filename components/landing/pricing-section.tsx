import Link from "next/link";
import { Blocks, Calendar, Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/pricing";
import type { PricingPlan } from "@/lib/pricing";
import { ctaClass } from "./cta";
import { Wrap } from "./wrap";

const rp = (value: number) => formatRupiah(value).replace("Rp ", "Rp");

export function PricingSection({ plans }: { plans: PricingPlan[] }) {
  const freeMonths = Math.max(0, ...plans.map((p) => p.yearlyFreeMonths));
  const trialDays = Math.max(0, ...plans.map((p) => p.trialDays));
  const top = plans.length > 1 ? plans[plans.length - 1].code : null;

  return (
    <section id="harga" aria-labelledby="harga-judul" className="scroll-mt-20 py-14 sm:py-[88px]">
      <Wrap>
        <h2 id="harga-judul" className="max-w-[22ch] text-balance font-display text-[40px] font-normal uppercase leading-[0.98] sm:text-5xl lg:text-[64px]">
          Harga per seat, anggota tanpa batas.
        </h2>
        <p className="mt-[18px] max-w-[52ch] text-pretty text-lg text-muted-foreground sm:text-[19px]">
          {trialDays > 0 ? `Uji coba ${trialDays} hari untuk klub baru. ` : ""}Satu seat per pemilik, admin, resepsionis, dan keuangan yang aktif.
        </p>
        {plans.length === 0 ? (
          <p className="mt-12 rounded-[28px] border border-dashed border-border p-6 text-muted-foreground">
            Daftar harga sedang tidak dapat dimuat. Harga tetap ditampilkan saat Anda mendaftar.
          </p>
        ) : (
          <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-[5fr_7fr] lg:items-end">
            {plans.map((plan) => {
              const hot = plan.code === top;
              return (
                <article key={plan.code} className={cn("flex flex-col gap-1.5 rounded-[28px] p-7 sm:p-9", hot ? "bg-primary py-8 text-primary-foreground lg:py-12" : "bg-card")}>
                  <h3 className="text-[22px] font-bold">{plan.name}</h3>
                  <div className={cn("mt-2 font-display leading-none tracking-[-0.01em]", hot ? "text-[76px] lg:text-[92px]" : "text-[68px]")}>{rp(plan.pricePerUserMonth)}</div>
                  <div className={cn("font-semibold", hot ? "text-primary-foreground/80" : "text-muted-foreground")}>per seat, per bulan</div>
                  <ul className="mt-[18px] flex flex-col gap-[9px] font-semibold">
                    {[
                      plan.clubLimit ? `Sampai ${plan.clubLimit} klub` : "Klub tanpa batas",
                      "Anggota tidak dibatasi",
                      ...(plan.trialDays > 0 ? [`Uji coba ${plan.trialDays} hari`] : []),
                    ].map((line) => (
                      <li key={line} className="flex items-center gap-2.5">
                        <Check className={cn("size-5", hot ? "text-primary-foreground" : "text-accent-foreground")} strokeWidth={2.4} aria-hidden />
                        {line}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
        <ul className="mt-9 grid gap-7 md:grid-cols-3">
          {[
            { icon: Users, title: "Pelatih, kasir, dan anggota", text: "Tidak memakai seat." },
            {
              icon: Calendar,
              title: "Bayar tahunan",
              text: freeMonths > 0 ? `Gratis ${freeMonths.toLocaleString("id-ID")} bulan untuk 12 bulan.` : "Sama dengan 12 kali harga bulanan.",
            },
            { icon: Blocks, title: "Semua modul tersedia", text: "Termasuk di setiap paket." },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-foreground text-primary">
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <p>
                <b className="block text-[17px]">{title}</b>
                <span className="mt-0.5 block text-[15.5px] leading-snug text-muted-foreground">{text}</span>
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4 text-[15.5px] text-muted-foreground">
          <span className="max-w-[60ch]">
            Paket diaktifkan setelah pembayaran diterima; belum ada pembayaran online di dalam aplikasi. Tagihan anggota dicatat manual oleh staf klub.
          </span>
          <Link href="/signup" className={ctaClass("line", true)}>
            Daftarkan klub
          </Link>
        </div>
      </Wrap>
    </section>
  );
}
