import { ArrowLeftRight, Building2 } from "lucide-react";
import type { PricingPlan } from "@/lib/pricing";

const SAMPLE_CLUBS = [
  { name: "Klub contoh A", type: "Klub Renang", current: true },
  { name: "Klub contoh B", type: "Gym", current: false },
  { name: "Klub contoh C", type: "Klub Tenis", current: false },
];

export function MultiClub({ plans }: { plans: PricingPlan[] }) {
  return (
    <section id="multi-klub" aria-labelledby="multi-klub-judul" className="scroll-mt-20 border-y border-border bg-card py-16 text-foreground sm:py-24">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold text-accent-foreground">Multi klub</p>
          <h2 id="multi-klub-judul" className="mt-2 text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Satu organisasi, beberapa klub, satu akun pemilik.
          </h2>
          <ul className="mt-6 flex flex-col gap-3 text-muted-foreground">
            <li>Setiap klub punya jenis olahraga, anggota, staf, jadwal, dan buku kas sendiri, terpisah di tingkat basis data.</li>
            <li>Pemilik berpindah klub dari menu di bagian atas tanpa masuk ulang.</li>
            <li>Satu langganan untuk seluruh organisasi, dihitung dari jumlah seat, bukan jumlah klub.</li>
            {plans.length > 0 ? (
              <li>
                Batas klub per paket:{" "}
                {plans.map((p, i) => (
                  <span key={p.code}>
                    {i > 0 ? "; " : ""}
                    {p.name} {p.clubLimit ? `maksimal ${p.clubLimit} klub` : "tanpa batas klub"}
                  </span>
                ))}
                .
              </li>
            ) : null}
          </ul>
        </div>
        <figure aria-label="Contoh daftar klub milik satu organisasi dengan data contoh" className="rounded-xl border border-border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-heading text-sm font-semibold">
              <Building2 className="size-4" aria-hidden />
              Organisasi contoh
            </p>
            <span className="rounded-sm border border-border px-2.5 py-0.5 text-xs text-muted-foreground">Contoh data</span>
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {SAMPLE_CLUBS.map((club) => (
              <li key={club.name} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
                <div>
                  <p className="font-medium">{club.name}</p>
                  <p className="text-sm text-muted-foreground">{club.type}</p>
                </div>
                {club.current ? (
                  <span className="text-xs font-medium text-foreground">Klub aktif</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowLeftRight className="size-3.5" aria-hidden />
                    Pindah
                  </span>
                )}
              </li>
            ))}
          </ul>
          <figcaption className="sr-only">Contoh data, bukan klub sungguhan.</figcaption>
        </figure>
      </div>
    </section>
  );
}
