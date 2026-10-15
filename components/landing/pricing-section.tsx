import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import type { PricingPlan } from "@/lib/pricing";
import type { PlatformModule } from "@/lib/data/platform-pricing";
import { LandingPricing } from "@/components/pricing/landing-pricing";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "./section";

function list(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} dan ${items[items.length - 1]}` : (items[0] ?? "");
}

export function PricingSection({ plans, modules }: { plans: PricingPlan[]; modules: PlatformModule[] }) {
  const trialPlans = plans.filter((p) => p.trialDays > 0);
  const freeMonths = Math.max(0, ...plans.map((p) => p.yearlyFreeMonths));

  return (
    <Section
      id="harga"
      eyebrow="Harga"
      title="Satu langganan per organisasi, dihitung dari pengguna internal."
      className="bg-muted/50"
      intro={
        <p>
          Pengguna internal adalah pemilik, admin, pelatih, resepsionis, dan keuangan yang aktif. Anggota tidak dibatasi
          dan tidak dihitung. Semua modul yang tersedia termasuk di setiap paket.
        </p>
      }
    >
      {plans.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border bg-card p-6">
          <p className="text-muted-foreground">Daftar harga sedang tidak dapat dimuat. Harga tetap ditampilkan saat Anda mendaftar.</p>
          <Link href="/daftar" className={buttonVariants()}>
            Lanjut ke pendaftaran
          </Link>
        </div>
      ) : (
        <>
          <ul className="mb-8 grid gap-3 text-sm sm:grid-cols-3">
            <li className="rounded-lg border border-border bg-card p-4">
              <p className="font-semibold">Batas klub</p>
              <p className="mt-1 text-muted-foreground">
                {list(plans.map((p) => `${p.name} ${p.clubLimit ? `maksimal ${p.clubLimit} klub` : "tanpa batas klub"}`))}.
              </p>
            </li>
            <li className="rounded-lg border border-border bg-card p-4">
              <p className="font-semibold">Bayar tahunan</p>
              <p className="mt-1 text-muted-foreground">
                {freeMonths > 0
                  ? `Gratis ${freeMonths.toLocaleString("id-ID")} bulan: Anda membayar ${(12 - freeMonths).toLocaleString("id-ID")} bulan untuk 12 bulan.`
                  : "Harga tahunan sama dengan 12 kali harga bulanan."}
              </p>
            </li>
            <li className="rounded-lg border border-border bg-card p-4">
              <p className="font-semibold">Trial</p>
              <p className="mt-1 text-muted-foreground">
                {trialPlans.length > 0
                  ? `${list(trialPlans.map((p) => `${p.name}: gratis ${p.trialDays} hari`))}. Paket lain aktif setelah pembayaran diterima.`
                  : "Saat ini tidak ada masa trial. Paket aktif setelah pembayaran diterima."}
              </p>
            </li>
          </ul>
          <LandingPricing plans={plans} modules={modules} />
          <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
            Total dihitung ulang di server dari jumlah pengguna internal saat itu. Paket diaktifkan oleh tim {APP_NAME}{" "}
            setelah pembayaran diterima; belum ada pembayaran online di dalam aplikasi.
          </p>
        </>
      )}
    </Section>
  );
}
