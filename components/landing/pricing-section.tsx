import Link from "next/link";
import { Blocks, Calendar, Users } from "lucide-react";
import type { PricingPlan } from "@/lib/pricing";
import { PlanCard } from "./plan-card";
import { ctaClass } from "./cta";
import { Wrap } from "./wrap";

export function PricingSection({ plans }: { plans: PricingPlan[] }) {
  const freeMonths = Math.max(0, ...plans.map((p) => p.yearlyFreeMonths));
  const minSeats = Math.max(1, ...plans.map((p) => p.minSeats));

  return (
    <section id="harga" aria-labelledby="harga-judul" className="scroll-mt-20 py-14 sm:py-[88px]">
      <Wrap>
        <h2 id="harga-judul" className="max-w-[22ch] text-balance font-display text-[40px] uppercase leading-[0.98] sm:text-5xl lg:text-[64px]">
          Harga per seat, anggota tanpa batas.
        </h2>
        <p className="mt-[18px] max-w-[52ch] text-pretty text-lg text-muted-foreground sm:text-[19px]">
          Satu seat per pemilik, admin, resepsionis, dan keuangan yang aktif. Pembelian minimal {minSeats} seat.
        </p>
        {plans.length === 0 ? (
          <p className="mt-12 rounded-[28px] border border-dashed border-border p-6 text-muted-foreground">
            Daftar harga sedang tidak dapat dimuat. Harga tetap ditampilkan saat Anda mendaftar.
          </p>
        ) : (
          <div className="mt-12 grid items-start gap-8 lg:grid-cols-[7fr_5fr] lg:gap-12">
            <div className="grid gap-5">
              {plans.map((plan) => (
                <PlanCard key={plan.code} plan={plan} />
              ))}
            </div>
            <ul className="grid gap-7">
              {[
                { icon: Users, title: "Pelatih, kasir, dan anggota", text: "Tidak memakai seat." },
                {
                  icon: Calendar,
                  title: "Bayar tahunan",
                  text: freeMonths > 0 ? `Gratis ${freeMonths.toLocaleString("id-ID")} bulan untuk 12 bulan.` : "Sama dengan 12 kali harga bulanan.",
                },
                { icon: Blocks, title: "Semua modul tersedia", text: "Termasuk di paket ini." },
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-foreground text-primary dark:bg-primary dark:text-primary-foreground">
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <p>
                    <b className="block text-[17px]">{title}</b>
                    <span className="mt-0.5 block text-[15.5px] leading-snug text-muted-foreground">{text}</span>
                  </p>
                </li>
              ))}
              <li className="text-[15.5px] text-muted-foreground">
                Paket diaktifkan setelah pembayaran diterima; belum ada pembayaran online di dalam aplikasi. Tagihan anggota dicatat manual oleh staf klub.
              </li>
              <li>
                <Link href="/signup" className={ctaClass("line", true)}>
                  Daftarkan klub
                </Link>
              </li>
            </ul>
          </div>
        )}
      </Wrap>
    </section>
  );
}
